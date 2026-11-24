import { connection } from "next/server";
import LoginForm from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  // CSP nonces are generated per request in proxy.ts; this page must not be
  // statically rendered so Next.js can apply the nonce to its scripts.
  await connection();
  const params = await searchParams;
  return <LoginForm created={params.created === "1"} />;
}
