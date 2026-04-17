interface Benefit {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const benefits: Benefit[] = [
  {
    title: "Sem filas",
    description:
      "O pedido sai direto da mesa para a cozinha. Nada de esperar em linha para ser atendido.",
    icon: (
      <svg
        role="img"
        aria-label="Ícone de relógio"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    title: "Sem cadastro",
    description:
      "Não precisa criar conta, baixar app, nem deixar e-mail. Escaneou, pediu, pagou.",
    icon: (
      <svg
        role="img"
        aria-label="Ícone de pessoa sem cadastro"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" />
      </svg>
    ),
  },
  {
    title: "PIX ou cartão",
    description:
      "Pagamento na hora pelo Stripe, com PIX instantâneo ou cartão de crédito.",
    icon: (
      <svg
        role="img"
        aria-label="Ícone de formas de pagamento"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18M7 15h3" />
      </svg>
    ),
  },
];

export function ConsumerSection() {
  return (
    <section className="bg-white px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
            Para quem pede
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Para o consumidor
          </h2>
          <p className="mt-3 text-base text-zinc-600">
            Menos atrito do lado de quem paga. Pedido pronto mais rápido.
          </p>
        </div>
        <ul className="mt-10 grid gap-6 sm:grid-cols-3">
          {benefits.map((b) => (
            <li
              key={b.title}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white text-emerald-700 ring-1 ring-zinc-200">
                {b.icon}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-zinc-900">
                {b.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                {b.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
