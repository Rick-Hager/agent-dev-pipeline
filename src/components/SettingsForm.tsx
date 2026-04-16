"use client";
import { useState } from "react";

export interface SettingsData {
  id: string;
  name: string;
  slug: string;
  logo: string;
  email: string;
  businessHours: string;
  stripePublishableKey: string;
  stripeSecretKeyMasked: string | null;
  whatsappNumber: string;
  whatsappMessageTemplate: string;
}

interface Props {
  initialSettings: SettingsData;
  slug: string;
}

export default function SettingsForm({ initialSettings, slug }: Props) {
  const [form, setForm] = useState({
    name: initialSettings.name,
    slug: initialSettings.slug,
    logo: initialSettings.logo,
    businessHours: initialSettings.businessHours,
    stripePublishableKey: initialSettings.stripePublishableKey,
    stripeSecretKey: "",
    whatsappNumber: initialSettings.whatsappNumber,
    whatsappMessageTemplate: initialSettings.whatsappMessageTemplate,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setSuccess(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError(null);

    const body: Record<string, unknown> = {
      name: form.name,
      slug: form.slug,
      logo: form.logo || null,
      stripePublishableKey: form.stripePublishableKey || null,
      whatsappNumber: form.whatsappNumber || null,
      whatsappMessageTemplate: form.whatsappMessageTemplate || null,
    };

    if (form.stripeSecretKey.length > 0) {
      body.stripeSecretKey = form.stripeSecretKey;
    }

    if (form.businessHours.trim()) {
      try {
        body.businessHours = JSON.parse(form.businessHours);
      } catch {
        setError("Business hours must be valid JSON");
        setLoading(false);
        return;
      }
    } else {
      body.businessHours = null;
    }

    try {
      const res = await fetch(`/api/restaurants/${slug}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        setError((data.error as string) ?? "Falha ao salvar configurações");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* General Info */}
      <section className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Informações gerais
        </h2>

        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700"
          >
            Nome do restaurante
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            required
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="slug"
            className="block text-sm font-medium text-gray-700"
          >
            Slug (URL)
          </label>
          <input
            id="slug"
            name="slug"
            type="text"
            value={form.slug}
            onChange={handleChange}
            required
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="logo"
            className="block text-sm font-medium text-gray-700"
          >
            Logo URL
          </label>
          <input
            id="logo"
            name="logo"
            type="text"
            value={form.logo}
            onChange={handleChange}
            placeholder="https://example.com/logo.png"
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="businessHours"
            className="block text-sm font-medium text-gray-700"
          >
            Horários de funcionamento (JSON)
          </label>
          <textarea
            id="businessHours"
            name="businessHours"
            value={form.businessHours}
            onChange={handleChange}
            rows={4}
            placeholder={'{"seg": "9:00-22:00", "ter": "9:00-22:00"}'}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          />
        </div>
      </section>

      {/* Stripe */}
      <section className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Stripe</h2>

        <div>
          <label
            htmlFor="stripePublishableKey"
            className="block text-sm font-medium text-gray-700"
          >
            Publishable Key
          </label>
          <input
            id="stripePublishableKey"
            name="stripePublishableKey"
            type="text"
            value={form.stripePublishableKey}
            onChange={handleChange}
            placeholder="pk_live_..."
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="stripeSecretKey"
            className="block text-sm font-medium text-gray-700"
          >
            Secret Key
            {initialSettings.stripeSecretKeyMasked && (
              <span className="ml-2 text-gray-400 text-xs font-mono font-normal">
                (atual: {initialSettings.stripeSecretKeyMasked})
              </span>
            )}
          </label>
          <input
            id="stripeSecretKey"
            name="stripeSecretKey"
            type="password"
            value={form.stripeSecretKey}
            onChange={handleChange}
            placeholder={
              initialSettings.stripeSecretKeyMasked
                ? "Digite para alterar"
                : "sk_live_..."
            }
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          />
        </div>
      </section>

      {/* WhatsApp */}
      <section className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">WhatsApp</h2>

        <div>
          <label
            htmlFor="whatsappNumber"
            className="block text-sm font-medium text-gray-700"
          >
            Número do WhatsApp
          </label>
          <input
            id="whatsappNumber"
            name="whatsappNumber"
            type="text"
            value={form.whatsappNumber}
            onChange={handleChange}
            placeholder="+5511999990000"
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="whatsappMessageTemplate"
            className="block text-sm font-medium text-gray-700"
          >
            Template de mensagem
          </label>
          <textarea
            id="whatsappMessageTemplate"
            name="whatsappMessageTemplate"
            value={form.whatsappMessageTemplate}
            onChange={handleChange}
            rows={3}
            placeholder="Seu pedido {orderNumber} está pronto!"
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </section>

      {/* Submit */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Salvar configurações"}
        </button>

        {success && (
          <p className="text-green-600 font-medium">
            Configurações salvas com sucesso!
          </p>
        )}

        {error && <p className="text-red-600 font-medium">{error}</p>}
      </div>
    </form>
  );
}
