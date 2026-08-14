import "server-only";

const DEFAULT_BITCART_URL = "https://bitcart.sellerdock.com.br";

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

export async function bitcartRequest(path: string, init: RequestInit = {}) {
  if (!path.startsWith("/api/")) {
    throw new Error("Bitcart path is not allowlisted");
  }

  const token = process.env.BITCART_API_TOKEN;
  if (!token) {
    throw new Error("Bitcart integration is not configured");
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
