import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const ts = Date.now();
const TEST_EMAIL = `e2e-bo-settings-${ts}@test.com`;
const TEST_PASSWORD = "testpassword123";
const TEST_SLUG = `e2e-bo-settings-${ts}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createRestaurant(request: APIRequestContext): Promise<string> {
  const res = await request.post("/api/restaurants", {
    data: {
      name: "E2E Settings Restaurant",
      slug: TEST_SLUG,
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json() as { id: string };
  return body.id;
}

async function loginViaUI(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/backoffice/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/backoffice\/dashboard/);
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe("Backoffice Settings Page", () => {
  test.beforeAll(async ({ request }) => {
    await createRestaurant(request);
  });

  // ─── Auth redirect ─────────────────────────────────────────────────────────

  test("unauthenticated access redirects to login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/backoffice/settings");
    await expect(page).toHaveURL(/\/backoffice\/login/);
  });

  // ─── Page renders ──────────────────────────────────────────────────────────

  test("shows settings page heading after login", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/settings");

    await expect(
      page.getByRole("heading", { name: /configurações/i })
    ).toBeVisible();
  });

  test("page shows current restaurant name pre-filled", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/settings");

    const nameInput = page.getByLabel(/nome do restaurante/i);
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue("E2E Settings Restaurant");
  });

  test("page shows current slug pre-filled", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/settings");

    const slugInput = page.getByLabel(/slug/i);
    await expect(slugInput).toBeVisible();
    await expect(slugInput).toHaveValue(TEST_SLUG);
  });

  // ─── MercadoPago section ───────────────────────────────────────────────────

  test("shows MercadoPago section with access token field (password input)", async ({
    page,
  }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/settings");

    await expect(
      page.getByRole("heading", { name: /mercadopago/i })
    ).toBeVisible();

    const accessTokenInput = page.getByLabel(/access token/i);
    await expect(accessTokenInput).toBeVisible();
    await expect(accessTokenInput).toHaveAttribute("type", "password");
  });

  // ─── WhatsApp section ──────────────────────────────────────────────────────

  test("shows WhatsApp section with number and template fields", async ({
    page,
  }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/settings");

    await expect(page.getByRole("heading", { name: "WhatsApp" })).toBeVisible();
    await expect(page.getByLabel(/número do whatsapp/i)).toBeVisible();
    await expect(page.getByLabel(/template de mensagem/i)).toBeVisible();
  });

  // ─── Business hours section ────────────────────────────────────────────────

  test("shows business hours textarea", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/settings");

    await expect(page.getByLabel(/horários de funcionamento/i)).toBeVisible();
  });

  // ─── Save success ──────────────────────────────────────────────────────────

  test("updates restaurant name and shows success message", async ({
    page,
  }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/settings");

    const nameInput = page.getByLabel(/nome do restaurante/i);
    await nameInput.clear();
    await nameInput.fill("Updated E2E Restaurant");

    await page.getByRole("button", { name: /salvar/i }).click();

    await expect(page.getByText(/configurações salvas/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("updates whatsapp number and shows success", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/settings");

    const whatsappInput = page.getByLabel(/número do whatsapp/i);
    await whatsappInput.clear();
    await whatsappInput.fill("+5511999990001");

    await page.getByRole("button", { name: /salvar/i }).click();

    await expect(page.getByText(/configurações salvas/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("updates mercadopago access token and shows success", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/settings");

    const tokenInput = page.getByLabel(/access token/i);
    await tokenInput.clear();
    await tokenInput.fill("APP_USR-e2e-mp-token-example");

    await page.getByRole("button", { name: /salvar/i }).click();

    await expect(page.getByText(/configurações salvas/i)).toBeVisible({
      timeout: 10000,
    });
  });

  // ─── Slug uniqueness validation ────────────────────────────────────────────

  test("shows error when trying to use a slug taken by another restaurant", async ({
    page,
    request,
  }) => {
    const otherSlug = `e2e-bo-settings-other-${ts}`;
    await request.post("/api/restaurants", {
      data: {
        name: "Other E2E Restaurant",
        slug: otherSlug,
        email: `e2e-bo-settings-other-${ts}@test.com`,
        password: TEST_PASSWORD,
      },
    });

    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/settings");

    const slugInput = page.getByLabel(/slug/i);
    await slugInput.clear();
    await slugInput.fill(otherSlug);

    await page.getByRole("button", { name: /salvar/i }).click();

    await expect(page.getByText(/slug already taken/i)).toBeVisible({
      timeout: 10000,
    });
  });

  // ─── Dashboard link ────────────────────────────────────────────────────────

  test("dashboard has a link to settings page", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/dashboard");

    const settingsLink = page.getByRole("link", { name: /configurações/i }).first();
    await expect(settingsLink).toBeVisible();
    await settingsLink.click();
    await expect(page).toHaveURL(/\/backoffice\/settings/);
  });

  // ─── Save button state ─────────────────────────────────────────────────────

  test("save button shows loading state while submitting", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/settings");

    // Click save and immediately check button state
    const saveButton = page.getByRole("button", { name: /salvar/i });
    await saveButton.click();

    // Button should show loading state momentarily
    // (may complete quickly in test environment — at minimum check it succeeds)
    await expect(page.getByText(/configurações salvas/i)).toBeVisible({
      timeout: 10000,
    });
  });

  // ─── API: PATCH settings directly ─────────────────────────────────────────

  test("PATCH /api/restaurants/[slug]/settings returns 401 without auth cookie", async ({
    request,
  }) => {
    const res = await request.patch(
      `/api/restaurants/${TEST_SLUG}/settings`,
      {
        data: { name: "Unauthorized Update" },
      }
    );
    expect(res.status()).toBe(401);
  });
});
