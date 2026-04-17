interface Benefit {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const benefits: Benefit[] = [
  {
    title: "Gestão simples do cardápio",
    description:
      "Cadastre categorias, itens, preços e fotos em uma interface direta. Alterações entram no ar na hora.",
    icon: (
      <svg
        role="img"
        aria-label="Ícone de cardápio"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <path d="M4 4h14a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V4z" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    ),
  },
  {
    title: "KDS em tempo real",
    description:
      "Cada pedido confirmado aparece na cozinha automaticamente, com status e tempo de preparo.",
    icon: (
      <svg
        role="img"
        aria-label="Ícone de painel KDS"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  {
    title: "Máxima produtividade",
    description:
      "Sem atendente na frente do balcão anotando pedido — o time foca só em preparar e entregar.",
    icon: (
      <svg
        role="img"
        aria-label="Ícone de gráfico em alta"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <path d="M3 17l6-6 4 4 7-8" />
        <path d="M14 7h6v6" />
      </svg>
    ),
  },
];

export function OperatorSection() {
  return (
    <section className="bg-zinc-50 px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
            Para o dono da loja
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Para o operador
          </h2>
          <p className="mt-3 text-base text-zinc-600">
            Ferramentas diretas para quem precisa atender rápido e crescer sem
            fricção.
          </p>
        </div>
        <ul className="mt-10 grid gap-6 sm:grid-cols-3">
          {benefits.map((b) => (
            <li
              key={b.title}
              className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
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
