import "server-only";

const DEFAULT_BITCART_URL = "https://bitcart.docktools.com.br";
const ALLOWED_BITCART_PATHS = new Set([
  "/api/stores?limit=100&offset=0",
  "/api/invoices",
]);

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
      permissions: ["invoice_management", "store_management"],
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
  if (!ALLOWED_BITCART_PATHS.has(path)) {
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
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Bitcart request failed with ${response.status}`);
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
