"use client";

import { signOut } from "next-auth/react";
import { FormEvent, useEffect, useState } from "react";

type Store = { id: string; name: string; currency: string };
type Invoice = { id: string; checkoutUrl: string; price: string; currency: string; status: string };

export default function InvoiceDashboard({ email, role }: { email: string; role: string }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [orderId, setOrderId] = useState("");
  const [notes, setNotes] = useState("");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetch("/api/stores", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não consegui carregar as lojas. Confirme os acessos no Bitcart.");
        return response.json() as Promise<{ stores: Store[] }>;
      })
      .then(({ stores: items }) => {
        setStores(items);
        setStoreId(items[0]?.id ?? "");
        setCurrency(items[0]?.currency ?? "BRL");
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Falha ao carregar lojas."));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInvoice(null);
    setPending(true);
    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price, storeId, currency, orderId, notes }),
      });
      const body = await response.json() as { invoice?: Invoice; error?: string };
      if (!response.ok || !body.invoice) {
        throw new Error(body.error === "unauthenticated" ? "Sua sessão expirou. Entre novamente." : "Não foi possível criar o link. Revise os dados e tente novamente.");
      }
      setInvoice(body.invoice);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao criar link.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100 sm:px-10">
      <section className="mx-auto max-w-5xl">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.25em] text-emerald-400">PARALLEL SOCIETY</p>
            <h1 className="mt-2 text-3xl font-semibold">Checkout Ágora</h1>
            <p className="mt-1 text-sm text-slate-400">MVP de link de pagamento · conectado ao Bitcart</p>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span>{email} · {role}</span>
            <button className="rounded-md border border-slate-700 px-3 py-2 hover:bg-slate-800" onClick={() => signOut({ callbackUrl: "/login" })}>Sair</button>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
          <form className="grid gap-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8" onSubmit={submit}>
            <div>
              <h2 className="text-xl font-semibold">Criar link de pagamento</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">A criação gera uma fatura real na loja selecionada do Bitcart. Confira os dados antes de enviar.</p>
            </div>
            <label className="grid gap-2 text-sm">Loja
              <select className="rounded-md border border-slate-700 bg-slate-950 p-3" value={storeId} onChange={(event) => setStoreId(event.target.value)} required>
                {stores.length ? stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>) : <option value="">Carregando lojas…</option>}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm">Valor
                <input className="rounded-md border border-slate-700 bg-slate-950 p-3" value={price} onChange={(event) => setPrice(event.target.value)} type="number" min="0.01" max="999999999" step="0.01" inputMode="decimal" required />
              </label>
              <label className="grid gap-2 text-sm">Moeda
                <input className="rounded-md border border-slate-700 bg-slate-950 p-3 uppercase" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} maxLength={10} required />
              </label>
            </div>
            <label className="grid gap-2 text-sm">Referência do pedido (opcional)
              <input className="rounded-md border border-slate-700 bg-slate-950 p-3" value={orderId} onChange={(event) => setOrderId(event.target.value)} maxLength={128} />
            </label>
            <label className="grid gap-2 text-sm">Observação (opcional)
              <textarea className="min-h-24 rounded-md border border-slate-700 bg-slate-950 p-3" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} />
            </label>
            {error ? <p role="alert" className="rounded-md border border-rose-900 bg-rose-950/50 p-3 text-sm text-rose-200">{error}</p> : null}
            <button className="rounded-md bg-emerald-400 px-4 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50" disabled={pending || stores.length === 0} type="submit">
              {pending ? "Criando…" : "Criar link"}
            </button>
          </form>

          <aside className="h-fit rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="font-semibold">Resultado</h2>
            {invoice ? <div className="mt-4 grid gap-3 text-sm">
              <p>Fatura <code className="break-all text-emerald-300">{invoice.id}</code></p>
              <p>{invoice.price} {invoice.currency} · {invoice.status}</p>
              <a className="break-all text-emerald-300 underline" href={invoice.checkoutUrl} rel="noreferrer" target="_blank">Abrir checkout no Bitcart</a>
              <button className="rounded-md border border-slate-700 px-3 py-2 text-left hover:bg-slate-800" onClick={() => navigator.clipboard.writeText(invoice.checkoutUrl)}>Copiar link</button>
            </div> : <p className="mt-3 text-sm leading-6 text-slate-400">Depois de criar, o link seguro do checkout aparecerá aqui.</p>}
            <p className="mt-8 border-t border-slate-800 pt-4 text-xs leading-5 text-slate-500">MVP: autenticação Bitcart, link de pagamento e sessão protegida. Sem edição de carteiras, reembolsos ou movimentação de fundos.</p>
          </aside>
        </div>
      </section>
    </main>
  );
}
