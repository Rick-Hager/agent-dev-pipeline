import { test, expect } from "@playwright/test";

test.describe("Home Page Welcome Message", () => {
  test("home page displays 'MenuApp' as heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "MenuApp" })).toBeVisible();
  });

  test("home page displays 'Cardápio digital para restaurantes' as subtitle", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByText("Cardápio digital para restaurantes")
    ).toBeVisible();
  });

  test("home page has a link to '/admin/login' with text 'Entrar'", async ({
    page,
  }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: "Entrar" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/admin/login");
  });
});
