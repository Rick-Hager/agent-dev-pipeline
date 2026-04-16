import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";
import { signJwt, COOKIE_NAME } from "@/lib/auth";
import bcrypt from "bcryptjs";

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface TestRestaurant {
  id: string;
  slug: string;
  email: string;
}

async function createTestRestaurant(suffix: string): Promise<TestRestaurant> {
  const ts = Date.now();
  const slug = `test-dashboard-${suffix}-${ts}`;
  const email = `test-dashboard-${suffix}-${ts}@test.com`;
  const passwordHash = await bcrypt.hash("password123", 10);

  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Dashboard Test Restaurant",
      slug,
      email,
      passwordHash,
    },
  });

  return { id: restaurant.id, slug, email };
}

async function deleteTestRestaurant(id: string): Promise<void> {
  await prisma.restaurant.delete({ where: { id } }).catch(() => {
    // Already deleted or doesn't exist — ignore
  });
}

async function setAuthCookie(
  page: import("@playwright/test").Page,
  restaurant: TestRestaurant
): Promise<void> {
  const token = await signJwt({
    restaurantId: restaurant.id,
    slug: restaurant.slug,
    email: restaurant.email,
  });

  await page.context().addCookies([
    {
      name: COOKIE_NAME,
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
    },
  ]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe("Admin Dashboard", () => {
  // ── Test 1: Unauthenticated redirect ─────────────────────────────────────
  test("unauthenticated user is redirected to login when accessing /backoffice/dashboard", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("/backoffice/dashboard");
    await expect(page).toHaveURL(/\/backoffice\/login/);
  });

  // ── Test 2: Dashboard loads after login ───────────────────────────────────
  test("authenticated owner sees dashboard with stat cards and navigation links", async ({
    page,
  }) => {
    const restaurant = await createTestRestaurant("load");

    try {
      await setAuthCookie(page, restaurant);
      await page.goto("/backoffice/dashboard");

      // Stat card headings are visible
      await expect(page.getByText("Pedidos Hoje")).toBeVisible();
      await expect(page.getByText("Receita Hoje")).toBeVisible();
      await expect(page.getByText("Pedidos Ativos")).toBeVisible();

      // Navigation links are present
      await expect(
        page.getByRole("link", { name: "Gerenciar Cardápio" }).first()
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Ver Pedidos" }).first()
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Configurações" }).first()
      ).toBeVisible();

      // "Abrir KDS" link is visible
      await expect(
        page.getByRole("link", { name: "Abrir KDS" }).first()
      ).toBeVisible();
    } finally {
      await deleteTestRestaurant(restaurant.id);
    }
  });

  // ── Test 3: Quick links have correct hrefs ────────────────────────────────
  test("dashboard quick links point to correct routes", async ({ page }) => {
    const restaurant = await createTestRestaurant("links");

    try {
      await setAuthCookie(page, restaurant);
      await page.goto("/backoffice/dashboard");

      // "Gerenciar Cardápio" quick link → /backoffice/menu
      const menuLinks = page.getByRole("link", { name: "Gerenciar Cardápio" });
      // Use the quick-action link inside the main content (not the sidebar nav)
      // The quick-action section uses a grid; both links are valid, check at least one
      await expect(menuLinks.first()).toHaveAttribute(
        "href",
        "/backoffice/menu"
      );

      // "Ver Pedidos" quick link → /backoffice/orders
      const ordersLinks = page.getByRole("link", { name: "Ver Pedidos" });
      await expect(ordersLinks.first()).toHaveAttribute(
        "href",
        "/backoffice/orders"
      );

      // "Configurações" quick link → /backoffice/settings
      const settingsLinks = page.getByRole("link", { name: "Configurações" });
      await expect(settingsLinks.first()).toHaveAttribute(
        "href",
        "/backoffice/settings"
      );
    } finally {
      await deleteTestRestaurant(restaurant.id);
    }
  });
});
