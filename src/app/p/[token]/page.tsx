import { notFound } from "next/navigation";
import { getPublicCheckoutLink } from "@/lib/checkout-links";

export const dynamic = "force-dynamic";

export default async function PublicCheckoutPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const checkout = await getPublicCheckoutLink(token);
  if (!checkout) notFound();

  const unavailable = checkout.status !== "ready";
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-slate-100">
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900/70 p-7 sm:p-10">
        <p className="text-xs font-semibold tracking-[0.25em] text-emerald-400">PARALLEL SOCIETY</p>
        <h1 className="mt-3 text-2xl font-semibold">Checkout</h1>
        <p className="mt-2 text-sm text-slate-400">Pagamento processado com segurança pelo Bitcart.</p>
        <dl className="mt-8 grid gap-4 border-y border-slate-800 py-6 text-sm">
          <div><dt className="text-slate-400">Loja</dt><dd className="mt-1">{checkout.storeName}</dd></div>
          <div><dt className="text-slate-400">Valor</dt><dd className="mt-1 text-xl font-semibold">{checkout.price} {checkout.currency}</dd></div>
          {checkout.orderId ? <div><dt className="text-slate-400">Referência</dt><dd className="mt-1 break-all">{checkout.orderId}</dd></div> : null}
          {checkout.notes ? <div><dt className="text-slate-400">Observação</dt><dd className="mt-1 whitespace-pre-wrap">{checkout.notes}</dd></div> : null}
        </dl>
        {unavailable ? (
          <p role="status" className="mt-6 rounded-md border border-amber-900 bg-amber-950/50 p-4 text-sm text-amber-200">
            {checkout.status === "invoice_created" ? "O checkout já foi iniciado. Você pode continuar para o pagamento." : "Este link está sendo processado ou precisa de conferência. Não tente novamente agora."}
          </p>
        ) : null}
        <form action={`/api/public-checkout/${encodeURIComponent(token)}`} method="post" className="mt-7">
          <button className="w-full rounded-md bg-emerald-400 px-4 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50" disabled={checkout.status === "processing" || checkout.status === "failed" || checkout.status === "outcome_unknown"}>
            {checkout.status === "invoice_created" ? "Continuar para pagamento" : "Pagar"}
          </button>
        </form>
        <p className="mt-5 text-xs leading-5 text-slate-500">Acessar esta página não cria uma fatura. Ela só é criada quando você seleciona Pagar.</p>
      </section>
    </main>
  );
}
