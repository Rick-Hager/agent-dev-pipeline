interface Step {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const steps: Step[] = [
  {
    number: 1,
    title: "Consumidor escaneia o QR",
    description:
      "Sem app, sem cadastro. A câmera do celular abre o cardápio da loja em segundos.",
    icon: (
      <svg
        role="img"
        aria-label="Ícone de QR code"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-8 w-8"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1" />
      </svg>
    ),
  },
  {
    number: 2,
    title: "Monta o pedido e paga",
    description:
      "O cliente escolhe os itens e paga na hora por PIX ou cartão, via Stripe.",
    icon: (
      <svg
        role="img"
        aria-label="Ícone de carrinho de compras"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-8 w-8"
      >
        <path d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L21 8H6" />
        <circle cx="9" cy="20" r="1.5" />
        <circle cx="18" cy="20" r="1.5" />
      </svg>
    ),
  },
  {
    number: 3,
    title: "Pedido cai no KDS",
    description:
      "A cozinha vê o pedido em tempo real no painel KDS, pronto para preparar.",
    icon: (
      <svg
        role="img"
        aria-label="Ícone de monitor de cozinha"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-8 w-8"
      >
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
        <path d="M7 9l2 2 4-4" />
      </svg>
    ),
  },
];

export function HowItWorksSection() {
  return (
    <section className="bg-white px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Como funciona
          </h2>
          <p className="mt-3 text-base text-zinc-600">
            Da mesa à cozinha em três passos.
          </p>
        </div>
        <ol className="mt-12 grid gap-6 sm:grid-cols-3">
          {steps.map((step) => (
            <li
              key={step.number}
              data-testid="how-it-works-step"
              className="relative flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                  {step.number}
                </span>
                <span className="text-emerald-600" aria-hidden="true">
                  {step.icon}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-zinc-900">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
