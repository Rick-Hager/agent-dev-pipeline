import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const ts = Date.now();
const TEST_EMAIL = `e2e-bo-orders-${ts}@test.com`;
const TEST_PASSWORD = "testpassword123";
const TEST_SLUG = `e2e-bo-orders-${ts}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function createRestaurant(
  request: APIRequestContext,
  slug: string,
  email: string,
  password: string
): Promise<{ id: string; slug: string }> {
  const res = await request.post("/api/restaurants", {
    data: {
      name: "E2E Backoffice Orders Restaurant",
      slug,
      email,
      password,
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return { id: body.id as string, slug };
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

async function createMenuItem(
  request: APIRequestContext,
  slug: string,
  categoryId: string,
  name: string,
  priceInCents: number
): Promise<{ id: string }> {
  const res = await request.post(
    `/api/restaurants/${slug}/categories/${categoryId}/items`,
    { data: { name, priceInCents } }
  );
  expect(res.status()).toBe(201);
  return res.json();
}

async function createOrder(
  request: APIRequestContext,
  slug: string,
  menuItemId: string,
  customerName: string,
  status?: string
): Promise<{ id: string; orderNumber: number }> {
  const res = await request.post(`/api/restaurants/${slug}/orders`, {
    data: {
      customerName,
      customerPhone: "+5511999990000",
      customerEmail: "e2e@test.com",
      items: [{ menuItemId, quantity: 1 }],
    },
  });
  expect(res.status()).toBe(201);
  const order = await res.json();

  // Optionally advance to the requested status
  if (status && status !== "CREATED") {
    await advanceOrderToStatus(request, slug, order.id, status);
  }

  return { id: order.id, orderNumber: order.orderNumber };
}

// Advance an order through its lifecycle to reach a target status
async function advanceOrderToStatus(
  request: APIRequestContext,
  slug: string,
  orderId: string,
  targetStatus: string
): Promise<void> {
  const path = ["CREATED", "PAYMENT_PENDING", "PAYMENT_APPROVED", "PREPARING", "READY", "PICKED_UP", "CANCELLED"];
  const targetIdx = path.indexOf(targetStatus);
  if (targetIdx <= 0) return; // CREATED is initial, CANCELLED handled separately

  if (targetStatus === "CANCELLED") {
    await request.patch(`/api/restaurants/${slug}/orders/${orderId}`, {
      data: { status: "CANCELLED" },
    });
    return;
  }

  for (let i = 1; i <= targetIdx; i++) {
    const res = await request.patch(
      `/api/restaurants/${slug}/orders/${orderId}`,
      { data: { status: path[i] } }
    );
    // If it fails, the transition may not be valid — skip silently
    if (res.status() !== 200) break;
  }
}

/** Login via the UI login form and return to get an auth session. */
async function loginViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/backoffice/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/backoffice\/dashboard/);
}

// ─── Test Suite Setup ─────────────────────────────────────────────────────────

test.describe("Backoffice Orders Dashboard", () => {
  let restaurantId: string;
  let categoryId: string;
  let menuItemId: string;

  // We need >20 orders to test pagination, plus a few with different statuses
  const ORDER_NAMES = Array.from({ length: 22 }, (_, i) => `Customer ${i + 1}`);

  test.beforeAll(async ({ request }) => {
    const restaurant = await createRestaurant(
      request,
      TEST_SLUG,
      TEST_EMAIL,
      TEST_PASSWORD
    );
    restaurantId = restaurant.id;

    const category = await createCategory(request, TEST_SLUG);
    categoryId = category.id;

    const menuItem = await createMenuItem(
      request,
      TEST_SLUG,
      categoryId,
      "Burger",
      1500
    );
    menuItemId = menuItem.id;

    // Create 22 orders so we can test pagination (limit is 20 per page)
    // We create them serially to maintain predictable order numbers
    for (const name of ORDER_NAMES) {
      await createOrder(request, TEST_SLUG, menuItemId, name);
    }

    // Create a few extra orders with specific statuses for filter tests
    await createOrder(request, TEST_SLUG, menuItemId, "Status: PREPARING", "PREPARING");
    await createOrder(request, TEST_SLUG, menuItemId, "Status: CANCELLED", "CANCELLED");
    await createOrder(request, TEST_SLUG, menuItemId, "Status: READY", "READY");
  });

  test.afterAll(async ({ request }) => {
    if (restaurantId) {
      await request
        .delete(`/api/restaurants/${TEST_SLUG}`)
        .catch(() => {
          // Ignore if delete endpoint doesn't exist
        });
    }
  });

  // ─── AC 9: Auth redirect ───────────────────────────────────────────────────

  test("unauthenticated access redirects to login page", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/backoffice/orders");
    await expect(page).toHaveURL(/\/backoffice\/login/);
  });

  // ─── AC 1: Page shows a table/list of orders ──────────────────────────────

  test("shows table of orders after login", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/orders");

    // Wait for loading to finish
    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    // The table should exist with at least one order row
    const table = page.locator("table");
    await expect(table).toBeVisible();

    // Check at least one customer name is visible (use exact match to avoid "Customer 10" etc.)
    await expect(page.getByText("Customer 1", { exact: true })).toBeVisible();
  });

  // ─── AC 2: Table columns ───────────────────────────────────────────────────

  test("table has required columns: order number, customer name, items, total, status, date", async ({
    page,
  }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/orders");

    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    // Column headers (Portuguese labels from OrderTable)
    await expect(page.getByRole("columnheader", { name: "#Pedido" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Cliente" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Itens" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Total" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Status" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Data" })).toBeVisible();

    // Row content: order number (number), customer name, item summary, total in BRL
    // Order numbers are integers
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible();

    // Total column should contain a BRL price: R$ 15.00 (1500 cents)
    // The formatPrice function uses toFixed(2) which produces "15.00" (period decimal separator)
    await expect(page.getByText("R$ 15.00").first()).toBeVisible();

    // Item summary column should contain item name and quantity
    await expect(page.getByText(/Burger x1/).first()).toBeVisible();
  });

  // ─── AC 3: Filter by status ────────────────────────────────────────────────

  test("status dropdown has Todos plus all OrderStatus values", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/orders");

    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    const select = page.locator("#status-filter");
    await expect(select).toBeVisible();

    // Check "Todos" option exists (value = "")
    await expect(select.locator("option[value='']")).toHaveText("Todos");

    // Check all OrderStatus options exist
    const statuses = [
      "CREATED",
      "PAYMENT_PENDING",
      "PAYMENT_APPROVED",
      "PREPARING",
      "READY",
      "PICKED_UP",
      "CANCELLED",
    ];
    for (const s of statuses) {
      await expect(select.locator(`option[value='${s}']`)).toHaveText(s);
    }
  });

  test("filtering by PREPARING shows only orders with that status", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/orders");

    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    // Select PREPARING from the status dropdown
    const select = page.locator("#status-filter");
    await select.selectOption("PREPARING");

    // Wait for re-fetch
    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    // The PREPARING-status order should appear
    await expect(page.getByText("Status: PREPARING")).toBeVisible();

    // None of the standard "Customer N" orders (which are in CREATED) should appear
    await expect(page.getByText("Customer 1")).not.toBeVisible();
  });

  test("filtering by CANCELLED shows only cancelled orders", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/orders");

    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    const select = page.locator("#status-filter");
    await select.selectOption("CANCELLED");

    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    await expect(page.getByText("Status: CANCELLED")).toBeVisible();
    await expect(page.getByText("Customer 1")).not.toBeVisible();
  });

  // ─── AC 4: Date range filter ───────────────────────────────────────────────

  test("date range inputs exist and default to today", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/orders");

    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    const dateFrom = page.locator("#date-from");
    const dateTo = page.locator("#date-to");

    await expect(dateFrom).toBeVisible();
    await expect(dateTo).toBeVisible();

    // Both should default to today's date (YYYY-MM-DD)
    const today = new Date().toISOString().split("T")[0];
    await expect(dateFrom).toHaveValue(today);
    await expect(dateTo).toHaveValue(today);
  });

  test("setting date range to a future date returns no orders", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/orders");

    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    // Set dateFrom and dateTo far in the future
    const futureDate = "2099-01-01";
    await page.locator("#date-from").fill(futureDate);
    await page.locator("#date-to").fill(futureDate);

    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    // No orders should be shown
    await expect(page.getByText("Nenhum pedido encontrado")).toBeVisible();
  });

  // ─── AC 5 & 6: Pagination ─────────────────────────────────────────────────

  test("shows pagination controls when there are more than 20 orders", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    // Use a wide date range to see all orders
    const pastDate = "2020-01-01";
    const futureDate = "2099-12-31";
    await page.goto(
      `/backoffice/orders?dateFrom=${pastDate}&dateTo=${futureDate}`
    );

    // Wait for loading
    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    // Pagination component renders only when totalPages > 1
    // Check for the pagination text "Página X de Y"
    await expect(page.getByText(/Página \d+ de \d+/)).toBeVisible();
  });

  test("clicking Next navigates to page 2", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    const pastDate = "2020-01-01";
    const futureDate = "2099-12-31";
    await page.goto(
      `/backoffice/orders?dateFrom=${pastDate}&dateTo=${futureDate}`
    );

    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    // Ensure we have more than one page
    await expect(page.getByText(/Página 1 de/)).toBeVisible();

    // Click Next
    await page.getByRole("button", { name: "Próximo" }).click();

    // Wait for data reload
    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    // Now we should be on page 2
    await expect(page.getByText(/Página 2 de/)).toBeVisible();
  });

  test("Previous button is disabled on page 1", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    const pastDate = "2020-01-01";
    const futureDate = "2099-12-31";
    await page.goto(
      `/backoffice/orders?dateFrom=${pastDate}&dateTo=${futureDate}`
    );

    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Página 1 de/)).toBeVisible();

    const prevButton = page.getByRole("button", { name: "Anterior" });
    await expect(prevButton).toBeDisabled();
  });

  // ─── AC 7: Expandable row ─────────────────────────────────────────────────

  test("clicking an order row expands to show full order details", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/orders");

    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    // Initially no detail row should be visible
    await expect(page.locator('[data-testid="order-detail-row"]')).not.toBeVisible();

    // Click the first order row
    const firstRow = page.locator("tbody tr").first();
    await firstRow.click();

    // Now the expanded detail row should appear
    await expect(page.locator('[data-testid="order-detail-row"]')).toBeVisible();

    // The expanded section should show order detail heading
    await expect(page.getByText("Detalhes do pedido")).toBeVisible();

    // Should show item details (Burger was the item used for all test orders)
    await expect(page.getByText("Burger").first()).toBeVisible();
  });

  test("clicking an expanded row again collapses it", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/orders");

    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    const firstRow = page.locator("tbody tr").first();

    // Expand
    await firstRow.click();
    await expect(page.locator('[data-testid="order-detail-row"]')).toBeVisible();

    // Collapse
    await firstRow.click();
    await expect(page.locator('[data-testid="order-detail-row"]')).not.toBeVisible();
  });

  // ─── AC 8: Status badge color coding ─────────────────────────────────────

  test("CREATED status badge has gray styling", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/orders");

    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    // CREATED orders should show a badge with gray styling
    // STATUS_COLORS.CREATED = "bg-gray-100 text-gray-800"
    const createdBadge = page.locator("span.bg-gray-100.text-gray-800").first();
    await expect(createdBadge).toBeVisible();
    await expect(createdBadge).toHaveText("CREATED");
  });

  test("PREPARING status badge has orange styling", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/orders");

    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    // Select PREPARING to see that status badge
    const select = page.locator("#status-filter");
    await select.selectOption("PREPARING");

    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    // STATUS_COLORS.PREPARING = "bg-orange-100 text-orange-800"
    const preparingBadge = page.locator("span.bg-orange-100.text-orange-800").first();
    await expect(preparingBadge).toBeVisible();
    await expect(preparingBadge).toHaveText("PREPARING");
  });

  test("CANCELLED status badge has red styling", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/orders");

    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    // Select CANCELLED to see that status badge
    const select = page.locator("#status-filter");
    await select.selectOption("CANCELLED");

    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    // STATUS_COLORS.CANCELLED = "bg-red-100 text-red-800"
    const cancelledBadge = page.locator("span.bg-red-100.text-red-800").first();
    await expect(cancelledBadge).toBeVisible();
    await expect(cancelledBadge).toHaveText("CANCELLED");
  });

  // ─── Page heading ──────────────────────────────────────────────────────────

  test("page heading includes the restaurant slug", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/orders");

    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    // The page header renders "{slug} — Pedidos"
    await expect(
      page.getByRole("heading", { name: new RegExp(`${TEST_SLUG}`) })
    ).toBeVisible();
  });

  // ─── Empty state ──────────────────────────────────────────────────────────

  test("shows empty state message when no orders match filters", async ({ page }) => {
    await loginViaUI(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto("/backoffice/orders");

    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    // Select PAYMENT_APPROVED — none of our test orders reach that status
    const select = page.locator("#status-filter");
    await select.selectOption("PAYMENT_APPROVED");

    await expect(page.getByText("Carregando pedidos...")).not.toBeVisible({ timeout: 10000 });

    await expect(page.getByText("Nenhum pedido encontrado")).toBeVisible();
  });
});
