import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white to-zinc-50 px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
      <div className="mx-auto max-w-4xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-emerald-500"
          />
          Checkout para lojas de alimentos
        </span>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-6xl">
          Cardápio Rápido
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-600 sm:text-xl">
          <span className="font-semibold text-zinc-900">R$ 1 por pedido</span>,
          sem mensalidade,{" "}
          <span className="font-semibold text-zinc-900">sem % sobre venda</span>
          . Fatura só no fim do mês.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link
            href="/backoffice/login"
            className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 sm:w-auto"
          >
            Entrar
          </Link>
          <Link
            href="/contato"
            className="inline-flex w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-6 py-3 text-base font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 sm:w-auto"
          >
            Quero para minha loja
          </Link>
        </div>
      </div>
    </section>
  );
}
