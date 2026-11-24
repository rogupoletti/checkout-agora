import { isAddress } from "viem";
import { HDKey } from "@scure/bip32";
import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError, requireRole } from "@/lib/auth/server";
import {
  BitcartHttpError,
  bitcartStoresForProvisioning,
  bitcartWallets,
  createBitcartStore,
  createBitcartWallet,
} from "@/lib/bitcart/server";
import { recordAuditEvent } from "@/lib/security/audit";
import { assertSameOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

type Currency = "btc" | "bch" | "eth" | "xmr";
const provisioningLocks = new Map<string, Promise<void>>();

async function withProvisioningLock<T>(key: string, action: () => Promise<T>): Promise<T> {
  const previous = provisioningLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  provisioningLocks.set(key, current);
  await previous;
  try {
    return await action();
  } finally {
    release();
    if (provisioningLocks.get(key) === current) provisioningLocks.delete(key);
  }
}

function validAccountXpub(value: string) {
  try {
    if (!value.startsWith("xpub")) return false;
    const key = HDKey.fromExtendedKey(value);
    return key.depth === 3 && key.privateKey === null && key.publicExtendedKey === value;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
  } catch {
    recordAuditEvent({ action: "wallets.provision", outcome: "denied" });
    return NextResponse.json({ error: "cross_site_request" }, { status: 403 });
  }

  let actor;
  try {
    actor = await requireRole(request, "admin", "operator");
  } catch (error) {
    if (error instanceof AuthenticationError) {
      recordAuditEvent({ action: "wallets.provision", outcome: "denied" });
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    throw error;
  }

  const rate = checkRateLimit(`wallet-provision:${actor.id}`, 5, 60 * 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "invalid_input" }, { status: 415 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const input = body as Record<string, unknown>;
  const allowedKeys = new Set(["currency", "walletName", "storeName", "destination", "address", "viewKey"]);
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const currency = typeof input.currency === "string" ? input.currency.toLowerCase() : "";
  const walletName = typeof input.walletName === "string" ? input.walletName.trim() : "";
  const storeName = typeof input.storeName === "string" ? input.storeName.trim() : "";
  const destination = typeof input.destination === "string" ? input.destination.trim() : "";
  const address = typeof input.address === "string" ? input.address.trim() : "";
  const viewKey = typeof input.viewKey === "string" ? input.viewKey.trim() : "";

  if (!(["btc", "bch", "eth", "xmr"] as string[]).includes(currency) ||
      !walletName || walletName.length > 80 || !storeName || storeName.length > 80) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  if (currency === "btc" || currency === "bch") {
    if (!validAccountXpub(destination)) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  } else if (currency === "eth") {
    if (!isAddress(destination)) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  } else if (!/^4[1-9A-HJ-NP-Za-km-z]{94}$/.test(address) || !/^[0-9a-fA-F]{64}$/.test(viewKey)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const coin = currency as Currency;
  try {
    const storeId = await withProvisioningLock(actor.id, async () => {
      const [wallets, stores] = await Promise.all([
        bitcartWallets(actor.bitcartAccessToken),
        bitcartStoresForProvisioning(actor.bitcartAccessToken),
      ]);
      const expectedXpub = coin === "xmr" ? viewKey : destination;
      let wallet = wallets.find((item) => item.name === walletName && item.currency === coin && item.xpub === expectedXpub);
      if (!wallet) {
        const created = await createBitcartWallet(actor.bitcartAccessToken, {
          name: walletName,
          currency: coin,
          xpub: expectedXpub,
          ...(coin === "xmr" ? { additional_xpub_data: { address } } : {}),
        });
        wallet = { id: created.id, name: walletName, currency: coin, xpub: expectedXpub };
      }

      let store = stores.find((item) => item.name === storeName && item.wallets.includes(wallet!.id));
      if (!store) {
        const created = await createBitcartStore(actor.bitcartAccessToken, storeName, wallet.id);
        store = { id: created.id, name: storeName, wallets: [wallet.id] };
      }
      return store.id;
    });

    recordAuditEvent({ actorId: actor.id, action: "wallets.provision", outcome: "allowed", role: actor.role });
    return NextResponse.json({ status: "ready", storeId }, { status: 201 });
  } catch (error) {
    const upstreamStatus = error instanceof BitcartHttpError ? error.status : undefined;
    recordAuditEvent({
      actorId: actor.id,
      action: "wallets.provision",
      outcome: "failed",
      ...(upstreamStatus !== undefined ? { upstreamStatus, failureCode: upstreamStatus >= 500 ? "upstream_server_error" as const : "upstream_rejected" as const } : {}),
    });
    return NextResponse.json({ error: "wallet_setup_unavailable" }, { status: 503 });
  }
}
