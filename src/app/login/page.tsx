"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      callbackUrl: "/",
      redirect: false,
    });

    setPending(false);
    if (!result?.ok) {
      setError("Não foi possível autenticar com o Bitcart.");
      return;
    }

    window.location.assign(result.url ?? "/");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <form
        className="mx-auto grid max-w-md gap-5 rounded-xl border border-slate-800 bg-slate-900 p-8"
        onSubmit={submit}
      >
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-emerald-400">
            CHECKOUT ÁGORA
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Entrar</h1>
          <p className="mt-2 text-sm text-slate-400">
            Use a conta existente do Bitcart. A senha não é armazenada pelo Ágora.
          </p>
        </div>
        <label className="grid gap-2 text-sm">
          E-mail
          <input className="rounded-md border border-slate-700 bg-slate-950 p-3" name="email" required type="email" />
        </label>
        <label className="grid gap-2 text-sm">
          Senha
          <input className="rounded-md border border-slate-700 bg-slate-950 p-3" name="password" required type="password" />
        </label>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <button className="rounded-md bg-emerald-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50" disabled={pending} type="submit">
          {pending ? "Autenticando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
