import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const FORM_FILE = path.join(process.cwd(), "form.txt");

test.describe("Contact form — /contato", () => {
  test.beforeEach(async () => {
    // Clean up form.txt before each test
    if (fs.existsSync(FORM_FILE)) {
      fs.unlinkSync(FORM_FILE);
    }
  });

  test.afterEach(async () => {
    // Clean up form.txt after each test
    if (fs.existsSync(FORM_FILE)) {
      fs.unlinkSync(FORM_FILE);
    }
  });

  test("navigates from home to /contato via CTA", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Quero para minha loja" }).first().click();
    await page.waitForURL("**/contato");
    expect(new URL(page.url()).pathname).toBe("/contato");
  });

  test("renders contact form with all required fields", async ({ page }) => {
    await page.goto("/contato");

    await expect(
      page.getByRole("heading", { name: /Quero Cardápio Rápido/i })
    ).toBeVisible();
    await expect(page.getByLabel(/^Nome$/i)).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Nome do Restaurante/i)).toBeVisible();
    await expect(page.getByLabel(/Endereço/i)).toBeVisible();
    await expect(page.getByLabel(/Pedidos por Dia/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Enviar/i })).toBeVisible();
  });

  test("submits form successfully and shows confirmation", async ({ page }) => {
    await page.goto("/contato");

    await page.getByLabel(/^Nome$/i).fill("João Silva");
    await page.getByLabel(/Email/i).fill("joao@test.com");
    await page.getByLabel(/Nome do Restaurante/i).fill("Pizzaria do João");
    await page.getByLabel(/Endereço/i).fill("Rua A, 123");
    await page.getByLabel(/Pedidos por Dia/i).fill("50");

    await page.getByRole("button", { name: /Enviar/i }).click();

    // Wait for success message
    await expect(page.getByText(/formulário enviado/i)).toBeVisible();
  });

  test("writes submission data to form.txt", async ({ page }) => {
    await page.goto("/contato");

    await page.getByLabel(/^Nome$/i).fill("Maria Santos");
    await page.getByLabel(/Email/i).fill("maria@test.com");
    await page.getByLabel(/Nome do Restaurante/i).fill("Lanchonete da Maria");
    await page.getByLabel(/Endereço/i).fill("Rua B, 456");
    await page.getByLabel(/Pedidos por Dia/i).fill("30");

    await page.getByRole("button", { name: /Enviar/i }).click();

    // Wait for success message to ensure submission completed
    await expect(page.getByText(/formulário enviado/i)).toBeVisible();

    // Verify file was written
    expect(fs.existsSync(FORM_FILE)).toBe(true);
    const content = fs.readFileSync(FORM_FILE, "utf-8");
    expect(content).toContain("Maria Santos");
    expect(content).toContain("maria@test.com");
    expect(content).toContain("Lanchonete da Maria");
  });

  test("shows validation error for invalid email", async ({ page }) => {
    await page.goto("/contato");

    await page.getByLabel(/^Nome$/i).fill("João Silva");
    await page.getByLabel(/Email/i).fill("invalid-email");
    await page.getByLabel(/Nome do Restaurante/i).fill("Pizzaria do João");
    await page.getByLabel(/Endereço/i).fill("Rua A, 123");
    await page.getByLabel(/Pedidos por Dia/i).fill("50");

    await page.getByRole("button", { name: /Enviar/i }).click();

    // Should show email validation error
    await expect(page.getByText(/email inválido/i)).toBeVisible();
  });

  test("complete flow: home → contact → submit → success", async ({ page }) => {
    // Start from home
    await page.goto("/");

    // Click CTA to go to contact
    await page.getByRole("link", { name: "Quero para minha loja" }).first().click();
    await page.waitForURL("**/contato");

    // Fill form
    await page.getByLabel(/^Nome$/i).fill("Pedro Costa");
    await page.getByLabel(/Email/i).fill("pedro@test.com");
    await page.getByLabel(/Nome do Restaurante/i).fill("Bar do Pedro");
    await page.getByLabel(/Endereço/i).fill("Rua C, 789");
    await page.getByLabel(/Pedidos por Dia/i).fill("100");

    // Submit
    await page.getByRole("button", { name: /Enviar/i }).click();

    // Verify success
    await expect(page.getByText(/formulário enviado/i)).toBeVisible();

    // Verify data was saved
    expect(fs.existsSync(FORM_FILE)).toBe(true);
    const content = fs.readFileSync(FORM_FILE, "utf-8");
    expect(content).toContain("Pedro Costa");
    expect(content).toContain("pedro@test.com");
    expect(content).toContain("Bar do Pedro");
  });
});
