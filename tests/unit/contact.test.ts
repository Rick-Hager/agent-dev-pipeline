import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/contact/route";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

const TEST_FORM_FILE = path.join(process.cwd(), "form.test.txt");

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/contact", () => {
  beforeEach(() => {
    // Clean up test file before each test
    if (fs.existsSync(TEST_FORM_FILE)) {
      fs.unlinkSync(TEST_FORM_FILE);
    }
    // Set test file path via env
    process.env.FORM_FILE_PATH = TEST_FORM_FILE;
  });

  afterEach(() => {
    // Clean up test file after each test
    if (fs.existsSync(TEST_FORM_FILE)) {
      fs.unlinkSync(TEST_FORM_FILE);
    }
    delete process.env.FORM_FILE_PATH;
  });

  it("returns 200 and writes to file on valid request", async () => {
    const request = createRequest({
      nome: "João Silva",
      email: "joao@email.com",
      nomeRestaurante: "Pizzaria do João",
      endereco: "Rua A, 123",
      pedidosPorDia: "50",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      message: "formulário enviado",
    });

    // Verify file was written
    expect(fs.existsSync(TEST_FORM_FILE)).toBe(true);
    const content = fs.readFileSync(TEST_FORM_FILE, "utf-8");
    expect(content).toContain("João Silva");
    expect(content).toContain("joao@email.com");
    expect(content).toContain("Pizzaria do João");
  });

  it("returns 400 on invalid email", async () => {
    const request = createRequest({
      nome: "João Silva",
      email: "invalid-email",
      nomeRestaurante: "Pizzaria do João",
      endereco: "Rua A, 123",
      pedidosPorDia: "50",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toContain("email");
  });

  it("returns 400 when required field is missing", async () => {
    const request = createRequest({
      nome: "João Silva",
      // email missing
      nomeRestaurante: "Pizzaria do João",
      endereco: "Rua A, 123",
      pedidosPorDia: "50",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("escapes CSV special characters correctly", async () => {
    const request = createRequest({
      nome: 'João "O Mestre" Silva',
      email: "joao@email.com",
      nomeRestaurante: "Pizza, Pasta & More",
      endereco: "Rua A, 123\nApto 4",
      pedidosPorDia: "50",
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const content = fs.readFileSync(TEST_FORM_FILE, "utf-8");
    // CSV escaping: quotes should be doubled, fields with commas/quotes should be quoted
    expect(content).toContain('"João ""O Mestre"" Silva"');
    expect(content).toContain('"Pizza, Pasta & More"');
  });

  it("creates header row if file does not exist", async () => {
    const request = createRequest({
      nome: "João Silva",
      email: "joao@email.com",
      nomeRestaurante: "Pizzaria do João",
      endereco: "Rua A, 123",
      pedidosPorDia: "50",
    });

    await POST(request);

    const content = fs.readFileSync(TEST_FORM_FILE, "utf-8");
    const lines = content.trim().split("\n");

    // First line should be header
    expect(lines[0]).toBe("nome,email,nomeRestaurante,endereco,pedidosPorDia,timestamp");
    // Second line should be data
    expect(lines.length).toBe(2);
  });

  it("appends to existing file without duplicating header", async () => {
    // First submission
    await POST(
      createRequest({
        nome: "João",
        email: "joao@email.com",
        nomeRestaurante: "Pizzaria",
        endereco: "Rua A",
        pedidosPorDia: "50",
      })
    );

    // Second submission
    await POST(
      createRequest({
        nome: "Maria",
        email: "maria@email.com",
        nomeRestaurante: "Lanchonete",
        endereco: "Rua B",
        pedidosPorDia: "30",
      })
    );

    const content = fs.readFileSync(TEST_FORM_FILE, "utf-8");
    const lines = content.trim().split("\n");

    // Should have header + 2 data rows
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain("nome,email");
    expect(lines[1]).toContain("João");
    expect(lines[2]).toContain("Maria");
  });
});
