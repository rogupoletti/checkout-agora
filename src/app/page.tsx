export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100 sm:px-12">
      <section className="mx-auto max-w-4xl">
        <p className="mb-6 text-sm font-semibold tracking-[0.28em] text-emerald-400">
          PARALLEL SOCIETY
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Checkout Ágora
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          A fundação segura do Admin está em construção. Operações sensíveis
          permanecem fechadas até a autenticação, a auditoria e a integração
          server-side com o Bitcart estarem configuradas.
        </p>
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            ["Sessão", "nega acesso por padrão"],
            ["Integração", "Bitcart apenas no servidor"],
            ["Carteiras", "sem seeds ou chaves no Ágora"],
          ].map(([label, detail]) => (
            <div
              className="rounded-xl border border-slate-800 bg-slate-900/70 p-5"
              key={label}
            >
              <p className="font-medium text-emerald-300">{label}</p>
              <p className="mt-2 text-sm text-slate-400">{detail}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
