# Checkout Transparente MercadoPago Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace MercadoPago Checkout Pro (redirect) with Checkout Transparente — PIX as a custom in-app QR page and CARD via the MercadoPago Card Payment Brick, with 1× à vista only.

**Architecture:** Client calls `POST /orders` to create an order with `customerEmail`. For PIX, client calls `POST /orders/[id]/pay/pix` which creates a `/v1/payments` with `payment_method_id=pix` and persists QR code data; the order page polls until the webhook marks it approved. For CARD, client collects CPF then navigates to `/[slug]/checkout/cartao/[orderId]` where the Card Brick tokenizes the card and `POST /orders/[id]/pay/card` creates `/v1/payments` with the token. Webhook (`POST /api/webhooks/mercadopago`) already updates orders by `external_reference`. Public Key is per-restaurant, stored alongside the Access Token.

**Tech Stack:** Next.js App Router, TypeScript strict, Prisma 7 + adapter-pg, `mercadopago` SDK, Vitest, Playwright, MercadoPago Bricks JS SDK v2, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-04-18-checkout-transparente-design.md`

---

## File Structure

### Created

- `src/app/api/restaurants/[slug]/orders/[orderId]/pay/pix/route.ts` — PIX payment creation
- `src/app/api/restaurants/[slug]/orders/[orderId]/pay/card/route.ts` — Card payment creation
- `src/app/[slug]/checkout/cartao/[orderId]/page.tsx` — Card Brick page (server)
- `src/components/PixPaymentView.tsx` — QR + copia-e-cola + countdown
- `src/components/CardPaymentForm.tsx` — Card Brick wrapper (client)
- `src/types/mercadopago-brick.ts` — local Brick SDK types
- `tests/unit/mercadopago.test.ts` — rewritten for new SDK fns
- `tests/unit/pixPaymentView.test.tsx` — PIX view rendering
- `tests/unit/cpfUtils.test.ts` — CPF mask + validator
- `tests/integration/orders-pay-pix.test.ts`
- `tests/integration/orders-pay-card.test.ts`
- `tests/e2e/checkout-pix.spec.ts`
- `tests/e2e/checkout-card.spec.ts`
- `src/lib/cpfUtils.ts`

### Modified

- `prisma/schema.prisma` — Restaurant + Order fields
- `src/lib/mercadopago.ts` — replace `createOrderPreference` with `createPixPayment` + `createCardPayment`; keep `fetchPaymentStatus`
- `src/app/api/restaurants/[slug]/orders/route.ts` — accept `customerEmail`
- `src/app/api/restaurants/[slug]/orders/[orderId]/route.ts` — include PIX fields + email in GET
- `src/app/api/webhooks/mercadopago/route.ts` — drop `mercadopagoPreferenceId` reference
- `src/app/api/restaurants/[slug]/settings/route.ts` — add Public Key with joint validation
- `src/components/SettingsForm.tsx` — Public Key input
- `src/app/[slug]/checkout/page.tsx` — email + CPF conditional, two-branch submit
- `src/app/[slug]/pedido/[orderId]/page.tsx` — render PIX view conditionally
- `docs/mercadopago.md` — document the Transparente flow

### Deleted

- `src/app/api/restaurants/[slug]/orders/[orderId]/pay/route.ts` — replaced by `/pay/pix` and `/pay/card`

---

## Task 1: Database schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Public Key to Restaurant**

Edit `prisma/schema.prisma`, add this field inside the `Restaurant` model, directly after `mercadopagoAccessToken`:

```prisma
  mercadopagoAccessToken   String?
  mercadopagoPublicKey     String?
```

- [ ] **Step 2: Replace `mercadopagoPreferenceId` with PIX fields in Order**

Edit `prisma/schema.prisma`. Inside the `Order` model, **remove** the line:

```prisma
  mercadopagoPreferenceId String?
```

and **add** the following fields (place them after `mercadopagoPaymentId`):

```prisma
  customerEmail           String?
  pixQrCode               String?
  pixQrCodeBase64         String?
  pixTicketUrl            String?
  pixExpiresAt            DateTime?
```

The final `Order` model should look like:

```prisma
model Order {
  id                      String         @id @default(cuid())
  restaurantId            String
  orderNumber             Int
  customerName            String
  customerPhone           String
  status                  OrderStatus    @default(CREATED)
  paymentMethod           PaymentMethod?
  mercadopagoPaymentId    String?
  customerEmail           String?
  pixQrCode               String?
  pixQrCodeBase64         String?
  pixTicketUrl            String?
  pixExpiresAt            DateTime?
  totalInCents            Int
  createdAt               DateTime       @default(now())
  updatedAt               DateTime       @updatedAt

  restaurant Restaurant  @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  items      OrderItem[]

  @@unique([restaurantId, orderNumber])
  @@index([restaurantId])
  @@index([status])
}
```

- [ ] **Step 3: Apply schema**

Run:

```bash
npx prisma db push
npx prisma generate
```

Expected: `Your database is now in sync with your Prisma schema.` and `Generated Prisma Client`. No errors.

- [ ] **Step 4: Verify types**

Run:

```bash
npx tsc --noEmit
```

Expected: the project may show errors about `mercadopagoPreferenceId` in existing code (`pay/route.ts`, webhook, tests). Those are **expected** — they will be fixed by later tasks. Note the list but do not fix them in this task.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "refactor: add Restaurant.mercadopagoPublicKey and Order PIX fields; drop mercadopagoPreferenceId"
```

---

## Task 2: `src/lib/mercadopago.ts` — types and failing tests

**Files:**
- Modify: `src/lib/mercadopago.ts`
- Modify: `tests/unit/mercadopago.test.ts`

- [ ] **Step 1: Write failing tests for `createPixPayment` and `createCardPayment`**

Overwrite `tests/unit/mercadopago.test.ts` with the full content below. These tests cover the new SDK shape and mock the `mercadopago` package's `Payment` class.

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const paymentCreateMock = vi.fn();
const paymentGetMock = vi.fn();

vi.mock("mercadopago", () => {
  class MercadoPagoConfig {
    constructor(public readonly options: { accessToken: string }) {}
  }
  class Payment {
    constructor(public readonly client: MercadoPagoConfig) {}
    create(args: unknown) {
      return paymentCreateMock(args);
    }
    get(args: unknown) {
      return paymentGetMock(args);
    }
  }
  return { MercadoPagoConfig, Payment };
});

import {
  createPixPayment,
  createCardPayment,
  fetchPaymentStatus,
} from "@/lib/mercadopago";

describe("createPixPayment", () => {
  beforeEach(() => {
    paymentCreateMock.mockReset();
  });

  it("builds PIX payment body and returns QR + expiration", async () => {
    paymentCreateMock.mockResolvedValue({
      id: 9001,
      status: "pending",
      point_of_interaction: {
        transaction_data: {
          qr_code: "00020126PIX_COPIA",
          qr_code_base64: "iVBORw0KBASE64",
          ticket_url: "https://mercadopago.com/ticket/9001",
        },
      },
      date_of_expiration: "2026-04-19T12:00:00.000Z",
    });

    const result = await createPixPayment("APP_USR_abc", {
      orderId: "order_1",
      amountInCents: 2500,
      orderNumber: 42,
      description: "Pedido #42 — Lanche do Zé",
      customerEmail: "maria@example.com",
      customerName: "Maria",
      baseUrl: "https://menuapp.test",
    });

    expect(paymentCreateMock).toHaveBeenCalledTimes(1);
    const call = paymentCreateMock.mock.calls[0][0] as {
      body: Record<string, unknown>;
      requestOptions: { idempotencyKey: string };
    };

    expect(call.body.transaction_amount).toBe(25);
    expect(call.body.payment_method_id).toBe("pix");
    expect(call.body.external_reference).toBe("order_1");
    expect(call.body.description).toBe("Pedido #42 — Lanche do Zé");
    expect(call.body.notification_url).toBe(
      "https://menuapp.test/api/webhooks/mercadopago"
    );
    const payer = call.body.payer as Record<string, unknown>;
    expect(payer.email).toBe("maria@example.com");
    expect(payer.first_name).toBe("Maria");
    expect(typeof call.body.date_of_expiration).toBe("string");

    expect(call.requestOptions.idempotencyKey).toBe("order-order_1-pix");

    expect(result.paymentId).toBe("9001");
    expect(result.qrCode).toBe("00020126PIX_COPIA");
    expect(result.qrCodeBase64).toBe("iVBORw0KBASE64");
    expect(result.ticketUrl).toBe("https://mercadopago.com/ticket/9001");
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt.toISOString()).toBe("2026-04-19T12:00:00.000Z");
  });

  it("sets date_of_expiration ~24h in future when MP response has none", async () => {
    paymentCreateMock.mockResolvedValue({
      id: 1,
      status: "pending",
      point_of_interaction: {
        transaction_data: { qr_code: "x", qr_code_base64: "y", ticket_url: "z" },
      },
    });

    const before = Date.now();
    const result = await createPixPayment("APP_USR_abc", {
      orderId: "order_1",
      amountInCents: 1000,
      orderNumber: 1,
      description: "Pedido",
      customerEmail: "a@b.test",
      customerName: "A",
      baseUrl: "https://menuapp.test",
    });
    const diff = result.expiresAt.getTime() - before;

    expect(diff).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(diff).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 5000);
  });
});

describe("createCardPayment", () => {
  beforeEach(() => {
    paymentCreateMock.mockReset();
  });

  it("builds card payment body with token, installments=1, CPF", async () => {
    paymentCreateMock.mockResolvedValue({
      id: 1234,
      status: "approved",
      status_detail: "accredited",
    });

    const result = await createCardPayment("APP_USR_abc", {
      orderId: "order_1",
      amountInCents: 5000,
      orderNumber: 10,
      description: "Pedido #10 — Lanche",
      customerEmail: "maria@example.com",
      customerName: "Maria",
      cpf: "19119119100",
      token: "card_tok_abc",
      paymentMethodId: "visa",
      issuerId: "25",
      baseUrl: "https://menuapp.test",
    });

    expect(paymentCreateMock).toHaveBeenCalledTimes(1);
    const call = paymentCreateMock.mock.calls[0][0] as {
      body: Record<string, unknown>;
      requestOptions: { idempotencyKey: string };
    };

    expect(call.body.transaction_amount).toBe(50);
    expect(call.body.installments).toBe(1);
    expect(call.body.token).toBe("card_tok_abc");
    expect(call.body.payment_method_id).toBe("visa");
    expect(call.body.issuer_id).toBe("25");
    expect(call.body.external_reference).toBe("order_1");
    expect(call.body.notification_url).toBe(
      "https://menuapp.test/api/webhooks/mercadopago"
    );

    const payer = call.body.payer as Record<string, unknown>;
    expect(payer.email).toBe("maria@example.com");
    expect(payer.first_name).toBe("Maria");
    expect(payer.identification).toEqual({
      type: "CPF",
      number: "19119119100",
    });

    expect(call.requestOptions.idempotencyKey).toBe("order-order_1-card");

    expect(result.paymentId).toBe("1234");
    expect(result.status).toBe("approved");
    expect(result.statusDetail).toBe("accredited");
  });

  it("forces installments to 1 even if input says otherwise (not possible by type — sanity check default)", async () => {
    paymentCreateMock.mockResolvedValue({
      id: 2,
      status: "in_process",
      status_detail: "pending_review_manual",
    });

    const result = await createCardPayment("APP_USR_abc", {
      orderId: "order_x",
      amountInCents: 500,
      orderNumber: 1,
      description: "Pedido",
      customerEmail: "a@b.test",
      customerName: "A",
      cpf: "12345678901",
      token: "tok",
      paymentMethodId: "master",
      issuerId: "1",
      baseUrl: "https://menuapp.test",
    });

    const call = paymentCreateMock.mock.calls[0][0] as {
      body: { installments: number };
    };
    expect(call.body.installments).toBe(1);
    expect(result.status).toBe("in_process");
  });
});

describe("fetchPaymentStatus", () => {
  beforeEach(() => {
    paymentGetMock.mockReset();
  });

  it("returns mapped status and external_reference for an approved payment", async () => {
    paymentGetMock.mockResolvedValue({
      id: 123456,
      status: "approved",
      external_reference: "order_abc",
    });

    const result = await fetchPaymentStatus("APP_USR_abc", "123456");

    expect(paymentGetMock).toHaveBeenCalledWith({ id: "123456" });
    expect(result.status).toBe("approved");
    expect(result.externalReference).toBe("order_abc");
    expect(result.paymentId).toBe("123456");
  });

  it("passes rejected status through", async () => {
    paymentGetMock.mockResolvedValue({
      id: 999,
      status: "rejected",
      external_reference: "order_xyz",
    });

    const result = await fetchPaymentStatus("APP_USR_abc", "999");
    expect(result.status).toBe("rejected");
  });
});
```

- [ ] **Step 2: Run tests to confirm RED**

Run:

```bash
npx vitest run tests/unit/mercadopago.test.ts
```

Expected: FAIL. Tests fail because `createPixPayment` / `createCardPayment` don't exist and the module still exports `createOrderPreference`.

- [ ] **Step 3: Rewrite `src/lib/mercadopago.ts`**

Replace the entire file with:

```typescript
import { MercadoPagoConfig, Payment } from "mercadopago";

export interface CreatePixPaymentParams {
  orderId: string;
  amountInCents: number;
  orderNumber: number;
  description: string;
  customerEmail: string;
  customerName: string;
  baseUrl: string;
}

export interface CreatedPixPayment {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  expiresAt: Date;
}

export interface CreateCardPaymentParams {
  orderId: string;
  amountInCents: number;
  orderNumber: number;
  description: string;
  customerEmail: string;
  customerName: string;
  cpf: string;
  token: string;
  paymentMethodId: string;
  issuerId: string;
  baseUrl: string;
}

export interface CreatedCardPayment {
  paymentId: string;
  status: string;
  statusDetail: string;
}

export interface PaymentStatus {
  paymentId: string;
  status: string;
  externalReference: string | null;
}

function buildClient(accessToken: string): MercadoPagoConfig {
  return new MercadoPagoConfig({ accessToken });
}

export async function createPixPayment(
  accessToken: string,
  params: CreatePixPaymentParams
): Promise<CreatedPixPayment> {
  const client = buildClient(accessToken);
  const payment = new Payment(client);

  const expirationDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const response = (await payment.create({
    body: {
      transaction_amount: params.amountInCents / 100,
      description: params.description,
      payment_method_id: "pix",
      external_reference: params.orderId,
      notification_url: `${params.baseUrl}/api/webhooks/mercadopago`,
      date_of_expiration: expirationDate.toISOString(),
      payer: {
        email: params.customerEmail,
        first_name: params.customerName,
      },
    },
    requestOptions: { idempotencyKey: `order-${params.orderId}-pix` },
  })) as {
    id: number | string;
    point_of_interaction?: {
      transaction_data?: {
        qr_code?: string;
        qr_code_base64?: string;
        ticket_url?: string;
      };
    };
    date_of_expiration?: string;
  };

  const td = response.point_of_interaction?.transaction_data ?? {};

  return {
    paymentId: String(response.id),
    qrCode: td.qr_code ?? "",
    qrCodeBase64: td.qr_code_base64 ?? "",
    ticketUrl: td.ticket_url ?? "",
    expiresAt: response.date_of_expiration
      ? new Date(response.date_of_expiration)
      : expirationDate,
  };
}

export async function createCardPayment(
  accessToken: string,
  params: CreateCardPaymentParams
): Promise<CreatedCardPayment> {
  const client = buildClient(accessToken);
  const payment = new Payment(client);

  const response = (await payment.create({
    body: {
      transaction_amount: params.amountInCents / 100,
      description: params.description,
      token: params.token,
      installments: 1,
      payment_method_id: params.paymentMethodId,
      issuer_id: params.issuerId,
      external_reference: params.orderId,
      notification_url: `${params.baseUrl}/api/webhooks/mercadopago`,
      payer: {
        email: params.customerEmail,
        first_name: params.customerName,
        identification: { type: "CPF", number: params.cpf },
      },
    },
    requestOptions: { idempotencyKey: `order-${params.orderId}-card` },
  })) as {
    id: number | string;
    status: string;
    status_detail?: string;
  };

  return {
    paymentId: String(response.id),
    status: response.status,
    statusDetail: response.status_detail ?? "",
  };
}

export async function fetchPaymentStatus(
  accessToken: string,
  paymentId: string
): Promise<PaymentStatus> {
  const client = buildClient(accessToken);
  const payment = new Payment(client);
  const response = (await payment.get({ id: paymentId })) as {
    id: number | string;
    status: string;
    external_reference?: string | null;
  };

  return {
    paymentId: String(response.id),
    status: response.status,
    externalReference: response.external_reference ?? null,
  };
}
```

- [ ] **Step 4: Run tests to confirm GREEN**

Run:

```bash
npx vitest run tests/unit/mercadopago.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mercadopago.ts tests/unit/mercadopago.test.ts
git commit -m "refactor(mercadopago): replace createOrderPreference with createPixPayment + createCardPayment"
```

---

## Task 3: `POST /orders` accepts `customerEmail`

**Files:**
- Modify: `src/app/api/restaurants/[slug]/orders/route.ts`
- Modify: `tests/integration/orders.test.ts` (create if missing)

- [ ] **Step 1: Check whether an existing integration test file for orders exists**

```bash
ls tests/integration/ 2>/dev/null
```

If `orders.test.ts` exists, read it and add the new cases there. Otherwise create the file. Proceed to Step 2.

- [ ] **Step 2: Write failing test for `customerEmail`**

Create or append to `tests/integration/orders.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { POST as createOrder } from "@/app/api/restaurants/[slug]/orders/route";
import { NextRequest } from "next/server";

async function setup() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.restaurant.deleteMany();

  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Test",
      slug: "test",
      email: "t@t.com",
      passwordHash: "x",
    },
  });
  const category = await prisma.category.create({
    data: { restaurantId: restaurant.id, name: "Cat" },
  });
  const menuItem = await prisma.menuItem.create({
    data: {
      restaurantId: restaurant.id,
      categoryId: category.id,
      name: "X-Burger",
      priceInCents: 1500,
    },
  });
  return { restaurant, menuItem };
}

describe("POST /api/restaurants/[slug]/orders (email)", () => {
  beforeEach(async () => {
    await setup();
  });

  it("persists customerEmail on order", async () => {
    const { menuItem } = await setup();
    const req = new NextRequest("http://test/api/restaurants/test/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Maria",
        customerPhone: "11999999999",
        customerEmail: "maria@example.com",
        items: [{ menuItemId: menuItem.id, quantity: 1 }],
      }),
    });
    const res = await createOrder(req, {
      params: Promise.resolve({ slug: "test" }),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as { id: string };
    const order = await prisma.order.findUnique({ where: { id: data.id } });
    expect(order?.customerEmail).toBe("maria@example.com");
  });

  it("rejects invalid email with 400", async () => {
    const { menuItem } = await setup();
    const req = new NextRequest("http://test/api/restaurants/test/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Maria",
        customerPhone: "11999999999",
        customerEmail: "not-an-email",
        items: [{ menuItemId: menuItem.id, quantity: 1 }],
      }),
    });
    const res = await createOrder(req, {
      params: Promise.resolve({ slug: "test" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects missing email with 400", async () => {
    const { menuItem } = await setup();
    const req = new NextRequest("http://test/api/restaurants/test/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Maria",
        customerPhone: "11999999999",
        items: [{ menuItemId: menuItem.id, quantity: 1 }],
      }),
    });
    const res = await createOrder(req, {
      params: Promise.resolve({ slug: "test" }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run tests to confirm RED**

Run:

```bash
npx vitest run tests/integration/orders.test.ts
```

Expected: FAIL (invalid email returns 201 instead of 400, or customerEmail column not set).

- [ ] **Step 4: Accept + validate `customerEmail`**

Edit `src/app/api/restaurants/[slug]/orders/route.ts`:

1. Add email regex constant at top of file:

```typescript
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

2. Expand the body type in `POST` to include `customerEmail?: unknown`:

```typescript
const body = await request.json() as {
  customerName?: unknown;
  customerPhone?: unknown;
  customerEmail?: unknown;
  items?: unknown;
};

const { customerName, customerPhone, customerEmail, items } = body;
```

3. Add validation after the `customerPhone` check:

```typescript
if (
  !customerEmail ||
  typeof customerEmail !== "string" ||
  !EMAIL_RE.test(customerEmail)
) {
  return NextResponse.json(
    { error: "customerEmail is required and must be a valid email" },
    { status: 400 }
  );
}
```

4. In the `prisma.order.create` data block, add `customerEmail` next to `customerPhone`:

```typescript
customerPhone,
customerEmail,
```

- [ ] **Step 5: Run tests to confirm GREEN**

Run:

```bash
npx vitest run tests/integration/orders.test.ts
```

Expected: all new tests pass. Any pre-existing tests that build orders without `customerEmail` will break — update them in the same commit to include `customerEmail: "test@example.com"`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/restaurants/[slug]/orders/route.ts tests/integration/orders.test.ts
git commit -m "feat(orders): require and persist customerEmail on POST /orders"
```

---

## Task 4: New route `POST /orders/[id]/pay/pix`

**Files:**
- Create: `src/app/api/restaurants/[slug]/orders/[orderId]/pay/pix/route.ts`
- Create: `tests/integration/orders-pay-pix.test.ts`

- [ ] **Step 1: Write failing integration test**

Create `tests/integration/orders-pay-pix.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

vi.mock("@/lib/mercadopago", () => ({
  createPixPayment: vi.fn(),
  createCardPayment: vi.fn(),
  fetchPaymentStatus: vi.fn(),
}));
import * as mp from "@/lib/mercadopago";
const createPixPaymentMock = vi.mocked(mp.createPixPayment);

import { POST as payPix } from "@/app/api/restaurants/[slug]/orders/[orderId]/pay/pix/route";

async function seed(opts: {
  accessToken?: string | null;
  customerEmail?: string | null;
} = {}) {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.restaurant.deleteMany();

  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Test",
      slug: "test",
      email: "t@t.com",
      passwordHash: "x",
      mercadopagoAccessToken:
        opts.accessToken === null ? null : opts.accessToken ?? "APP_USR_token",
    },
  });
  const order = await prisma.order.create({
    data: {
      restaurantId: restaurant.id,
      orderNumber: 1,
      customerName: "Maria",
      customerPhone: "11999999999",
      customerEmail:
        opts.customerEmail === null ? null : opts.customerEmail ?? "m@e.com",
      totalInCents: 2500,
    },
  });
  return { restaurant, order };
}

describe("POST /api/restaurants/[slug]/orders/[orderId]/pay/pix", () => {
  beforeEach(() => {
    createPixPaymentMock.mockReset();
  });

  it("persists PIX fields and returns QR data on success", async () => {
    const { order } = await seed();
    createPixPaymentMock.mockResolvedValue({
      paymentId: "9001",
      qrCode: "00020126COPY",
      qrCodeBase64: "iVBOR64",
      ticketUrl: "https://mp.test/t/9001",
      expiresAt: new Date("2026-04-19T12:00:00Z"),
    });

    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}/pay/pix`,
      { method: "POST" }
    );
    const res = await payPix(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.paymentId).toBe("9001");
    expect(data.qrCode).toBe("00020126COPY");
    expect(data.qrCodeBase64).toBe("iVBOR64");
    expect(data.ticketUrl).toBe("https://mp.test/t/9001");

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated?.mercadopagoPaymentId).toBe("9001");
    expect(updated?.paymentMethod).toBe("PIX");
    expect(updated?.status).toBe("PAYMENT_PENDING");
    expect(updated?.pixQrCode).toBe("00020126COPY");
    expect(updated?.pixQrCodeBase64).toBe("iVBOR64");
    expect(updated?.pixTicketUrl).toBe("https://mp.test/t/9001");
    expect(updated?.pixExpiresAt?.toISOString()).toBe("2026-04-19T12:00:00.000Z");
  });

  it("returns 400 when restaurant has no access token", async () => {
    const { order } = await seed({ accessToken: null });
    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}/pay/pix`,
      { method: "POST" }
    );
    const res = await payPix(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });
    expect(res.status).toBe(400);
    expect(createPixPaymentMock).not.toHaveBeenCalled();
  });

  it("returns 400 when order has no customerEmail", async () => {
    const { order } = await seed({ customerEmail: null });
    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}/pay/pix`,
      { method: "POST" }
    );
    const res = await payPix(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });
    expect(res.status).toBe(400);
    expect(createPixPaymentMock).not.toHaveBeenCalled();
  });

  it("returns 502 when MP throws", async () => {
    const { order } = await seed();
    createPixPaymentMock.mockRejectedValue(new Error("MP 503"));
    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}/pay/pix`,
      { method: "POST" }
    );
    const res = await payPix(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: Run tests to confirm RED**

Run:

```bash
npx vitest run tests/integration/orders-pay-pix.test.ts
```

Expected: FAIL — module `@/app/api/restaurants/[slug]/orders/[orderId]/pay/pix/route` not found.

- [ ] **Step 3: Create the route**

Create directory and file:

```bash
mkdir -p "src/app/api/restaurants/[slug]/orders/[orderId]/pay/pix"
```

Create `src/app/api/restaurants/[slug]/orders/[orderId]/pay/pix/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { OrderStatus, PaymentMethod } from "@prisma/client";
import { createPixPayment } from "@/lib/mercadopago";

function resolveBaseUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  return request.nextUrl.origin;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; orderId: string }> }
) {
  try {
    const { slug, orderId } = await params;

    const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }
    if (!restaurant.mercadopagoAccessToken) {
      return NextResponse.json(
        { error: "Restaurant has no MercadoPago access token configured" },
        { status: 400 }
      );
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId: restaurant.id },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (!order.customerEmail) {
      return NextResponse.json(
        { error: "Order has no customerEmail" },
        { status: 400 }
      );
    }

    let pix;
    try {
      pix = await createPixPayment(restaurant.mercadopagoAccessToken, {
        orderId: order.id,
        amountInCents: order.totalInCents,
        orderNumber: order.orderNumber,
        description: `Pedido #${order.orderNumber} — ${restaurant.name}`,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        baseUrl: resolveBaseUrl(request),
      });
    } catch (mpError) {
      console.error("MercadoPago PIX creation failed:", mpError);
      return NextResponse.json(
        { error: "Payment provider error" },
        { status: 502 }
      );
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.PAYMENT_PENDING,
        paymentMethod: PaymentMethod.PIX,
        mercadopagoPaymentId: pix.paymentId,
        pixQrCode: pix.qrCode,
        pixQrCodeBase64: pix.qrCodeBase64,
        pixTicketUrl: pix.ticketUrl,
        pixExpiresAt: pix.expiresAt,
      },
    });

    return NextResponse.json({
      paymentId: pix.paymentId,
      qrCode: pix.qrCode,
      qrCodeBase64: pix.qrCodeBase64,
      ticketUrl: pix.ticketUrl,
      expiresAt: pix.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("POST /pay/pix handler error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run tests to confirm GREEN**

Run:

```bash
npx vitest run tests/integration/orders-pay-pix.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/restaurants/[slug]/orders/[orderId]/pay/pix/route.ts" tests/integration/orders-pay-pix.test.ts
git commit -m "feat(orders): add POST /orders/[id]/pay/pix"
```

---

## Task 5: New route `POST /orders/[id]/pay/card`

**Files:**
- Create: `src/app/api/restaurants/[slug]/orders/[orderId]/pay/card/route.ts`
- Create: `tests/integration/orders-pay-card.test.ts`

- [ ] **Step 1: Write failing integration test**

Create `tests/integration/orders-pay-card.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

vi.mock("@/lib/mercadopago", () => ({
  createPixPayment: vi.fn(),
  createCardPayment: vi.fn(),
  fetchPaymentStatus: vi.fn(),
}));
import * as mp from "@/lib/mercadopago";
const createCardPaymentMock = vi.mocked(mp.createCardPayment);

import { POST as payCard } from "@/app/api/restaurants/[slug]/orders/[orderId]/pay/card/route";

async function seed(opts: { accessToken?: string | null } = {}) {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.restaurant.deleteMany();

  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Test",
      slug: "test",
      email: "t@t.com",
      passwordHash: "x",
      mercadopagoAccessToken:
        opts.accessToken === null ? null : opts.accessToken ?? "APP_USR_token",
    },
  });
  const order = await prisma.order.create({
    data: {
      restaurantId: restaurant.id,
      orderNumber: 1,
      customerName: "Maria",
      customerPhone: "11999999999",
      customerEmail: "maria@example.com",
      totalInCents: 5000,
    },
  });
  return { restaurant, order };
}

function validBody() {
  return {
    token: "card_tok_abc",
    paymentMethodId: "visa",
    issuerId: "25",
    installments: 1,
    cpf: "19119119100",
  };
}

describe("POST /api/restaurants/[slug]/orders/[orderId]/pay/card", () => {
  beforeEach(() => {
    createCardPaymentMock.mockReset();
  });

  it("approves order on MP approved and returns 200", async () => {
    const { order } = await seed();
    createCardPaymentMock.mockResolvedValue({
      paymentId: "1234",
      status: "approved",
      statusDetail: "accredited",
    });

    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}/pay/card`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody()),
      }
    );
    const res = await payCard(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { status: string };
    expect(data.status).toBe("approved");

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated?.status).toBe("PAYMENT_APPROVED");
    expect(updated?.mercadopagoPaymentId).toBe("1234");
    expect(updated?.paymentMethod).toBe("CARD");
  });

  it("sets PAYMENT_PENDING on in_process", async () => {
    const { order } = await seed();
    createCardPaymentMock.mockResolvedValue({
      paymentId: "2",
      status: "in_process",
      statusDetail: "pending_review_manual",
    });
    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}/pay/card`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody()),
      }
    );
    const res = await payCard(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });
    expect(res.status).toBe(200);
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated?.status).toBe("PAYMENT_PENDING");
  });

  it("returns 402 and cancels on rejected", async () => {
    const { order } = await seed();
    createCardPaymentMock.mockResolvedValue({
      paymentId: "3",
      status: "rejected",
      statusDetail: "cc_rejected_other_reason",
    });
    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}/pay/card`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody()),
      }
    );
    const res = await payCard(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });
    expect(res.status).toBe(402);
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated?.status).toBe("CANCELLED");
  });

  it("returns 400 without token", async () => {
    const { order } = await seed();
    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}/pay/card`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody(), token: "" }),
      }
    );
    const res = await payCard(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid CPF", async () => {
    const { order } = await seed();
    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}/pay/card`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody(), cpf: "123" }),
      }
    );
    const res = await payCard(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 without access token", async () => {
    const { order } = await seed({ accessToken: null });
    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}/pay/card`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody()),
      }
    );
    const res = await payCard(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to confirm RED**

```bash
npx vitest run tests/integration/orders-pay-card.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the route**

```bash
mkdir -p "src/app/api/restaurants/[slug]/orders/[orderId]/pay/card"
```

Create `src/app/api/restaurants/[slug]/orders/[orderId]/pay/card/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { OrderStatus, PaymentMethod } from "@prisma/client";
import { createCardPayment } from "@/lib/mercadopago";

function resolveBaseUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  return request.nextUrl.origin;
}

function mapMpStatusToOrderStatus(mpStatus: string): OrderStatus {
  if (mpStatus === "approved") return OrderStatus.PAYMENT_APPROVED;
  if (mpStatus === "rejected" || mpStatus === "cancelled") {
    return OrderStatus.CANCELLED;
  }
  return OrderStatus.PAYMENT_PENDING;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; orderId: string }> }
) {
  try {
    const { slug, orderId } = await params;

    const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }
    if (!restaurant.mercadopagoAccessToken) {
      return NextResponse.json(
        { error: "Restaurant has no MercadoPago access token configured" },
        { status: 400 }
      );
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId: restaurant.id },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (!order.customerEmail) {
      return NextResponse.json(
        { error: "Order has no customerEmail" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as {
      token?: unknown;
      paymentMethodId?: unknown;
      issuerId?: unknown;
      cpf?: unknown;
    };

    if (typeof body.token !== "string" || body.token.length === 0) {
      return NextResponse.json(
        { error: "token is required" },
        { status: 400 }
      );
    }
    if (typeof body.paymentMethodId !== "string" || body.paymentMethodId.length === 0) {
      return NextResponse.json(
        { error: "paymentMethodId is required" },
        { status: 400 }
      );
    }
    if (typeof body.issuerId !== "string" || body.issuerId.length === 0) {
      return NextResponse.json(
        { error: "issuerId is required" },
        { status: 400 }
      );
    }
    if (typeof body.cpf !== "string" || !/^\d{11}$/.test(body.cpf)) {
      return NextResponse.json(
        { error: "cpf must be 11 digits" },
        { status: 400 }
      );
    }

    let card;
    try {
      card = await createCardPayment(restaurant.mercadopagoAccessToken, {
        orderId: order.id,
        amountInCents: order.totalInCents,
        orderNumber: order.orderNumber,
        description: `Pedido #${order.orderNumber} — ${restaurant.name}`,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        cpf: body.cpf,
        token: body.token,
        paymentMethodId: body.paymentMethodId,
        issuerId: body.issuerId,
        baseUrl: resolveBaseUrl(request),
      });
    } catch (mpError) {
      console.error("MercadoPago card creation failed:", mpError);
      return NextResponse.json(
        { error: "Payment provider error" },
        { status: 502 }
      );
    }

    const nextStatus = mapMpStatusToOrderStatus(card.status);

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: nextStatus,
        paymentMethod: PaymentMethod.CARD,
        mercadopagoPaymentId: card.paymentId,
      },
    });

    const httpStatus = nextStatus === OrderStatus.CANCELLED ? 402 : 200;
    return NextResponse.json(
      {
        paymentId: card.paymentId,
        status: card.status,
        statusDetail: card.statusDetail,
      },
      { status: httpStatus }
    );
  } catch (error) {
    console.error("POST /pay/card handler error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run tests to confirm GREEN**

```bash
npx vitest run tests/integration/orders-pay-card.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/restaurants/[slug]/orders/[orderId]/pay/card/route.ts" tests/integration/orders-pay-card.test.ts
git commit -m "feat(orders): add POST /orders/[id]/pay/card"
```

---

## Task 6: Extend `GET /orders/[id]` with PIX fields + email (no change needed beyond verifying)

**Files:**
- Verify: `src/app/api/restaurants/[slug]/orders/[orderId]/route.ts`

The current `GET` handler does `NextResponse.json(order)` which already includes all Prisma columns, so new fields (`customerEmail`, `pixQrCode`, `pixQrCodeBase64`, `pixTicketUrl`, `pixExpiresAt`) are returned automatically. This task is a verification step.

- [ ] **Step 1: Write a test for the GET response shape**

Create `tests/integration/orders-get.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { GET as getOrder } from "@/app/api/restaurants/[slug]/orders/[orderId]/route";

async function seed() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.restaurant.deleteMany();
  const r = await prisma.restaurant.create({
    data: {
      name: "Test",
      slug: "test",
      email: "t@t.com",
      passwordHash: "x",
    },
  });
  const order = await prisma.order.create({
    data: {
      restaurantId: r.id,
      orderNumber: 1,
      customerName: "Maria",
      customerPhone: "11",
      customerEmail: "m@e.com",
      totalInCents: 1000,
      pixQrCode: "QRCODE",
      pixQrCodeBase64: "QRB64",
      pixTicketUrl: "https://mp/t/1",
      pixExpiresAt: new Date("2026-04-19T12:00:00Z"),
    },
  });
  return { order };
}

describe("GET /api/restaurants/[slug]/orders/[orderId] — PIX fields", () => {
  beforeEach(async () => {
    await seed();
  });

  it("includes PIX fields and customerEmail in response", async () => {
    const { order } = await seed();
    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}`
    );
    const res = await getOrder(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.customerEmail).toBe("m@e.com");
    expect(data.pixQrCode).toBe("QRCODE");
    expect(data.pixQrCodeBase64).toBe("QRB64");
    expect(data.pixTicketUrl).toBe("https://mp/t/1");
    expect(data.pixExpiresAt).toBe("2026-04-19T12:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run test, expect PASS (no implementation change needed)**

```bash
npx vitest run tests/integration/orders-get.test.ts
```

Expected: all tests pass. If they do not, check that Task 1 schema changes were applied.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/orders-get.test.ts
git commit -m "test(orders): assert GET /orders/[id] returns PIX fields and email"
```

---

## Task 7: Update webhook to drop `mercadopagoPreferenceId`

**Files:**
- Modify: `src/app/api/webhooks/mercadopago/route.ts`
- Modify: any existing webhook tests (search first)

- [ ] **Step 1: Search for `mercadopagoPreferenceId` references**

```bash
grep -rn "mercadopagoPreferenceId" src tests 2>/dev/null
```

List each location. At the time of writing the spec, the webhook at `src/app/api/webhooks/mercadopago/route.ts` does NOT reference `mercadopagoPreferenceId` — but tests or other code may. Fix every reference found so the file compiles against the new schema.

- [ ] **Step 2: Remove dead references**

For every file containing `mercadopagoPreferenceId`:
- If it's a test seeding an order: remove the column from `prisma.order.create` data.
- If it's the deleted `pay/route.ts` — ignore (Task 8 deletes it).
- If any other code writes it: delete the line.

- [ ] **Step 3: Run the webhook tests**

```bash
npx vitest run tests/integration/webhooks-mercadopago.test.ts 2>/dev/null || npx vitest run --dir tests
```

Expected: webhook tests pass. If no webhook test exists yet, this step is a no-op.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors in webhook file.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(webhook): remove mercadopagoPreferenceId references"
```

---

## Task 8: Delete legacy `POST /pay` route

**Files:**
- Delete: `src/app/api/restaurants/[slug]/orders/[orderId]/pay/route.ts`

- [ ] **Step 1: Delete file**

```bash
rm "src/app/api/restaurants/[slug]/orders/[orderId]/pay/route.ts"
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. If any code still imports from that path, remove those imports.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove legacy POST /orders/[id]/pay route (replaced by /pay/pix and /pay/card)"
```

---

## Task 9: Settings API — Public Key with joint validation

**Files:**
- Modify: `src/app/api/restaurants/[slug]/settings/route.ts`
- Modify: `tests/integration/settings.test.ts` (create if missing)

- [ ] **Step 1: Write failing test**

Create or append to `tests/integration/settings.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { PATCH as patchSettings, GET as getSettings } from "@/app/api/restaurants/[slug]/settings/route";
import { signJwt, COOKIE_NAME } from "@/lib/auth";

async function seed(opts: {
  accessToken?: string | null;
  publicKey?: string | null;
} = {}) {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.restaurant.deleteMany();
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Test",
      slug: "test",
      email: "t@t.com",
      passwordHash: "x",
      mercadopagoAccessToken: opts.accessToken ?? null,
      mercadopagoPublicKey: opts.publicKey ?? null,
    },
  });
  const token = await signJwt({
    restaurantId: restaurant.id,
    slug: restaurant.slug,
    email: restaurant.email,
  });
  return { restaurant, token };
}

function authed(url: string, init: RequestInit, token: string): NextRequest {
  const req = new NextRequest(url, init);
  req.cookies.set(COOKIE_NAME, token);
  return req;
}

describe("PATCH /api/restaurants/[slug]/settings — MP Public Key", () => {
  it("accepts accessToken and publicKey together", async () => {
    const { token } = await seed();
    const req = authed(
      "http://test/api/restaurants/test/settings",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mercadopagoAccessToken: "APP_USR_abc",
          mercadopagoPublicKey: "APP_USR_pk_xyz",
        }),
      },
      token
    );
    const res = await patchSettings(req, {
      params: Promise.resolve({ slug: "test" }),
    });
    expect(res.status).toBe(200);
  });

  it("rejects setting only accessToken without publicKey (400)", async () => {
    const { token } = await seed();
    const req = authed(
      "http://test/api/restaurants/test/settings",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mercadopagoAccessToken: "APP_USR_abc",
        }),
      },
      token
    );
    const res = await patchSettings(req, {
      params: Promise.resolve({ slug: "test" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects setting only publicKey without accessToken (400)", async () => {
    const { token } = await seed();
    const req = authed(
      "http://test/api/restaurants/test/settings",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mercadopagoPublicKey: "APP_USR_pk_xyz",
        }),
      },
      token
    );
    const res = await patchSettings(req, {
      params: Promise.resolve({ slug: "test" }),
    });
    expect(res.status).toBe(400);
  });

  it("allows patching other fields when both MP fields already exist", async () => {
    const { token } = await seed({
      accessToken: "APP_USR_existing",
      publicKey: "APP_USR_pk_existing",
    });
    const req = authed(
      "http://test/api/restaurants/test/settings",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      },
      token
    );
    const res = await patchSettings(req, {
      params: Promise.resolve({ slug: "test" }),
    });
    expect(res.status).toBe(200);
  });

  it("GET returns masked publicKey alongside masked accessToken", async () => {
    const { token } = await seed({
      accessToken: "APP_USR_abcdefgh1234",
      publicKey: "APP_USR_pk_ijklmnop5678",
    });
    const req = authed(
      "http://test/api/restaurants/test/settings",
      { method: "GET" },
      token
    );
    const res = await getSettings(req, {
      params: Promise.resolve({ slug: "test" }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.mercadopagoAccessTokenMasked).toBe("****1234");
    expect(data.mercadopagoPublicKeyMasked).toBe("****5678");
  });
});
```

> Auth helper exports used: `signJwt(payload)` and `COOKIE_NAME` (= `"restaurant_session"`). JWT payload requires `restaurantId`, `slug`, `email`.

- [ ] **Step 2: Run tests to confirm RED**

```bash
npx vitest run tests/integration/settings.test.ts
```

Expected: FAIL (400 not returned for missing counterpart; `mercadopagoPublicKeyMasked` absent).

- [ ] **Step 3: Update settings route**

Edit `src/app/api/restaurants/[slug]/settings/route.ts`:

1. Add `mercadopagoPublicKeyMasked` to the `GET` response:

Replace the existing `NextResponse.json({ ...restaurant... })` block inside `GET` with:

```typescript
return NextResponse.json({
  id: restaurant.id,
  name: restaurant.name,
  slug: restaurant.slug,
  logo: restaurant.logo,
  email: restaurant.email,
  businessHours: restaurant.businessHours,
  mercadopagoAccessTokenMasked: maskSecret(restaurant.mercadopagoAccessToken),
  mercadopagoPublicKeyMasked: maskSecret(restaurant.mercadopagoPublicKey),
  whatsappNumber: restaurant.whatsappNumber,
  whatsappMessageTemplate: restaurant.whatsappMessageTemplate,
  updatedAt: restaurant.updatedAt,
});
```

2. In `PATCH`, after the current `mercadopagoAccessToken` validation block, add a symmetric block for the public key, plus a joint-validation guard. Replace the current `mercadopagoAccessToken` block with this combined block:

```typescript
const accessTokenInput = input.mercadopagoAccessToken;
const publicKeyInput = input.mercadopagoPublicKey;
const patchingAccess = accessTokenInput !== undefined;
const patchingPublic = publicKeyInput !== undefined;

if (patchingAccess !== patchingPublic) {
  return NextResponse.json(
    {
      error:
        "mercadopagoAccessToken and mercadopagoPublicKey must be provided together",
    },
    { status: 400 }
  );
}

if (patchingAccess && patchingPublic) {
  if (typeof accessTokenInput !== "string") {
    return NextResponse.json(
      { error: "mercadopagoAccessToken must be a string" },
      { status: 400 }
    );
  }
  if (typeof publicKeyInput !== "string") {
    return NextResponse.json(
      { error: "mercadopagoPublicKey must be a string" },
      { status: 400 }
    );
  }
  const at = accessTokenInput.trim();
  const pk = publicKeyInput.trim();
  if (at.length === 0 || pk.length === 0) {
    return NextResponse.json(
      {
        error:
          "mercadopagoAccessToken and mercadopagoPublicKey cannot be empty",
      },
      { status: 400 }
    );
  }
  updateData.mercadopagoAccessToken = at;
  updateData.mercadopagoPublicKey = pk;
}
```

3. Update `SAFE_SELECT` to include the new column so the response after update contains it (not strictly required for tests, but keeps shape consistent):

```typescript
const SAFE_SELECT = {
  id: true,
  name: true,
  slug: true,
  logo: true,
  email: true,
  businessHours: true,
  whatsappNumber: true,
  whatsappMessageTemplate: true,
  updatedAt: true,
} as const;
```

(No change — leave as-is; mask is applied in GET only.)

- [ ] **Step 4: Run tests to confirm GREEN**

```bash
npx vitest run tests/integration/settings.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/restaurants/[slug]/settings/route.ts" tests/integration/settings.test.ts
git commit -m "feat(settings): accept mercadopagoPublicKey jointly with accessToken"
```

---

## Task 10: SettingsForm — Public Key input

**Files:**
- Modify: `src/components/SettingsForm.tsx`
- Modify: `src/app/backoffice/(protected)/settings/page.tsx` (passes `initialSettings` to `<SettingsForm>`)

- [ ] **Step 1: Open the settings page**

Read `src/app/backoffice/(protected)/settings/page.tsx`. It builds `initialSettings` server-side from a direct Prisma query (not from the GET API), masking `mercadopagoAccessToken` locally. You will add a parallel mask for `mercadopagoPublicKey`.

- [ ] **Step 2: Extend `SettingsData` and form state**

Edit `src/components/SettingsForm.tsx`:

1. Add to `SettingsData`:

```typescript
export interface SettingsData {
  id: string;
  name: string;
  slug: string;
  logo: string;
  email: string;
  businessHours: string;
  mercadopagoAccessTokenMasked: string | null;
  mercadopagoPublicKeyMasked: string | null;
  whatsappNumber: string;
  whatsappMessageTemplate: string;
}
```

2. Add the new form field to `useState`:

```typescript
const [form, setForm] = useState({
  name: initialSettings.name,
  slug: initialSettings.slug,
  logo: initialSettings.logo,
  businessHours: initialSettings.businessHours,
  mercadopagoAccessToken: "",
  mercadopagoPublicKey: "",
  whatsappNumber: initialSettings.whatsappNumber,
  whatsappMessageTemplate: initialSettings.whatsappMessageTemplate,
});
```

3. In the submit body builder, include both MP fields jointly. Replace:

```typescript
if (form.mercadopagoAccessToken.length > 0) {
  body.mercadopagoAccessToken = form.mercadopagoAccessToken;
}
```

with:

```typescript
const hasAccess = form.mercadopagoAccessToken.length > 0;
const hasPublic = form.mercadopagoPublicKey.length > 0;
if (hasAccess !== hasPublic) {
  setError(
    "Informe Access Token e Public Key juntos (os dois ou nenhum)."
  );
  setLoading(false);
  return;
}
if (hasAccess && hasPublic) {
  body.mercadopagoAccessToken = form.mercadopagoAccessToken;
  body.mercadopagoPublicKey = form.mercadopagoPublicKey;
}
```

4. In the MercadoPago JSX section, after the Access Token input block, add a mirrored Public Key block. Full replacement of the MercadoPago `<section>`:

```tsx
{/* MercadoPago */}
<section className="bg-white rounded-lg shadow p-6 space-y-4">
  <h2 className="text-lg font-semibold text-gray-900">MercadoPago</h2>
  <p className="text-sm text-gray-600">
    Informe Access Token e Public Key do MercadoPago. Os dois são necessários
    para o checkout funcionar.
  </p>

  <div>
    <label
      htmlFor="mercadopagoAccessToken"
      className="block text-sm font-medium text-gray-700"
    >
      Access Token
      {initialSettings.mercadopagoAccessTokenMasked && (
        <span className="ml-2 text-gray-400 text-xs font-mono font-normal">
          (atual: {initialSettings.mercadopagoAccessTokenMasked})
        </span>
      )}
    </label>
    <input
      id="mercadopagoAccessToken"
      name="mercadopagoAccessToken"
      type="password"
      value={form.mercadopagoAccessToken}
      onChange={handleChange}
      placeholder={
        initialSettings.mercadopagoAccessTokenMasked
          ? "Digite para alterar"
          : "APP_USR_..."
      }
      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
    />
  </div>

  <div>
    <label
      htmlFor="mercadopagoPublicKey"
      className="block text-sm font-medium text-gray-700"
    >
      Public Key
      {initialSettings.mercadopagoPublicKeyMasked && (
        <span className="ml-2 text-gray-400 text-xs font-mono font-normal">
          (atual: {initialSettings.mercadopagoPublicKeyMasked})
        </span>
      )}
    </label>
    <input
      id="mercadopagoPublicKey"
      name="mercadopagoPublicKey"
      type="password"
      value={form.mercadopagoPublicKey}
      onChange={handleChange}
      placeholder={
        initialSettings.mercadopagoPublicKeyMasked
          ? "Digite para alterar"
          : "APP_USR_pk_..."
      }
      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
    />
  </div>
</section>
```

- [ ] **Step 3: Update the settings page to pass the new prop**

Edit `src/app/backoffice/(protected)/settings/page.tsx`:

1. Add `mercadopagoPublicKey: true` to the `select` object inside `prisma.restaurant.findUnique`:

```typescript
select: {
  id: true,
  name: true,
  slug: true,
  logo: true,
  email: true,
  businessHours: true,
  mercadopagoAccessToken: true,
  mercadopagoPublicKey: true,
  whatsappNumber: true,
  whatsappMessageTemplate: true,
},
```

2. Add `mercadopagoPublicKeyMasked` to `initialSettings`:

```typescript
const initialSettings: SettingsData = {
  id: restaurant.id,
  name: restaurant.name,
  slug: restaurant.slug,
  logo: restaurant.logo ?? "",
  email: restaurant.email,
  businessHours: restaurant.businessHours
    ? JSON.stringify(restaurant.businessHours, null, 2)
    : "",
  mercadopagoAccessTokenMasked: maskSecret(restaurant.mercadopagoAccessToken),
  mercadopagoPublicKeyMasked: maskSecret(restaurant.mercadopagoPublicKey),
  whatsappNumber: restaurant.whatsappNumber ?? "",
  whatsappMessageTemplate: restaurant.whatsappMessageTemplate ?? "",
};
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsForm.tsx src/app
git commit -m "feat(settings-form): add MercadoPago Public Key field with joint validation"
```

---

## Task 11: CPF utilities + unit tests

**Files:**
- Create: `src/lib/cpfUtils.ts`
- Create: `tests/unit/cpfUtils.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/cpfUtils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { maskCpf, isValidCpf, stripCpf } from "@/lib/cpfUtils";

describe("maskCpf", () => {
  it("formats as 999.999.999-99", () => {
    expect(maskCpf("19119119100")).toBe("191.191.191-00");
  });
  it("keeps partial mask for incomplete input", () => {
    expect(maskCpf("1911911")).toBe("191.191.1");
  });
  it("strips non-digits before masking", () => {
    expect(maskCpf("191-191 191/00")).toBe("191.191.191-00");
  });
});

describe("stripCpf", () => {
  it("returns only digits", () => {
    expect(stripCpf("191.191.191-00")).toBe("19119119100");
  });
});

describe("isValidCpf", () => {
  it("accepts 11-digit strings", () => {
    expect(isValidCpf("19119119100")).toBe(true);
    expect(isValidCpf("191.191.191-00")).toBe(true);
  });
  it("rejects shorter input", () => {
    expect(isValidCpf("1911911910")).toBe(false);
  });
  it("rejects empty input", () => {
    expect(isValidCpf("")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to confirm RED**

```bash
npx vitest run tests/unit/cpfUtils.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the module**

Create `src/lib/cpfUtils.ts`:

```typescript
export function stripCpf(value: string): string {
  return value.replace(/\D/g, "");
}

export function maskCpf(value: string): string {
  const digits = stripCpf(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function isValidCpf(value: string): boolean {
  return stripCpf(value).length === 11;
}
```

> Note: we do NOT check CPF verifier digits — MP validates that server-side. This matches the spec.

- [ ] **Step 4: Run test to confirm GREEN**

```bash
npx vitest run tests/unit/cpfUtils.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cpfUtils.ts tests/unit/cpfUtils.test.ts
git commit -m "feat(cpf): add CPF mask + 11-digit validator"
```

---

## Task 12: Checkout page — email + CPF conditional + branched submit

**Files:**
- Modify: `src/app/[slug]/checkout/page.tsx`

Since this is a client-side UI change with no pure unit tests beyond an existing component test suite, we rely on E2E (Task 16) to validate the flow, and type-checking + ESLint to validate the implementation here.

- [ ] **Step 1: Rewrite the checkout page**

Replace the entire content of `src/app/[slug]/checkout/page.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { maskCpf, isValidCpf, stripCpf } from "@/lib/cpfUtils";

function formatPrice(priceInCents: number): string {
  return `R$ ${(priceInCents / 100).toFixed(2).replace(".", ",")}`;
}

function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PaymentMethod = "PIX" | "CARD";

export default function CheckoutPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const { items, totalInCents, clearCart } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  const [cpf, setCpf] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [apiError, setApiError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (items.length === 0) {
    return (
      <main className="max-w-lg mx-auto p-4">
        <p>Seu carrinho está vazio.</p>
        <Link href={`/${slug}`} className="text-zinc-600 underline">
          Ver cardápio
        </Link>
      </main>
    );
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCustomerPhone(applyPhoneMask(e.target.value));
    setFieldError("");
  }

  function handleCpfChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCpf(maskCpf(e.target.value));
    setFieldError("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const rawPhone = customerPhone.replace(/\D/g, "");
    if (rawPhone.length < 10) {
      setFieldError("Telefone inválido");
      return;
    }
    if (!EMAIL_RE.test(customerEmail)) {
      setFieldError("E-mail inválido");
      return;
    }
    if (paymentMethod === "CARD" && !isValidCpf(cpf)) {
      setFieldError("CPF inválido");
      return;
    }

    setApiError("");
    setIsSubmitting(true);
    try {
      const orderRes = await fetch(`/api/restaurants/${slug}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone: rawPhone,
          customerEmail,
          items: items.map((i) => ({ menuItemId: i.id, quantity: i.quantity })),
        }),
      });
      if (!orderRes.ok) {
        setApiError("Erro ao realizar pedido. Tente novamente.");
        return;
      }
      const order = (await orderRes.json()) as { id: string; orderNumber: number };

      if (paymentMethod === "PIX") {
        const payRes = await fetch(
          `/api/restaurants/${slug}/orders/${order.id}/pay/pix`,
          { method: "POST" }
        );
        if (!payRes.ok) {
          setApiError("Não foi possível gerar o PIX. Tente novamente.");
          return;
        }
        clearCart();
        router.push(`/${slug}/pedido/${order.id}`);
        return;
      }

      // CARD
      if (typeof window !== "undefined") {
        sessionStorage.setItem(`order-${order.id}-cpf`, stripCpf(cpf));
      }
      clearCart();
      router.push(`/${slug}/checkout/cartao/${order.id}`);
    } catch {
      setApiError("Erro ao realizar pedido. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <Link href={`/${slug}/cart`} className="text-zinc-600 underline block mb-4">
        ← Voltar ao carrinho
      </Link>

      <h1 className="text-2xl font-bold mb-6">Resumo do pedido</h1>

      <ul className="space-y-3 mb-4">
        {items.map((item) => (
          <li key={item.id} className="flex justify-between text-sm">
            <span>
              {item.name} × {item.quantity}
            </span>
            <span className="flex gap-4">
              <span className="text-zinc-500">{formatPrice(item.priceInCents)}</span>
              <span className="font-medium">{formatPrice(item.priceInCents * item.quantity)}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="flex justify-between font-bold text-lg border-t pt-3 mb-6">
        <span>Total</span>
        <span>{formatPrice(totalInCents)}</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="customerName" className="font-medium">Nome</label>
          <input
            id="customerName"
            name="customerName"
            type="text"
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="border rounded-md px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="customerPhone" className="font-medium">Telefone</label>
          <input
            id="customerPhone"
            name="customerPhone"
            type="tel"
            required
            value={customerPhone}
            onChange={handlePhoneChange}
            placeholder="(11) 99999-9999"
            className="border rounded-md px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="customerEmail" className="font-medium">E-mail</label>
          <input
            id="customerEmail"
            name="customerEmail"
            type="email"
            required
            value={customerEmail}
            onChange={(e) => {
              setCustomerEmail(e.target.value);
              setFieldError("");
            }}
            placeholder="voce@exemplo.com"
            className="border rounded-md px-3 py-2"
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="font-medium mb-1">Forma de pagamento</legend>
          <label htmlFor="pm-pix" className="flex items-center gap-2 cursor-pointer">
            <input
              id="pm-pix"
              type="radio"
              name="paymentMethod"
              value="PIX"
              checked={paymentMethod === "PIX"}
              onChange={() => setPaymentMethod("PIX")}
            />
            <span>PIX</span>
          </label>
          <label htmlFor="pm-card" className="flex items-center gap-2 cursor-pointer">
            <input
              id="pm-card"
              type="radio"
              name="paymentMethod"
              value="CARD"
              checked={paymentMethod === "CARD"}
              onChange={() => setPaymentMethod("CARD")}
            />
            <span>Cartão</span>
          </label>
        </fieldset>

        {paymentMethod === "CARD" && (
          <div className="flex flex-col gap-1">
            <label htmlFor="cpf" className="font-medium">CPF</label>
            <input
              id="cpf"
              name="cpf"
              type="text"
              required
              inputMode="numeric"
              value={cpf}
              onChange={handleCpfChange}
              placeholder="000.000.000-00"
              className="border rounded-md px-3 py-2"
            />
          </div>
        )}

        {fieldError && <p className="text-red-600 text-sm">{fieldError}</p>}
        {apiError && <p className="text-red-600 text-sm">{apiError}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-zinc-900 text-white rounded-md font-medium disabled:opacity-50"
        >
          {paymentMethod === "PIX" ? "Pagar com PIX" : "Ir para o pagamento"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Type-check + lint**

```bash
npx tsc --noEmit && npx eslint src/app/[slug]/checkout/page.tsx
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[slug]/checkout/page.tsx"
git commit -m "feat(checkout): add email + CPF fields and branch submit for PIX vs CARD"
```

---

## Task 13: `PixPaymentView` component + unit tests

**Files:**
- Create: `src/components/PixPaymentView.tsx`
- Create: `tests/unit/pixPaymentView.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/unit/pixPaymentView.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PixPaymentView } from "@/components/PixPaymentView";

describe("PixPaymentView", () => {
  it("renders QR base64 image", () => {
    render(
      <PixPaymentView
        qrCode="PAYLOAD"
        qrCodeBase64="iVBOR64"
        ticketUrl="https://mp/t/1"
        expiresAt={new Date(Date.now() + 60_000).toISOString()}
      />
    );
    const img = screen.getByRole("img", { name: /qr code pix/i });
    expect(img.getAttribute("src")).toContain("iVBOR64");
  });

  it("copies payload to clipboard on button click", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <PixPaymentView
        qrCode="PAYLOAD"
        qrCodeBase64="iVBOR64"
        ticketUrl="https://mp/t/1"
        expiresAt={new Date(Date.now() + 60_000).toISOString()}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: /copiar código pix/i })
    );
    expect(writeText).toHaveBeenCalledWith("PAYLOAD");
  });

  it("renders a fallback ticket link", () => {
    render(
      <PixPaymentView
        qrCode="PAYLOAD"
        qrCodeBase64="iVBOR64"
        ticketUrl="https://mp/t/1"
        expiresAt={new Date(Date.now() + 60_000).toISOString()}
      />
    );
    const link = screen.getByRole("link", { name: /abrir no mercado pago/i });
    expect(link.getAttribute("href")).toBe("https://mp/t/1");
  });
});
```

> If `@testing-library/react` or `@testing-library/user-event` are missing, they are already transitive deps of a Vitest + React setup; if not, install with `npm install -D @testing-library/react @testing-library/user-event jsdom`.

- [ ] **Step 2: Ensure jsdom is configured**

Check `vitest.config.ts`. If `test.environment` is not `"jsdom"` for component tests, either configure a per-file directive via the top-of-file comment:

```tsx
// @vitest-environment jsdom
```

at line 1 of `tests/unit/pixPaymentView.test.tsx`. Add this directive.

- [ ] **Step 3: Run test to confirm RED**

```bash
npx vitest run tests/unit/pixPaymentView.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 4: Create the component**

Create `src/components/PixPaymentView.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

interface PixPaymentViewProps {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  expiresAt: string;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Expirado";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}h ${String(m).padStart(2, "0")}m`;
  }
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function PixPaymentView({
  qrCode,
  qrCodeBase64,
  ticketUrl,
  expiresAt,
}: PixPaymentViewProps) {
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const remaining = new Date(expiresAt).getTime() - now;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="border rounded-lg p-4 bg-white space-y-4">
      <h2 className="text-lg font-semibold">Pague com PIX</h2>
      <p className="text-sm text-zinc-600">
        Escaneie o QR Code ou copie e cole o código no seu app do banco.
      </p>

      <div className="flex justify-center">
        <img
          src={`data:image/png;base64,${qrCodeBase64}`}
          alt="QR Code PIX"
          className="w-56 h-56 border rounded"
        />
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className="w-full py-2 border rounded-md text-sm font-medium hover:bg-zinc-50"
      >
        {copied ? "Código copiado!" : "Copiar código PIX"}
      </button>

      <p className="text-xs text-zinc-500 text-center">
        Expira em {formatRemaining(remaining)}
      </p>

      <a
        href={ticketUrl}
        target="_blank"
        rel="noreferrer"
        className="block text-center text-sm text-zinc-600 underline"
      >
        Abrir no Mercado Pago
      </a>
    </section>
  );
}
```

- [ ] **Step 5: Run tests to confirm GREEN**

```bash
npx vitest run tests/unit/pixPaymentView.test.tsx
```

Expected: all 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/PixPaymentView.tsx tests/unit/pixPaymentView.test.tsx
git commit -m "feat(pix-view): add PixPaymentView component (QR + copy + countdown)"
```

---

## Task 14: Order page — conditionally render PIX view

**Files:**
- Modify: `src/app/[slug]/pedido/[orderId]/page.tsx`

- [ ] **Step 1: Update the page**

Replace the content of `src/app/[slug]/pedido/[orderId]/page.tsx` with:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { OrderStatus, PaymentMethod } from "@prisma/client";
import { OrderStatusPolling } from "@/components/OrderStatusPolling";
import { PixPaymentView } from "@/components/PixPaymentView";

interface PageProps {
  params: Promise<{ slug: string; orderId: string }>;
}

function formatPrice(priceInCents: number): string {
  return `R$ ${(priceInCents / 100).toFixed(2).replace(".", ",")}`;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  CREATED: "Aguardando pagamento",
  PAYMENT_PENDING: "Pagamento pendente",
  PAYMENT_APPROVED: "Pagamento aprovado",
  PREPARING: "Em preparo",
  READY: "Pronto para retirada",
  PICKED_UP: "Retirado",
  CANCELLED: "Cancelado",
};

export default async function OrderStatusPage({ params }: PageProps) {
  const { slug, orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) notFound();

  const showPix =
    order.status === OrderStatus.PAYMENT_PENDING &&
    order.paymentMethod === PaymentMethod.PIX &&
    order.pixQrCode &&
    order.pixQrCodeBase64 &&
    order.pixTicketUrl &&
    order.pixExpiresAt;

  return (
    <main className="max-w-lg mx-auto p-4">
      <h1 className="text-2xl font-bold mb-2">Pedido #{order.orderNumber}</h1>

      <p className="text-zinc-800 font-medium mb-1">{order.customerName}</p>
      <time className="text-zinc-500 text-sm mb-4 block">
        {new Date(order.createdAt).toLocaleString("pt-BR")}
      </time>

      <p className="text-zinc-600 mb-4">{STATUS_LABELS[order.status]}</p>

      <div className="mb-6">
        <OrderStatusPolling
          initialStatus={order.status}
          slug={slug}
          orderId={orderId}
        />
      </div>

      {showPix && (
        <div className="mb-6">
          <PixPaymentView
            qrCode={order.pixQrCode!}
            qrCodeBase64={order.pixQrCodeBase64!}
            ticketUrl={order.pixTicketUrl!}
            expiresAt={order.pixExpiresAt!.toISOString()}
          />
        </div>
      )}

      <ul className="space-y-3 mb-4">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between text-sm">
            <span>
              {item.name} × {item.quantity}
            </span>
            <span>{formatPrice(item.priceInCents)}</span>
          </li>
        ))}
      </ul>

      <div className="flex justify-between font-bold text-lg border-t pt-3 mb-6">
        <span>Total</span>
        <span>{formatPrice(order.totalInCents)}</span>
      </div>

      <Link href={`/${slug}`} className="text-zinc-600 underline">
        Voltar ao início
      </Link>
    </main>
  );
}
```

- [ ] **Step 2: Extend `OrderStatusPolling` to hide the PIX view once approved**

The polling component is already in place. Since the page is server-rendered and does not re-fetch on status change, `PixPaymentView` persists in the DOM until the next navigation. This is acceptable for this iteration — once status updates, the visible progress tracker shows "Pagamento aprovado", which is the user signal. No change to polling.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[slug]/pedido/[orderId]/page.tsx"
git commit -m "feat(order-page): render PixPaymentView when order is PIX + PAYMENT_PENDING"
```

---

## Task 15: Card payment page + CardPaymentForm

**Files:**
- Create: `src/types/mercadopago-brick.ts`
- Create: `src/components/CardPaymentForm.tsx`
- Create: `src/app/[slug]/checkout/cartao/[orderId]/page.tsx`

- [ ] **Step 1: Create local Brick types**

Create `src/types/mercadopago-brick.ts`:

```typescript
export interface CardFormData {
  token: string;
  payment_method_id: string;
  issuer_id: string;
  installments: number;
}

export interface BrickCallbacks {
  onReady?: () => void;
  onSubmit: (formData: CardFormData) => Promise<void> | void;
  onError?: (error: { message?: string }) => void;
}

export interface BrickController {
  unmount: () => void;
}

export interface BricksBuilder {
  create(
    brickType: "cardPayment",
    containerId: string,
    settings: {
      initialization: { amount: number };
      customization?: {
        paymentMethods?: { maxInstallments?: number };
      };
      callbacks: BrickCallbacks;
    }
  ): Promise<BrickController>;
}

export interface MercadoPagoSDK {
  bricks(): BricksBuilder;
}

export interface MercadoPagoSDKClass {
  new (publicKey: string, options?: { locale?: string }): MercadoPagoSDK;
}

declare global {
  interface Window {
    MercadoPago?: MercadoPagoSDKClass;
  }
}

export {};
```

- [ ] **Step 2: Create the client component**

Create `src/components/CardPaymentForm.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BrickController, CardFormData } from "@/types/mercadopago-brick";

interface CardPaymentFormProps {
  publicKey: string;
  slug: string;
  orderId: string;
  amountInCents: number;
}

const MP_SDK_SRC = "https://sdk.mercadopago.com/js/v2";

function loadMpSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.MercadoPago) return Promise.resolve();
  const existing = document.querySelector(
    `script[src="${MP_SDK_SRC}"]`
  ) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("MP SDK failed to load"))
      );
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = MP_SDK_SRC;
    s.async = true;
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () =>
      reject(new Error("MP SDK failed to load"))
    );
    document.body.appendChild(s);
  });
}

export function CardPaymentForm({
  publicKey,
  slug,
  orderId,
  amountInCents,
}: CardPaymentFormProps) {
  const router = useRouter();
  const [setupError, setSetupError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const brickRef = useRef<BrickController | null>(null);

  useEffect(() => {
    const cpf = sessionStorage.getItem(`order-${orderId}-cpf`);
    if (!cpf) {
      setSetupError(
        "CPF não encontrado. Volte ao checkout e informe o CPF novamente."
      );
      return;
    }

    let cancelled = false;

    loadMpSdk()
      .then(() => {
        if (cancelled) return;
        if (!window.MercadoPago) {
          setSetupError("Falha ao carregar MercadoPago.");
          return;
        }
        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        return mp.bricks().create("cardPayment", "cardPaymentBrick_container", {
          initialization: { amount: amountInCents / 100 },
          customization: {
            paymentMethods: { maxInstallments: 1 },
          },
          callbacks: {
            onSubmit: async (formData: CardFormData) => {
              const storedCpf = sessionStorage.getItem(
                `order-${orderId}-cpf`
              );
              if (!storedCpf) {
                setApiError("CPF ausente.");
                return;
              }
              const res = await fetch(
                `/api/restaurants/${slug}/orders/${orderId}/pay/card`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    token: formData.token,
                    paymentMethodId: formData.payment_method_id,
                    issuerId: formData.issuer_id,
                    installments: 1,
                    cpf: storedCpf,
                  }),
                }
              );
              if (!res.ok) {
                setApiError(
                  "Pagamento recusado. Tente outro cartão ou PIX."
                );
                return;
              }
              sessionStorage.removeItem(`order-${orderId}-cpf`);
              router.push(`/${slug}/pedido/${orderId}`);
            },
            onError: (err: { message?: string }) => {
              setApiError(err.message ?? "Erro no pagamento.");
            },
          },
        });
      })
      .then((controller) => {
        if (!cancelled && controller) brickRef.current = controller;
      })
      .catch((err: Error) => {
        if (!cancelled) setSetupError(err.message);
      });

    return () => {
      cancelled = true;
      brickRef.current?.unmount();
      brickRef.current = null;
    };
  }, [publicKey, slug, orderId, amountInCents, router]);

  if (setupError) {
    return (
      <div className="border rounded-lg p-4 bg-white space-y-3">
        <p className="text-red-600 font-medium">{setupError}</p>
        <a
          href={`/${slug}/checkout`}
          className="inline-block text-sm text-zinc-700 underline"
        >
          Voltar ao checkout
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div id="cardPaymentBrick_container" />
      {apiError && <p className="text-red-600 text-sm">{apiError}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Create the server page**

Create `src/app/[slug]/checkout/cartao/[orderId]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CardPaymentForm } from "@/components/CardPaymentForm";

interface PageProps {
  params: Promise<{ slug: string; orderId: string }>;
}

export default async function CardCheckoutPage({ params }: PageProps) {
  const { slug, orderId } = await params;

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) notFound();

  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId: restaurant.id },
  });
  if (!order) notFound();

  if (!restaurant.mercadopagoPublicKey) {
    return (
      <main className="max-w-lg mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Pagamento com cartão</h1>
        <p className="text-red-600">
          Este restaurante ainda não configurou o pagamento por cartão.
        </p>
        <Link
          href={`/${slug}/pedido/${orderId}`}
          className="inline-block mt-4 text-zinc-600 underline"
        >
          Ver status do pedido
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Pedido #{order.orderNumber}</h1>
      <p className="text-zinc-600 mb-4">
        Total: R$ {(order.totalInCents / 100).toFixed(2).replace(".", ",")}
      </p>
      <CardPaymentForm
        publicKey={restaurant.mercadopagoPublicKey}
        slug={slug}
        orderId={orderId}
        amountInCents={order.totalInCents}
      />
    </main>
  );
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/types/mercadopago-brick.ts src/components/CardPaymentForm.tsx "src/app/[slug]/checkout/cartao/[orderId]/page.tsx"
git commit -m "feat(card-checkout): add Card Brick form and /checkout/cartao/[orderId] page"
```

---

## Task 16: E2E tests (Playwright)

**Files:**
- Create: `tests/e2e/checkout-pix.spec.ts`
- Create: `tests/e2e/checkout-card.spec.ts`

- [ ] **Step 1: Inspect Playwright config**

```bash
cat playwright.config.ts 2>/dev/null || cat playwright.config.js 2>/dev/null
```

Note the `baseURL`, any global setup, and how tests typically seed data. If there's a seeding helper (`tests/e2e/helpers/seed.ts` or similar), use it.

- [ ] **Step 2: Write PIX happy-path E2E**

Create `tests/e2e/checkout-pix.spec.ts`. Follow the existing convention: timestamp-suffixed unique slugs, no `deleteMany` (parallel-safe).

```typescript
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

    // Intercept the pay/pix call and fulfill with a fake QR payload.
    // Because the real server route is bypassed, also update the DB directly
    // so the server-rendered order page shows the QR.
    await page.route(
      `**/api/restaurants/${restaurant.slug}/orders/*/pay/pix`,
      async (route) => {
        const url = new URL(route.request().url());
        const parts = url.pathname.split("/");
        const orderId = parts[parts.length - 2];

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
```

- [ ] **Step 3: Write card-page-load E2E**

Create `tests/e2e/checkout-card.spec.ts`:

```typescript
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

    // Block external SDK to keep this test hermetic (Brick is not tested here).
    await page.route("https://sdk.mercadopago.com/**", (r) => r.abort());

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
```

- [ ] **Step 4: Run E2E**

```bash
npx playwright test tests/e2e/checkout-pix.spec.ts tests/e2e/checkout-card.spec.ts
```

Expected: both specs pass. If the dev server is not running, start it per the project's E2E setup.

> If the tests reveal a selector mismatch (e.g. button label differs), update the test selector to match the actual UI — the assertion is on behavior, not wording. Commit the fix with the E2E tests.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/checkout-pix.spec.ts tests/e2e/checkout-card.spec.ts
git commit -m "test(e2e): PIX happy path + card page load"
```

---

## Task 17: Final cleanup, close PR #43, update docs

**Files:**
- Modify: `docs/mercadopago.md`
- Modify: `docs/mercadopago-mcp.md` if it references the old flow

- [ ] **Step 1: Run full suites**

```bash
npx tsc --noEmit
npx eslint .
npx vitest run
npx playwright test
```

Expected: clean across the board.

- [ ] **Step 2: Check coverage on new files**

```bash
npx vitest run --coverage
```

Expected: coverage ≥ 80% on `src/lib/mercadopago.ts`, `src/lib/cpfUtils.ts`, `src/components/PixPaymentView.tsx`, `src/app/api/restaurants/[slug]/orders/[orderId]/pay/pix/route.ts`, `src/app/api/restaurants/[slug]/orders/[orderId]/pay/card/route.ts`.

- [ ] **Step 3: Update `docs/mercadopago.md`**

Open `docs/mercadopago.md`. Replace Checkout Pro references with the Transparente flow. The doc should describe:

- Access Token + Public Key both required per restaurant
- PIX: `POST /orders/[id]/pay/pix` → custom page renders QR
- CARD: Card Brick → `POST /orders/[id]/pay/card` with tokenized card
- Webhook: unchanged endpoint (`/api/webhooks/mercadopago`), uses `external_reference`
- No redirect to mercadopago.com anymore

Write a concrete one-page document — no placeholders.

- [ ] **Step 4: Final commit**

```bash
git add docs/mercadopago.md docs/mercadopago-mcp.md
git commit -m "docs(mercadopago): document Checkout Transparente (PIX + Card Brick)"
```

- [ ] **Step 5: Close PR #43**

```bash
gh pr close 43 --comment "Superseded by Checkout Transparente migration (this branch)."
```

Expected: PR #43 is closed. If `gh` is not on PATH, use `/opt/homebrew/bin/gh`.

- [ ] **Step 6: Open PR**

```bash
git push -u origin feature/checkout-transparente
gh pr create --title "feat: migrate MercadoPago integration to Checkout Transparente (PIX + Card Brick)" --body "$(cat <<'EOF'
## Summary
- Replaces Checkout Pro redirect flow with Checkout Transparente
- PIX: custom in-app QR page via `POST /v1/payments` (`payment_method_id=pix`)
- CARD: official Card Payment Brick tokenizes card → `POST /v1/payments`
- Per-restaurant MP Public Key required alongside Access Token
- Removes `Order.mercadopagoPreferenceId` and legacy `POST /orders/[id]/pay`

closes #39 (as a superseding approach)
closes the concern behind PR #43 (PIX availability)

## Test plan
- [x] `npx vitest run` — all unit + integration pass
- [x] `npx playwright test` — PIX happy path + card page load pass
- [x] `npx tsc --noEmit` clean
- [x] `npx eslint .` clean
- [x] Coverage ≥ 80% on new files
- [ ] Manual: configure a real MP test account, complete one PIX payment end to end
- [ ] Manual: configure a real MP test account, complete one CARD payment with 1× installment

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

> Confirm before pushing; this step creates a remote branch and a public PR.

---

## Verification Checklist

Before marking the implementation complete:

- [ ] All 17 tasks committed with green tests
- [ ] `tsc --noEmit` clean
- [ ] `eslint .` clean
- [ ] `vitest run` green
- [ ] `playwright test` green
- [ ] Coverage ≥ 80% on new files
- [ ] `docs/mercadopago.md` reflects new flow
- [ ] PR #43 closed
- [ ] No references to `createOrderPreference` or `mercadopagoPreferenceId` remain
- [ ] Settings backoffice lets restaurants save Access Token + Public Key together
- [ ] PIX: QR visible on order page and polling advances to `PAYMENT_APPROVED` after webhook
- [ ] CARD: CPF persisted in sessionStorage, Brick container renders, `pay/card` returns 200 on approved

---

## Notes

- **TDD discipline:** every task pairs a failing test with a minimal implementation. Do not write code before the test for that task is red.
- **Prisma 7:** never instantiate `new PrismaClient()` outside `src/lib/db.ts`; always import `prisma` from there.
- **No `any`:** prefer `Record<string, unknown>` + narrow `typeof` checks, as in existing routes.
- **Idempotency:** `X-Idempotency-Key` is set via `requestOptions.idempotencyKey`; the key combines order id and method so retrying a failed `/pay/pix` call on the same order returns the same payment object.
- **Webhook path:** unchanged at `/api/webhooks/mercadopago`. Same URL is set in `notification_url` for both PIX and CARD payments so there's only one public MP webhook configuration.
