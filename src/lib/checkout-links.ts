import "server-only";

import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmod, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type CheckoutInput = {
  price: string;
  storeId: string;
  storeName: string;
  currency: string;
  orderId: string;
  notes: string;
  bitcartAccessToken: string;
  creatorId: string;
};

type CheckoutRecord = {
  token_hash: string;
  price: string;
  store_id: string;
  store_name: string;
  currency: string;
  order_id: string;
  notes: string;
  encrypted_bitcart_token: string;
  creator_id: string;
  status: "ready" | "processing" | "failed" | "outcome_unknown" | "invoice_created";
  invoice_id: string | null;
};

let database: DatabaseSync | undefined;
let initialized: Promise<void> | undefined;

export async function closeCheckoutLinkDatabase() {
  await initialized;
  database?.close();
  database = undefined;
  initialized = undefined;
}

function dbPath() {
  return resolve(process.env.AGORA_DATA_DIR ?? "./data", "checkout-links.sqlite");
}

function getDatabase() {
  if (!database) {
    database = new DatabaseSync(dbPath());
    database.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    database.exec(`CREATE TABLE IF NOT EXISTS checkout_links (
      token_hash TEXT PRIMARY KEY,
      price TEXT NOT NULL,
      store_id TEXT NOT NULL,
      store_name TEXT NOT NULL,
      currency TEXT NOT NULL,
      order_id TEXT NOT NULL,
      notes TEXT NOT NULL,
      encrypted_bitcart_token TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('ready','processing','failed','outcome_unknown','invoice_created')),
      invoice_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`);
  }
  return database;
}

async function ensureDatabase() {
  if (!initialized) {
    initialized = (async () => {
      const file = dbPath();
      await mkdir(dirname(file), { recursive: true, mode: 0o700 });
      await chmod(dirname(file), 0o700);
      getDatabase();
      await chmod(file, 0o600);
    })();
  }
  await initialized;
}

function encryptionKey() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("NEXTAUTH_SECRET is required to protect stored Bitcart credentials");
  return createHash("sha256").update("checkout-agora:permanent-links:v1:").update(secret).digest();
}

function encryptToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function decryptToken(value: string) {
  const [iv, tag, ciphertext] = value.split(".");
  if (!iv || !tag || !ciphertext) throw new Error("Stored credential is malformed");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createCheckoutLink(input: CheckoutInput) {
  await ensureDatabase();
  const token = randomBytes(32).toString("base64url");
  getDatabase().prepare(`INSERT INTO checkout_links
    (token_hash, price, store_id, store_name, currency, order_id, notes, encrypted_bitcart_token, creator_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready')`).run(
    tokenHash(token), input.price, input.storeId, input.storeName, input.currency,
    input.orderId, input.notes, encryptToken(input.bitcartAccessToken), input.creatorId,
  );
  return token;
}

async function findRecord(token: string): Promise<CheckoutRecord | undefined> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return undefined;
  await ensureDatabase();
  return getDatabase().prepare("SELECT * FROM checkout_links WHERE token_hash = ?").get(tokenHash(token)) as CheckoutRecord | undefined;
}

export async function getPublicCheckoutLink(token: string) {
  const record = await findRecord(token);
  if (!record) return null;
  return {
    price: record.price,
    currency: record.currency,
    storeName: record.store_name,
    orderId: record.order_id || null,
    notes: record.notes || null,
    status: record.status,
  };
}

export type PaymentOutcome = { kind: "redirect"; checkoutUrl: string } | { kind: "conflict" };

export async function payPublicCheckoutLink(
  token: string,
  issueInvoice: (args: { bitcartAccessToken: string; price: string; storeId: string; currency: string; orderId: string; notes: string }) => Promise<{ id: string; checkoutUrl: string }>,
): Promise<PaymentOutcome | null> {
  const tokenDigest = tokenHash(token);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  await ensureDatabase();
  const db = getDatabase();
  const record = db.prepare("SELECT * FROM checkout_links WHERE token_hash = ?").get(tokenDigest) as CheckoutRecord | undefined;
  if (!record) return null;
  if (record.status === "invoice_created" && record.invoice_id) {
    return { kind: "redirect", checkoutUrl: checkoutUrlFor(record.invoice_id) };
  }
  const reserve = db.prepare("UPDATE checkout_links SET status = 'processing' WHERE token_hash = ? AND status = 'ready'").run(tokenDigest);
  if (Number(reserve.changes) !== 1) return { kind: "conflict" };

  try {
    const invoice = await issueInvoice({
      bitcartAccessToken: decryptToken(record.encrypted_bitcart_token),
      price: record.price,
      storeId: record.store_id,
      currency: record.currency,
      orderId: record.order_id,
      notes: record.notes,
    });
    db.prepare("UPDATE checkout_links SET status = 'invoice_created', invoice_id = ? WHERE token_hash = ? AND status = 'processing'").run(invoice.id, tokenDigest);
    return { kind: "redirect", checkoutUrl: invoice.checkoutUrl };
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number(error.status) : undefined;
    const ambiguous = error instanceof Error && (error.name === "TimeoutError" || status === undefined || status >= 500);
    db.prepare("UPDATE checkout_links SET status = ? WHERE token_hash = ? AND status = 'processing'").run(ambiguous ? "outcome_unknown" : "failed", tokenDigest);
    throw error;
  }
}

function checkoutUrlFor(invoiceId: string) {
  const base = process.env.BITCART_API_URL ?? "https://bitcart.docktools.com.br";
  return new URL(`/admin/i/${encodeURIComponent(invoiceId)}`, base).toString();
}
