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
  const slug = `test-menu-${suffix}-${ts}`;
  const email = `test-menu-${suffix}-${ts}@test.com`;
  const passwordHash = await bcrypt.hash("password123", 10);

  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Menu Test Restaurant",
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

test.describe("Backoffice Menu Management", () => {
  // ── Test 1: Unauthenticated redirect ──────────────────────────────────────
  test("unauthenticated user is redirected to login when accessing /backoffice/menu", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("/backoffice/menu");
    await expect(page).toHaveURL(/\/backoffice\/login/);
  });

  // ── Test 2: Authenticated user sees menu management page ──────────────────
  test("authenticated owner sees the menu management page with categories and items", async ({
    page,
  }) => {
    const restaurant = await createTestRestaurant("view");

    try {
      // Create a category with items in the DB
      const category = await prisma.category.create({
        data: {
          name: "Entradas",
          restaurantId: restaurant.id,
          sortOrder: 0,
        },
      });

      await prisma.menuItem.create({
        data: {
          name: "Pão de Alho",
          priceInCents: 1500,
          categoryId: category.id,
          restaurantId: restaurant.id,
        },
      });

      await setAuthCookie(page, restaurant);
      await page.goto("/backoffice/menu");

      // Page heading should be visible
      await expect(
        page.getByRole("heading", { name: /Cardápio/ })
      ).toBeVisible();

      // Category name should be visible
      await expect(page.getByText("Entradas")).toBeVisible();

      // Item name and formatted price should be visible
      await expect(page.getByText("Pão de Alho")).toBeVisible();
      await expect(page.getByText("R$ 15,00")).toBeVisible();

      // Item should show "Disponível" badge
      await expect(page.getByText("Disponível").first()).toBeVisible();

      // "Nova categoria" button should be present
      await expect(
        page.getByRole("button", { name: "Nova categoria" })
      ).toBeVisible();
    } finally {
      await deleteTestRestaurant(restaurant.id);
    }
  });

  // ── Test 3: Create a new category ─────────────────────────────────────────
  test("owner can create a new category", async ({ page }) => {
    const restaurant = await createTestRestaurant("create-cat");

    try {
      await setAuthCookie(page, restaurant);
      await page.goto("/backoffice/menu");

      // Click "Nova categoria" to open inline form
      await page.getByRole("button", { name: "Nova categoria" }).click();

      // The input should appear
      await expect(
        page.getByPlaceholder("Nome da categoria")
      ).toBeVisible();

      // Fill in the category name
      await page.getByPlaceholder("Nome da categoria").fill("Bebidas");

      // Submit the form
      await page.getByRole("button", { name: "Salvar" }).first().click();

      // New category should appear in the list
      await expect(page.getByText("Bebidas")).toBeVisible();

      // The inline form should close and "Nova categoria" button returns
      await expect(
        page.getByRole("button", { name: "Nova categoria" })
      ).toBeVisible();
    } finally {
      await deleteTestRestaurant(restaurant.id);
    }
  });

  // ── Test 4: Edit an existing category ─────────────────────────────────────
  test("owner can edit an existing category name", async ({ page }) => {
    const restaurant = await createTestRestaurant("edit-cat");

    try {
      await prisma.category.create({
        data: {
          name: "Pratos Frios",
          restaurantId: restaurant.id,
          sortOrder: 0,
        },
      });

      await setAuthCookie(page, restaurant);
      await page.goto("/backoffice/menu");

      // Click the "Editar" button for the category
      await page
        .getByRole("button", { name: "Editar" })
        .first()
        .click();

      // Edit form input should appear with the current name
      const editInput = page.getByRole("textbox").first();
      await expect(editInput).toBeVisible();
      await editInput.fill("Pratos Quentes");

      // Save the changes
      await page.getByRole("button", { name: "Salvar" }).first().click();

      // Updated name should be visible
      await expect(page.getByText("Pratos Quentes")).toBeVisible();

      // Old name should be gone
      await expect(page.getByText("Pratos Frios")).not.toBeVisible();
    } finally {
      await deleteTestRestaurant(restaurant.id);
    }
  });

  // ── Test 5: Delete a category ──────────────────────────────────────────────
  test("owner can delete a category", async ({ page }) => {
    const restaurant = await createTestRestaurant("delete-cat");

    try {
      await prisma.category.create({
        data: {
          name: "Categoria Para Excluir",
          restaurantId: restaurant.id,
          sortOrder: 0,
        },
      });

      await setAuthCookie(page, restaurant);
      await page.goto("/backoffice/menu");

      // Category should be present initially
      await expect(
        page.getByText("Categoria Para Excluir")
      ).toBeVisible();

      // Accept the confirm dialog automatically
      page.on("dialog", (dialog) => dialog.accept());

      // Click "Excluir categoria"
      await page
        .getByRole("button", { name: "Excluir categoria" })
        .first()
        .click();

      // Category should be removed from the list
      await expect(
        page.getByText("Categoria Para Excluir")
      ).not.toBeVisible();
    } finally {
      await deleteTestRestaurant(restaurant.id);
    }
  });

  // ── Test 6: Create a new menu item under a category ───────────────────────
  test("owner can create a new menu item under a category", async ({
    page,
  }) => {
    const restaurant = await createTestRestaurant("create-item");

    try {
      await prisma.category.create({
        data: {
          name: "Sobremesas",
          restaurantId: restaurant.id,
          sortOrder: 0,
        },
      });

      await setAuthCookie(page, restaurant);
      await page.goto("/backoffice/menu");

      // Click "Novo item" button inside the category
      await page.getByRole("button", { name: "Novo item" }).first().click();

      // Fill in item name
      await page.getByPlaceholder("Nome do item").fill("Brownie");

      // Fill in price (using comma as Brazilian decimal separator)
      await page.getByPlaceholder("0,00").fill("12,50");

      // Submit the form
      await page.getByRole("button", { name: "Salvar" }).first().click();

      // Item should appear in the list
      await expect(page.getByText("Brownie")).toBeVisible();

      // Price should be formatted correctly
      await expect(page.getByText("R$ 12,50")).toBeVisible();

      // Item should have "Disponível" badge
      await expect(page.getByText("Disponível").first()).toBeVisible();
    } finally {
      await deleteTestRestaurant(restaurant.id);
    }
  });

  // ── Test 7: Edit a menu item ───────────────────────────────────────────────
  test("owner can edit a menu item name, price and availability", async ({
    page,
  }) => {
    const restaurant = await createTestRestaurant("edit-item");

    try {
      const category = await prisma.category.create({
        data: {
          name: "Lanches",
          restaurantId: restaurant.id,
          sortOrder: 0,
        },
      });

      await prisma.menuItem.create({
        data: {
          name: "Hamburguer Simples",
          priceInCents: 2000,
          categoryId: category.id,
          restaurantId: restaurant.id,
          isAvailable: true,
        },
      });

      await setAuthCookie(page, restaurant);
      await page.goto("/backoffice/menu");

      // Item should be visible with its original data
      await expect(page.getByText("Hamburguer Simples")).toBeVisible();
      await expect(page.getByText("R$ 20,00")).toBeVisible();

      // Click "Editar" for the item (aria-label contains item name)
      await page
        .getByRole("button", { name: /Editar Hamburguer Simples/i })
        .click();

      // Edit form should appear — the form is a bordered section inside the item
      // Name input: first text input inside the edit form (no placeholder in edit mode)
      const editForm = page.locator("form").filter({ has: page.getByRole("checkbox") }).first();
      await expect(editForm).toBeVisible();

      // Name input is the first text input in the edit form
      const nameInput = editForm.locator("input[type='text']").first();
      await nameInput.fill("Hamburguer Duplo");

      // Price input has placeholder "0,00"
      const priceInput = editForm.getByPlaceholder("0,00");
      await priceInput.fill("35,00");

      // Uncheck availability checkbox
      const availableCheckbox = editForm.getByRole("checkbox");
      await availableCheckbox.uncheck();

      // Save
      await page.getByRole("button", { name: "Salvar" }).first().click();

      // Updated item should be visible
      await expect(page.getByText("Hamburguer Duplo")).toBeVisible();
      await expect(page.getByText("R$ 35,00")).toBeVisible();

      // Should now show "Indisponível" badge
      await expect(page.getByText("Indisponível")).toBeVisible();

      // Old name should not be visible
      await expect(page.getByText("Hamburguer Simples")).not.toBeVisible();
    } finally {
      await deleteTestRestaurant(restaurant.id);
    }
  });

  // ── Test 8: Delete a menu item ─────────────────────────────────────────────
  test("owner can delete a menu item", async ({ page }) => {
    const restaurant = await createTestRestaurant("delete-item");

    try {
      const category = await prisma.category.create({
        data: {
          name: "Bebidas Quentes",
          restaurantId: restaurant.id,
          sortOrder: 0,
        },
      });

      await prisma.menuItem.create({
        data: {
          name: "Café Expresso",
          priceInCents: 800,
          categoryId: category.id,
          restaurantId: restaurant.id,
        },
      });

      await setAuthCookie(page, restaurant);
      await page.goto("/backoffice/menu");

      // Item should be present
      await expect(page.getByText("Café Expresso")).toBeVisible();

      // Accept the confirm dialog
      page.on("dialog", (dialog) => dialog.accept());

      // Click "Excluir" for the item (aria-label contains item name)
      await page
        .getByRole("button", { name: /Excluir Café Expresso/i })
        .click();

      // Item should be removed from the list
      await expect(page.getByText("Café Expresso")).not.toBeVisible();
    } finally {
      await deleteTestRestaurant(restaurant.id);
    }
  });
});
