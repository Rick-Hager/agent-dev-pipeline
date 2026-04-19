import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface ContactFormData {
  nome: string;
  email: string;
  nomeRestaurante: string;
  endereco: string;
  pedidosPorDia: string;
}

const REQUIRED_FIELDS: (keyof ContactFormData)[] = [
  "nome",
  "email",
  "nomeRestaurante",
  "endereco",
  "pedidosPorDia",
];

const CSV_HEADER = "nome,email,nomeRestaurante,endereco,pedidosPorDia,timestamp";

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function escapeCSV(value: string): string {
  const needsQuotes = value.includes(",") || value.includes('"') || value.includes("\n");
  if (needsQuotes) {
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return value;
}

function getFormFilePath(): string {
  return process.env.FORM_FILE_PATH || path.join(process.cwd(), "form.txt");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    // Validate required fields
    for (const field of REQUIRED_FIELDS) {
      if (!body[field] || typeof body[field] !== "string" || body[field].trim() === "") {
        return NextResponse.json(
          { success: false, message: `Campo obrigatório ausente: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate email format
    if (!isValidEmail(body.email)) {
      return NextResponse.json(
        { success: false, message: "email inválido" },
        { status: 400 }
      );
    }

    const data: ContactFormData = {
      nome: body.nome.trim(),
      email: body.email.trim(),
      nomeRestaurante: body.nomeRestaurante.trim(),
      endereco: body.endereco.trim(),
      pedidosPorDia: body.pedidosPorDia.trim(),
    };

    const filePath = getFormFilePath();
    const timestamp = new Date().toISOString();

    // Check if file exists and has content
    const fileExists = fs.existsSync(filePath) && fs.statSync(filePath).size > 0;

    // Build CSV line
    const csvLine = [
      escapeCSV(data.nome),
      escapeCSV(data.email),
      escapeCSV(data.nomeRestaurante),
      escapeCSV(data.endereco),
      escapeCSV(data.pedidosPorDia),
      timestamp,
    ].join(",");

    // Write to file
    if (!fileExists) {
      fs.writeFileSync(filePath, CSV_HEADER + "\n" + csvLine + "\n", "utf-8");
    } else {
      fs.appendFileSync(filePath, csvLine + "\n", "utf-8");
    }

    return NextResponse.json({
      success: true,
      message: "formulário enviado",
    });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { success: false, message: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
