import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

async function seedRestaurant(suffix: string) {
  const ts = Date.now();
  const slug = `e2e-pix-${suffix}-${ts}`;
  const passwordHash = await bcrypt.hash("x", 4);
  const restaurant = await prisma.restaurant.create({
    data: {
      name: `E2E Pix ${suffix}`,
      slug,
      email: `${slug}@test.com`,
      passwordHash,
      mercadopagoAccessToken: "APP_USR_test",
      mercadopagoPublicKey: "APP_USR_pk_test",
    },
  });
  const cat = await prisma.category.create({
    data: { restaurantId: restaurant.id, name: "Pizzas" },
  });
  await prisma.menuItem.create({
    data: {
      restaurantId: restaurant.id,
      categoryId: cat.id,
      name: "Pizza Margherita",
      priceInCents: 3500,
    },
  });
  return { restaurant };
}

test.describe("Checkout PIX", () => {
  test("creates order, shows QR, polling picks up approval", async ({
    page,
  }) => {
    const { restaurant } = await seedRestaurant("happy");

    await page.route(
      `**/api/restaurants/${restaurant.slug}/orders/*/pay/pix`,
      async (route) => {
        const url = new URL(route.request().url());
        const match = url.pathname.match(/\/orders\/([^/]+)\/pay\/pix/);
        const orderId = match?.[1] ?? "";

        const body = {
          paymentId: "PAY_E2E_1",
          qrCode: "00020126PIX_E2E",
          qrCodeBase64:
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=",
          ticketUrl: "https://mp.test/e2e/1",
          expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
        };

        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: "PAYMENT_PENDING",
            paymentMethod: "PIX",
            mercadopagoPaymentId: body.paymentId,
            pixQrCode: body.qrCode,
            pixQrCodeBase64: body.qrCodeBase64,
            pixTicketUrl: body.ticketUrl,
            pixExpiresAt: new Date(body.expiresAt),
          },
        });

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      }
    );

    await page.goto(`/${restaurant.slug}`);
    await page.getByRole("button", { name: /adicionar/i }).first().click();
    await page.getByRole("link", { name: /carrinho/i }).click();
    await page.getByRole("link", { name: /finalizar pedido/i }).click();

    await page.getByLabel("Nome").fill("Maria");
    await page.getByLabel("Telefone").fill("11999999999");
    await page.getByLabel("E-mail").fill("maria@example.com");
    await page.getByLabel("PIX").check();
    await page.getByRole("button", { name: /pagar com pix/i }).click();

    await expect(page.getByAltText("QR Code PIX")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /copiar código pix/i })
    ).toBeVisible();

    const order = await prisma.order.findFirst({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: "desc" },
    });
    expect(order).not.toBeNull();
    await prisma.order.update({
      where: { id: order!.id },
      data: { status: "PAYMENT_APPROVED" },
    });

    await expect(page.getByText("Pagamento aprovado")).toBeVisible({
      timeout: 15_000,
    });
  });
});
