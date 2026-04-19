"use client";

import { useEffect, useState } from "react";

interface PixPaymentViewProps {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  expiresAt: string;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Expirado";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}h ${String(m).padStart(2, "0")}m`;
  }
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function PixPaymentView({
  qrCode,
  qrCodeBase64,
  ticketUrl,
  expiresAt,
}: PixPaymentViewProps) {
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const remaining = new Date(expiresAt).getTime() - now;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="border rounded-lg p-4 bg-white space-y-4">
      <h2 className="text-lg font-semibold">Pague com PIX</h2>
      <p className="text-sm text-zinc-600">
        Escaneie o QR Code ou copie e cole o código no seu app do banco.
      </p>

      <div className="flex justify-center">
        <img
          src={`data:image/png;base64,${qrCodeBase64}`}
          alt="QR Code PIX"
          className="w-56 h-56 border rounded"
        />
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className="w-full py-2 border rounded-md text-sm font-medium hover:bg-zinc-50"
      >
        {copied ? "Código copiado!" : "Copiar código PIX"}
      </button>

      <p className="text-xs text-zinc-500 text-center">
        Expira em {formatRemaining(remaining)}
      </p>

      <a
        href={ticketUrl}
        target="_blank"
        rel="noreferrer"
        className="block text-center text-sm text-zinc-600 underline"
      >
        Abrir no Mercado Pago
      </a>
    </section>
  );
}
