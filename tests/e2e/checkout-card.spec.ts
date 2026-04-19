import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

async function seedRestaurant(suffix: string) {
  const ts = Date.now();
  const slug = `e2e-card-${suffix}-${ts}`;
  const passwordHash = await bcrypt.hash("x", 4);
  const restaurant = await prisma.restaurant.create({
    data: {
      name: `E2E Card ${suffix}`,
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
      name: "Pizza",
      priceInCents: 3500,
    },
  });
  return { restaurant };
}

test.describe("Checkout Cartão page load", () => {
  test("renders Brick container with CPF in sessionStorage", async ({
    page,
  }) => {
    const { restaurant } = await seedRestaurant("load");

    // Stub the MP SDK so the form mounts the Brick container without
    // making a real network call. The test asserts page wiring, not Brick UI.
    await page.route("https://sdk.mercadopago.com/**", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: `
          window.MercadoPago = function () {
            return {
              bricks: function () {
                return {
                  create: function () {
                    return Promise.resolve({ unmount: function () {} });
                  },
                };
              },
            };
          };
        `,
      })
    );

    await page.goto(`/${restaurant.slug}`);
    await page.getByRole("button", { name: /adicionar/i }).first().click();
    await page.getByRole("link", { name: /carrinho/i }).click();
    await page.getByRole("link", { name: /finalizar pedido/i }).click();

    await page.getByLabel("Nome").fill("Maria");
    await page.getByLabel("Telefone").fill("11999999999");
    await page.getByLabel("E-mail").fill("maria@example.com");
    await page.getByLabel("Cartão").check();
    await page.getByLabel("CPF").fill("191.191.191-00");

    await page.getByRole("button", { name: /ir para o pagamento/i }).click();

    await expect(page).toHaveURL(
      new RegExp(`/${restaurant.slug}/checkout/cartao/`)
    );
    await expect(page.locator("#cardPaymentBrick_container")).toBeAttached();

    const cpf = await page.evaluate(() => {
      const keys = Object.keys(sessionStorage);
      const cpfKey = keys.find((k) => k.endsWith("-cpf"));
      return cpfKey ? sessionStorage.getItem(cpfKey) : null;
    });
    expect(cpf).toBe("19119119100");
  });
});
