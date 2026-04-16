import { test, expect, type APIRequestContext } from "@playwright/test";

const ts = Date.now();
const TEST_EMAIL = `e2e-auth-${ts}@test.com`;
const TEST_PASSWORD = "testpassword123";
const TEST_SLUG = `e2e-auth-${ts}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function createAuthRestaurant(
  request: APIRequestContext
): Promise<{ id: string; slug: string; email: string }> {
  const res = await request.post("/api/restaurants", {
    data: {
      name: "E2E Auth Test Restaurant",
      slug: TEST_SLUG,
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return { id: body.id as string, slug: TEST_SLUG, email: TEST_EMAIL };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe("Backoffice JWT Auth", () => {
  let restaurantId: string;

  test.beforeAll(async ({ request }) => {
    const restaurant = await createAuthRestaurant(request);
    restaurantId = restaurant.id;
  });

  test.afterAll(async ({ request }) => {
    // Clean up: delete the test restaurant via API if a DELETE endpoint exists,
    // otherwise just leave it (it uses a unique timestamp slug so it won't conflict)
    if (restaurantId) {
      await request.delete(`/api/restaurants/${TEST_SLUG}`).catch(() => {
        // Ignore if delete endpoint doesn't exist
      });
    }
  });

  // Acceptance criterion 1: Login with valid credentials → redirect to /backoffice/dashboard
  test("login with valid credentials redirects to dashboard", async ({
    page,
  }) => {
    await page.goto("/backoffice/login");

    await expect(
      page.getByRole("heading", { name: "Backoffice Login" })
    ).toBeVisible();

    await page.getByLabel("Email").fill(TEST_EMAIL);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/backoffice\/dashboard/);
  });

  // Acceptance criterion 2: Login with invalid credentials → error message shown
  test("login with invalid password shows error message", async ({ page }) => {
    await page.goto("/backoffice/login");

    await page.getByLabel("Email").fill(TEST_EMAIL);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Invalid credentials")).toBeVisible();
    await expect(page).toHaveURL(/\/backoffice\/login/);
  });

  // Additional invalid credentials test: unknown email
  test("login with unknown email shows error message", async ({ page }) => {
    await page.goto("/backoffice/login");

    await page.getByLabel("Email").fill("nobody@unknown.com");
    await page.getByLabel("Password").fill("anypassword");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Invalid credentials")).toBeVisible();
    await expect(page).toHaveURL(/\/backoffice\/login/);
  });

  // Acceptance criterion 3: Accessing /backoffice/dashboard without auth → redirect to login
  test("unauthenticated access to dashboard redirects to login", async ({
    page,
  }) => {
    // Clear cookies to ensure no session exists
    await page.context().clearCookies();

    await page.goto("/backoffice/dashboard");

    await expect(page).toHaveURL(/\/backoffice\/login/);
  });

  // Acceptance criterion 4: Accessing /backoffice/dashboard while logged in → dashboard renders
  test("authenticated user can access dashboard", async ({ page }) => {
    // Log in first
    await page.goto("/backoffice/login");
    await page.getByLabel("Email").fill(TEST_EMAIL);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/backoffice\/dashboard/);

    // Dashboard should render welcome content
    await expect(
      page.getByText("Welcome to the backoffice dashboard.")
    ).toBeVisible();

    // Logout button should be visible
    await expect(
      page.getByRole("button", { name: "Logout" })
    ).toBeVisible();
  });

  // Acceptance criterion 5: Logout → redirect to login, can no longer access dashboard
  test("logout redirects to login and invalidates session", async ({
    page,
  }) => {
    // Log in
    await page.goto("/backoffice/login");
    await page.getByLabel("Email").fill(TEST_EMAIL);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/backoffice\/dashboard/);

    // Click logout
    await page.getByRole("button", { name: "Logout" }).click();

    // Should redirect to login page
    await expect(page).toHaveURL(/\/backoffice\/login/);

    // Attempting to visit dashboard again should redirect back to login
    await page.goto("/backoffice/dashboard");
    await expect(page).toHaveURL(/\/backoffice\/login/);
  });
});
