import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";
import { signJwt, COOKIE_NAME } from "@/lib/auth";
import bcrypt from "bcryptjs";

interface TestRestaurant {
  id: string;
  slug: string;
  email: string;
}

async function createTestRestaurant(suffix: string): Promise<TestRestaurant> {
  const ts = Date.now();
  const slug = `test-images-${suffix}-${ts}`;
  const email = `test-images-${suffix}-${ts}@test.com`;
  const passwordHash = await bcrypt.hash("password123", 10);

  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Images Test Restaurant",
      slug,
      email,
      passwordHash,
    },
  });
  return { id: restaurant.id, slug, email };
}

async function deleteTestRestaurant(id: string): Promise<void> {
  await prisma.restaurant.delete({ where: { id } }).catch(() => {});
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

test.describe("Menu item image gallery", () => {
  test("public menu shows placeholder for items without images", async ({
    page,
  }) => {
    const restaurant = await createTestRestaurant("public-placeholder");
    try {
      const category = await prisma.category.create({
        data: {
          name: "Pratos",
          restaurantId: restaurant.id,
          sortOrder: 0,
        },
      });
      await prisma.menuItem.create({
        data: {
          name: "Prato Sem Imagem",
          priceInCents: 2500,
          categoryId: category.id,
          restaurantId: restaurant.id,
        },
      });

      await page.goto(`/${restaurant.slug}`);
      await expect(page.getByText("Prato Sem Imagem")).toBeVisible();
      await expect(page.getByTestId("menu-item-placeholder")).toBeVisible();
    } finally {
      await deleteTestRestaurant(restaurant.id);
    }
  });

  test("public menu shows thumbnail when item has images, clicking opens gallery", async ({
    page,
  }) => {
    const restaurant = await createTestRestaurant("public-thumb");
    try {
      const category = await prisma.category.create({
        data: {
          name: "Pratos",
          restaurantId: restaurant.id,
          sortOrder: 0,
        },
      });
      const item = await prisma.menuItem.create({
        data: {
          name: "Prato Com Imagem",
          priceInCents: 3500,
          categoryId: category.id,
          restaurantId: restaurant.id,
        },
      });
      await prisma.menuItemImage.createMany({
        data: [
          {
            menuItemId: item.id,
            url: "https://placehold.co/600x400/png?text=1",
            sortOrder: 0,
          },
          {
            menuItemId: item.id,
            url: "https://placehold.co/600x400/png?text=2",
            sortOrder: 1,
          },
        ],
      });

      await page.goto(`/${restaurant.slug}`);
      const thumbnail = page.getByTestId("menu-item-thumbnail").first();
      await expect(thumbnail).toBeVisible();

      await thumbnail.click();

      // Gallery dialog visible
      await expect(page.getByRole("dialog")).toBeVisible();

      // There should be dot indicators
      const dots = page.getByRole("button", { name: /ir para imagem/i });
      await expect(dots).toHaveCount(2);

      // Close with Escape
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).not.toBeVisible();
    } finally {
      await deleteTestRestaurant(restaurant.id);
    }
  });

  test("backoffice shows image count indicator in item edit form", async ({
    page,
  }) => {
    const restaurant = await createTestRestaurant("count");
    try {
      const category = await prisma.category.create({
        data: {
          name: "Lanches",
          restaurantId: restaurant.id,
          sortOrder: 0,
        },
      });
      const item = await prisma.menuItem.create({
        data: {
          name: "Hambúrguer",
          priceInCents: 2500,
          categoryId: category.id,
          restaurantId: restaurant.id,
        },
      });
      await prisma.menuItemImage.create({
        data: {
          menuItemId: item.id,
          url: "https://placehold.co/600x400/png?text=1",
          sortOrder: 0,
        },
      });

      await setAuthCookie(page, restaurant);
      await page.goto("/backoffice/menu");

      await page
        .getByRole("button", { name: /Editar Hambúrguer/i })
        .click();

      await expect(page.getByTestId("image-count")).toHaveText(/1\s*\/\s*5/);
      await expect(page.getByLabel("Remover imagem").first()).toBeVisible();
    } finally {
      await deleteTestRestaurant(restaurant.id);
    }
  });

  test("backoffice can delete an image and count updates", async ({
    page,
  }) => {
    const restaurant = await createTestRestaurant("delete");
    try {
      const category = await prisma.category.create({
        data: {
          name: "Sobremesas",
          restaurantId: restaurant.id,
          sortOrder: 0,
        },
      });
      const item = await prisma.menuItem.create({
        data: {
          name: "Pudim",
          priceInCents: 1500,
          categoryId: category.id,
          restaurantId: restaurant.id,
        },
      });
      await prisma.menuItemImage.createMany({
        data: [
          {
            menuItemId: item.id,
            url: "https://placehold.co/600x400/png?text=1",
            sortOrder: 0,
          },
          {
            menuItemId: item.id,
            url: "https://placehold.co/600x400/png?text=2",
            sortOrder: 1,
          },
        ],
      });

      await setAuthCookie(page, restaurant);
      await page.goto("/backoffice/menu");

      await page.getByRole("button", { name: /Editar Pudim/i }).click();
      await expect(page.getByTestId("image-count")).toHaveText(/2\s*\/\s*5/);

      await page.getByLabel("Remover imagem").first().click();

      await expect(page.getByTestId("image-count")).toHaveText(
        /1\s*\/\s*5/,
        { timeout: 5000 }
      );

      const remaining = await prisma.menuItemImage.count({
        where: { menuItemId: item.id },
      });
      expect(remaining).toBe(1);
    } finally {
      await deleteTestRestaurant(restaurant.id);
    }
  });
});
