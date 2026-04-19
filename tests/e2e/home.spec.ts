import { test, expect } from "@playwright/test";

test.describe("Landing page — Cardápio Rápido", () => {
  test("renders 'Cardápio Rápido' as the h1 heading", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Cardápio Rápido" })
    ).toBeVisible();
  });

  test("shows the 'R$ 1 por pedido' pricing value prop", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("R$ 1 por pedido").first()).toBeVisible();
  });

  test("renders the 'Como funciona' section heading", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Como funciona" })
    ).toBeVisible();
  });

  test("renders the 'Para o operador' section heading", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Para o operador" })
    ).toBeVisible();
  });

  test("renders the 'Para o consumidor' section heading", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Para o consumidor" })
    ).toBeVisible();
  });

  test("renders the 'Preço' section heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Preço" })).toBeVisible();
  });

  test("renders the 'Contato' section heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Contato" })).toBeVisible();
  });

  test("'Entrar' CTA links to /backoffice/login", async ({ page }) => {
    await page.goto("/");
    const entrar = page.getByRole("link", { name: "Entrar" });
    await expect(entrar).toBeVisible();
    await expect(entrar).toHaveAttribute("href", "/backoffice/login");
  });

  test("clicking the 'Entrar' CTA navigates to /backoffice/login", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Entrar" }).click();
    await page.waitForURL("**/backoffice/login");
    expect(new URL(page.url()).pathname).toBe("/backoffice/login");
  });

  test("'Quero para minha loja' CTA in hero links to #contato", async ({
    page,
  }) => {
    await page.goto("/");
    const hero = page.locator("section").first();
    const cta = hero.getByRole("link", { name: "Quero para minha loja" });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "#contato");
  });

  test("#contato anchor resolves to the contact section on the page", async ({
    page,
  }) => {
    await page.goto("/");
    const contato = page.locator("#contato");
    await expect(contato).toBeAttached();
    await expect(
      contato.getByRole("heading", { name: "Contato" })
    ).toBeVisible();
  });
});
