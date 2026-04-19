export function PricingSection() {
  return (
    <section className="bg-zinc-900 px-6 py-16 text-white sm:py-24">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
          Preço honesto
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Preço
        </h2>
        <p className="mt-6 text-2xl font-extrabold text-white sm:text-4xl">
          R$ 1 por pedido pago.
        </p>
        <ul className="mt-8 grid gap-3 text-left sm:grid-cols-3">
          <li className="rounded-xl border border-zinc-700 bg-zinc-800 p-5">
            <p className="text-base font-semibold text-white">Sem mensalidade</p>
            <p className="mt-1 text-sm text-zinc-400">
              Você paga só quando recebe pedido.
            </p>
          </li>
          <li className="rounded-xl border border-zinc-700 bg-zinc-800 p-5">
            <p className="text-base font-semibold text-white">
              Sem % sobre venda
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              Ticket médio alto não te pune.
            </p>
          </li>
          <li className="rounded-xl border border-zinc-700 bg-zinc-800 p-5">
            <p className="text-base font-semibold text-white">
              Fatura no fim do mês
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              Uma cobrança só, consolidada.
            </p>
          </li>
        </ul>
        <p className="mt-8 text-sm text-zinc-400">
          Só cobramos sobre pedidos efetivamente pagos pelo consumidor.
        </p>
      </div>
    </section>
  );
}
