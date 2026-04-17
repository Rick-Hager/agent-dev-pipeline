const CONTACT_EMAIL = "contato@cardapiorapido.com.br";
const CONTACT_SUBJECT = "Quero Cardápio Rápido na minha loja";

export function ContactSection() {
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    CONTACT_SUBJECT
  )}`;

  return (
    <section
      id="contato"
      className="bg-white px-6 py-16 sm:py-24"
      aria-labelledby="contato-heading"
    >
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
          Fale com a gente
        </p>
        <h2
          id="contato-heading"
          className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl"
        >
          Contato
        </h2>
        <p className="mt-4 text-base text-zinc-600 sm:text-lg">
          Quer Cardápio Rápido na sua loja? Mande um e-mail que a gente retorna
          com a configuração inicial.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={mailto}
            className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 sm:w-auto"
          >
            Quero para minha loja
          </a>
          <a
            href={mailto}
            className="text-sm font-medium text-zinc-700 underline-offset-4 hover:text-emerald-700 hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </section>
  );
}
