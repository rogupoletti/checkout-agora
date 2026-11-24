"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function RegisterForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, captchaCode: String(form.get("captchaCode") ?? "") }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error === "rate_limited"
          ? "Muitas tentativas. Aguarde antes de tentar novamente."
          : "Não foi possível criar a conta. Confira os dados ou tente novamente mais tarde.");
        return;
      }

      const login = await signIn("credentials", { email, password, callbackUrl: "/onboarding/wallet", redirect: false });
      if (login?.ok) {
        router.push(login.url ?? "/onboarding/wallet");
      } else {
        router.push("/login?created=1");
      }
    } catch {
      setError("Não foi possível concluir o cadastro. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <form className="mx-auto grid max-w-md gap-5 rounded-xl border border-slate-800 bg-slate-900 p-8" onSubmit={submit}>
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-emerald-400">CHECKOUT ÁGORA</p>
          <h1 className="mt-3 text-3xl font-semibold">Criar conta</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">A conta será criada no Bitcart. O Ágora não armazena sua senha.</p>
        </div>
        <label className="grid gap-2 text-sm">E-mail
          <input className="rounded-md border border-slate-700 bg-slate-950 p-3" name="email" autoComplete="email" type="email" maxLength={254} required />
        </label>
        <label className="grid gap-2 text-sm">Senha (mínimo de 12 caracteres)
          <input className="rounded-md border border-slate-700 bg-slate-950 p-3" name="password" autoComplete="new-password" type="password" minLength={12} maxLength={256} required />
        </label>
        <label className="grid gap-2 text-sm">Código de verificação (se solicitado pelo Bitcart)
          <input className="rounded-md border border-slate-700 bg-slate-950 p-3" name="captchaCode" autoComplete="off" maxLength={4096} />
        </label>
        {error ? <p role="alert" className="rounded-md border border-rose-900 bg-rose-950/50 p-3 text-sm text-rose-200">{error}</p> : null}
        <button className="rounded-md bg-emerald-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50" disabled={pending} type="submit">
          {pending ? "Criando conta…" : "Criar conta"}
        </button>
        <p className="text-center text-sm text-slate-400">Já tem conta? <a className="text-emerald-300 underline" href="/login">Entrar</a></p>
      </form>
    </main>
  );
}
