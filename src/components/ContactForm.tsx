"use client";

import { useState, FormEvent } from "react";

interface FormData {
  nome: string;
  email: string;
  nomeRestaurante: string;
  endereco: string;
  pedidosPorDia: string;
}

type FormStatus = "idle" | "loading" | "success" | "error";

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export default function ContactForm() {
  const [formData, setFormData] = useState<FormData>({
    nome: "",
    email: "",
    nomeRestaurante: "",
    endereco: "",
    pedidosPorDia: "",
  });

  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState<string>("");
  const [emailError, setEmailError] = useState<string>("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear email error when user types
    if (name === "email") {
      setEmailError("");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validate email before submitting
    if (!isValidEmail(formData.email)) {
      setEmailError("Email inválido");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus("success");
        setMessage(data.message);
        // Clear form on success
        setFormData({
          nome: "",
          email: "",
          nomeRestaurante: "",
          endereco: "",
          pedidosPorDia: "",
        });
      } else {
        setStatus("error");
        setMessage(data.message || "Erro ao enviar formulário");
      }
    } catch {
      setStatus("error");
      setMessage("Erro ao enviar formulário. Tente novamente.");
    }
  };

  const isLoading = status === "loading";

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div>
        <label
          htmlFor="nome"
          className="block text-sm font-medium text-zinc-700"
        >
          Nome
        </label>
        <input
          type="text"
          id="nome"
          name="nome"
          value={formData.nome}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-zinc-700"
        >
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {emailError && (
          <p className="mt-1 text-sm text-red-600">{emailError}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="nomeRestaurante"
          className="block text-sm font-medium text-zinc-700"
        >
          Nome do Restaurante
        </label>
        <input
          type="text"
          id="nomeRestaurante"
          name="nomeRestaurante"
          value={formData.nomeRestaurante}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label
          htmlFor="endereco"
          className="block text-sm font-medium text-zinc-700"
        >
          Endereço
        </label>
        <input
          type="text"
          id="endereco"
          name="endereco"
          value={formData.endereco}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label
          htmlFor="pedidosPorDia"
          className="block text-sm font-medium text-zinc-700"
        >
          Quantidade de Pedidos por Dia
        </label>
        <input
          type="text"
          id="pedidosPorDia"
          name="pedidosPorDia"
          value={formData.pedidosPorDia}
          onChange={handleChange}
          required
          placeholder="Ex: 50"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-lg bg-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "Enviando..." : "Enviar"}
      </button>

      {status === "success" && (
        <div className="rounded-lg bg-emerald-50 p-4 text-emerald-800">
          {message}
        </div>
      )}

      {status === "error" && (
        <div className="rounded-lg bg-red-50 p-4 text-red-800">{message}</div>
      )}
    </form>
  );
}
