import ContactForm from "@/components/ContactForm";
import Link from "next/link";

export const metadata = {
  title: "Contato | Cardápio Rápido",
  description: "Entre em contato para ter o Cardápio Rápido na sua loja",
};

export default function ContatoPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-zinc-50">
      <div className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
        <Link
          href="/"
          className="mb-8 inline-flex items-center text-sm font-medium text-zinc-600 hover:text-emerald-600"
        >
          ← Voltar para o início
        </Link>

        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-emerald-500"
            />
            Fale com a gente
          </span>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Quero Cardápio Rápido na minha loja
          </h1>
          <p className="mt-4 text-base text-zinc-600 sm:text-lg">
            Preencha o formulário abaixo e entraremos em contato com a
            configuração inicial do seu cardápio digital.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <ContactForm />
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Ao enviar, você concorda em receber contato da equipe Cardápio Rápido.
        </p>
      </div>
    </main>
  );
}
