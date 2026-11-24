import "server-only";

const DEFAULT_BITCART_URL = "https://bitcart.docktools.com.br";
const ALLOWED_BITCART_PATHS = new Set([
  "/api/stores?limit=100&offset=0",
  "/api/wallets?limit=100&offset=0",
  "/api/users",
  "/api/wallets",
  "/api/stores",
  "/api/invoices",
]);

export class BitcartHttpError extends Error {
  constructor(readonly status: number) {
    super(`Bitcart request failed with ${status}`);
    this.name = "BitcartHttpError";
  }
}

function apiBaseUrl() {
  const value = process.env.BITCART_API_URL ?? DEFAULT_BITCART_URL;
  const url = new URL(value);

  if (url.protocol !== "https:") {
    throw new Error("BITCART_API_URL must use HTTPS");
  }

  return url;
}

export async function bitcartReadiness() {
  const url = new URL("/api/health/ready", apiBaseUrl());
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  return { ok: response.ok, status: response.status };
}

export async function authenticateBitcart({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const response = await fetch(new URL("/api/token", apiBaseUrl()), {
    method: "POST",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      permissions: ["invoice_management", "store_management", "wallet_management"],
      strict: true,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    return null;
  }

  const body: unknown = await response.json();
  if (!isBitcartIdentity(body)) {
    return null;
  }

  return {
    accessToken: body.access_token,
    userId: body.user_id,
  };
}

/** Public Bitcart signup. Never return or log its optional full-control token. */
export async function registerBitcartUser({
  email,
  password,
  captchaCode,
}: {
  email: string;
  password: string;
  captchaCode?: string;
}) {
  const response = await fetch(new URL("/api/users", apiBaseUrl()), {
    method: "POST",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      ...(captchaCode ? { captcha_code: captchaCode } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) throw new BitcartHttpError(response.status);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || typeof (body as { id?: unknown }).id !== "string") {
    throw new Error("Unexpected Bitcart registration response");
  }

  return { verified: (body as { is_verified?: unknown }).is_verified === true };
}

export async function bitcartStores(token: string) {
  const response = await bitcartRequest(
    token,
    "/api/stores?limit=100&offset=0",
  );
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !Array.isArray((body as { result?: unknown }).result)) {
    throw new Error("Unexpected Bitcart stores response");
  }

  return (body as { result: unknown[] }).result.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const store = value as Record<string, unknown>;
    if (typeof store.id !== "string" || typeof store.name !== "string") return [];
    return [{ id: store.id, name: store.name, currency: typeof store.default_currency === "string" ? store.default_currency : "USD" }];
  });
}

type BitcartWalletInput = {
  name: string;
  currency: "btc" | "bch" | "eth" | "xmr";
  xpub: string;
  additional_xpub_data?: Record<string, string>;
};

export async function bitcartWallets(token: string) {
  const records = await listBitcartRecords(token, "/api/wallets");
  return records.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const wallet = value as Record<string, unknown>;
    if (typeof wallet.id !== "string" || typeof wallet.name !== "string" ||
        typeof wallet.currency !== "string" || typeof wallet.xpub !== "string") return [];
    return [{ id: wallet.id, name: wallet.name, currency: wallet.currency.toLowerCase(), xpub: wallet.xpub }];
  });
}

export async function createBitcartWallet(token: string, wallet: BitcartWalletInput) {
  const response = await bitcartRequest(token, "/api/wallets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(wallet),
  });
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || typeof (body as { id?: unknown }).id !== "string") {
    throw new Error("Unexpected Bitcart wallet response");
  }
  return { id: (body as { id: string }).id };
}

export async function bitcartStoresForProvisioning(token: string) {
  const records = await listBitcartRecords(token, "/api/stores");
  return records.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const store = value as Record<string, unknown>;
    if (typeof store.id !== "string" || typeof store.name !== "string") return [];
    const wallets = Array.isArray(store.wallets) ? store.wallets.filter((id): id is string => typeof id === "string") : [];
    return [{ id: store.id, name: store.name, wallets }];
  });
}

async function listBitcartRecords(token: string, resource: "/api/wallets" | "/api/stores") {
  const records: unknown[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const response = await bitcartRequest(token, `${resource}?limit=100&offset=${offset}`);
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !Array.isArray((body as { result?: unknown }).result)) {
      throw new Error("Unexpected Bitcart list response");
    }
    const page = (body as { result: unknown[] }).result;
    records.push(...page);
    if (page.length < 100) return records;
  }
  // Fail closed rather than silently creating a duplicate when the account
  // exceeds the bounded scan window.
  throw new Error("Bitcart resource scan exceeded safety limit");
}

export async function createBitcartStore(token: string, name: string, walletId: string) {
  const response = await bitcartRequest(token, "/api/stores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, default_currency: "BRL", wallets: [walletId] }),
  });
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || typeof (body as { id?: unknown }).id !== "string") {
    throw new Error("Unexpected Bitcart store response");
  }
  return { id: (body as { id: string }).id };
}

export async function createBitcartInvoice(
  token: string,
  invoice: { price: string; store_id: string; currency: string; order_id?: string; notes?: string },
) {
  return bitcartRequest(token, "/api/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(invoice),
  });
}

export async function bitcartRequest(
  token: string,
  path: string,
  init: RequestInit = {},
) {
  const isPagedWalletOrStore = /^\/api\/(wallets|stores)\?limit=100&offset=(?:0|[1-9]\d{0,3})$/.test(path);
  if (!ALLOWED_BITCART_PATHS.has(path) && !isPagedWalletOrStore) {
    throw new Error("Bitcart path is not allowlisted");
  }

  const response = await fetch(new URL(path, apiBaseUrl()), {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
    // Invoice creation can take longer than a read; keep a bounded timeout,
    // but let the route report an ambiguous outcome rather than inviting retry.
    signal: AbortSignal.timeout(init.method?.toUpperCase() === "POST" ? 30_000 : 10_000),
  });

  if (!response.ok) {
    throw new BitcartHttpError(response.status);
  }

  return response;
}

function isBitcartIdentity(
  value: unknown,
): value is { access_token: string; user_id: string; tfa_required?: boolean } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.access_token === "string" &&
    record.access_token.length > 0 &&
    typeof record.user_id === "string" &&
    record.user_id.length > 0 &&
    record.tfa_required !== true
  );
}
