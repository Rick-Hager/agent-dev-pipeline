import { test, expect, type APIRequestContext } from "@playwright/test";
import Stripe from "stripe";
import { prisma } from "@/lib/db";

const WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_e2e_test_secret";

// Stripe instance used only for generating test webhook signatures.
const stripeSigner = new Stripe("sk_test_dummy_for_signing");

async function createRestaurant(
  request: APIRequestContext,
  suffix: string
): Promise<{ slug: string; id: string }> {
  const ts = Date.now();
  const slug = `e2e-pay-${suffix}-${ts}`;
  const res = await request.post("/api/restaurants", {
    data: {
      name: `E2E Payments ${suffix}`,
      slug,
      email: `e2e-pay-${suffix}-${ts}@test.com`,
      password: "secret123",
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return { slug, id: body.id as string };
}

async function createCategory(
  request: APIRequestContext,
  slug: string
): Promise<{ id: string }> {
  const res = await request.post(`/api/restaurants/${slug}/categories`, {
    data: { name: "Lanches", sortOrder: 0 },
  });
  expect(res.status()).toBe(201);
  return res.json();
}

async function createItem(
  request: APIRequestContext,
  slug: string,
  categoryId: string,
  data: { name: string; priceInCents: number; sortOrder?: number }
): Promise<{ id: string; name: string; priceInCents: number }> {
  const res = await request.post(
    `/api/restaurants/${slug}/categories/${categoryId}/items`,
    { data }
  );
  expect(res.status()).toBe(201);
  return res.json();
}

async function seedCart(
  page: import("@playwright/test").Page,
  slug: string,
  items: Array<{ id: string; name: string; priceInCents: number; quantity: number }>
) {
  await page.goto(`/${slug}`);
  await page.evaluate(
    ([cartKey, cartValue]) => {
      localStorage.setItem(cartKey, cartValue);
    },
    [`cart:${slug}`, JSON.stringify(items)]
  );
}

test.describe("Payments", () => {
  test("checkout page shows payment method radios (PIX and Cartão)", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "radios");
    const category = await createCategory(request, restaurant.slug);
    const item = await createItem(request, restaurant.slug, category.id, {
      name: "X-Salada",
      priceInCents: 1500,
      sortOrder: 1,
    });

    await seedCart(page, restaurant.slug, [
      { id: item.id, name: item.name, priceInCents: item.priceInCents, quantity: 1 },
    ]);

    await page.goto(`/${restaurant.slug}/checkout`);

    await expect(page.getByLabel(/PIX/i)).toBeVisible();
    await expect(page.getByLabel(/Cart[ãa]o/i)).toBeVisible();

    // PIX should be the default selection
    await expect(page.getByLabel(/PIX/i)).toBeChecked();
  });

  test("submitting checkout without Stripe keys still places order and redirects to pedido", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "nokeys");
    const category = await createCategory(request, restaurant.slug);
    const item = await createItem(request, restaurant.slug, category.id, {
      name: "Batata",
      priceInCents: 1000,
      sortOrder: 1,
    });

    await seedCart(page, restaurant.slug, [
      { id: item.id, name: item.name, priceInCents: item.priceInCents, quantity: 1 },
    ]);

    await page.goto(`/${restaurant.slug}/checkout`);
    await page.getByLabel("Nome").fill("João");
    await page.getByLabel("Telefone").fill("11987654321");
    await page.getByRole("button", { name: "Confirmar Pedido" }).click();

    // Since the restaurant has no Stripe keys, the checkout page
    // falls back to redirecting to the order status page.
    await expect(page).toHaveURL(new RegExp(`/${restaurant.slug}/pedido/`));
  });

  test("webhook endpoint rejects invalid signature", async ({ request }) => {
    const res = await request.post("/api/webhooks/stripe", {
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "t=1234,v1=bogus",
      },
      data: JSON.stringify({ type: "payment_intent.succeeded" }),
    });
    expect(res.status()).toBe(400);
  });

  test("payment_intent.succeeded webhook updates order status to PAYMENT_APPROVED", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "webhook-succ");
    const category = await createCategory(request, restaurant.slug);
    const item = await createItem(request, restaurant.slug, category.id, {
      name: "Combo",
      priceInCents: 2500,
      sortOrder: 1,
    });

    // Place order through the UI (without Stripe keys it redirects)
    await seedCart(page, restaurant.slug, [
      { id: item.id, name: item.name, priceInCents: item.priceInCents, quantity: 1 },
    ]);
    await page.goto(`/${restaurant.slug}/checkout`);
    await page.getByLabel("Nome").fill("Ana");
    await page.getByLabel("Telefone").fill("11988776655");
    await page.getByRole("button", { name: "Confirmar Pedido" }).click();
    await expect(page).toHaveURL(new RegExp(`/${restaurant.slug}/pedido/`));
    const orderId = page.url().split("/pedido/")[1];

    // Seed stripePaymentIntentId + PAYMENT_PENDING status directly on the
    // order to mirror the state after a successful POST /pay call. There is
    // no public API to attach a PI id without hitting real Stripe.
    const paymentIntentId = `pi_e2e_succ_${Date.now()}`;
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "PAYMENT_PENDING",
        paymentMethod: "CARD",
        stripePaymentIntentId: paymentIntentId,
      },
    });

    const payload = JSON.stringify({
      id: "evt_test_1",
      type: "payment_intent.succeeded",
      data: { object: { id: paymentIntentId } },
    });
    const signature = stripeSigner.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });

    const webhookRes = await request.post("/api/webhooks/stripe", {
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signature,
      },
      data: payload,
    });
    expect(webhookRes.status()).toBe(200);

    const updated = await prisma.order.findUnique({ where: { id: orderId } });
    expect(updated?.status).toBe("PAYMENT_APPROVED");
  });

  test("payment_intent.payment_failed webhook updates order status to CANCELLED", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "webhook-fail");
    const category = await createCategory(request, restaurant.slug);
    const item = await createItem(request, restaurant.slug, category.id, {
      name: "Suco",
      priceInCents: 700,
      sortOrder: 1,
    });

    await seedCart(page, restaurant.slug, [
      { id: item.id, name: item.name, priceInCents: item.priceInCents, quantity: 1 },
    ]);
    await page.goto(`/${restaurant.slug}/checkout`);
    await page.getByLabel("Nome").fill("Pedro");
    await page.getByLabel("Telefone").fill("11944443333");
    await page.getByRole("button", { name: "Confirmar Pedido" }).click();
    await expect(page).toHaveURL(new RegExp(`/${restaurant.slug}/pedido/`));
    const orderId = page.url().split("/pedido/")[1];

    const paymentIntentId = `pi_e2e_fail_${Date.now()}`;
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "PAYMENT_PENDING",
        paymentMethod: "PIX",
        stripePaymentIntentId: paymentIntentId,
      },
    });

    const payload = JSON.stringify({
      id: "evt_test_fail_1",
      type: "payment_intent.payment_failed",
      data: { object: { id: paymentIntentId } },
    });
    const signature = stripeSigner.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });

    const webhookRes = await request.post("/api/webhooks/stripe", {
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signature,
      },
      data: payload,
    });
    expect(webhookRes.status()).toBe(200);

    const updated = await prisma.order.findUnique({ where: { id: orderId } });
    expect(updated?.status).toBe("CANCELLED");
  });

});
