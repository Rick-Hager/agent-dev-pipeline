# Checkout Transparente MercadoPago — Design Doc

**Date:** 2026-04-18
**Status:** Draft, pending user approval
**Author:** brainstorming session
**Supersedes:** Checkout Pro integration (feature #39, merged in d9c1505)

---

## 1. Overview & Scope

Replace the current Checkout Pro flow (redirect to `mercadopago.com`) with MercadoPago **Checkout Transparente**. Payments stay 100% inside the app.

- **PIX** uses a custom page that shows QR Code + copia-e-cola, fed by `POST /v1/payments`.
- **CARD** uses the official **Card Payment Brick** that tokenizes the card client-side and posts the token to our backend, which calls `POST /v1/payments`.

### In-scope

- PIX full flow (creation, QR rendering, status polling, webhook).
- Card flow with 1× à vista only (no installments).
- Per-restaurant MP Public Key stored in `Restaurant`.
- New customer fields on checkout: `email` always; `cpf` only when CARD.

### Out-of-scope

- Parcelamento (cartão fixado em 1×).
- Boleto, wallet Mercado Pago, any other payment methods.
- Marketplace / split / platform fee.
- Custom 3DS flow (Brick handles it).
- Backwards compatibility with Checkout Pro preference flow — replace, do not run in parallel.

### Preconditions / migration stance

- No production users yet for feature #39; `Order.mercadopagoPreferenceId` dropped in migration, legacy rows' column simply disappears (dev/staging only).
- PR #43 (`fix/pix-not-showing-in-checkout`) is closed without merging: the fix becomes irrelevant once `createOrderPreference` is removed.

---

## 2. Data Model

### 2.1 `Restaurant` (add)

```prisma
mercadopagoPublicKey     String?   // required jointly with accessToken for checkout
```

### 2.2 `Order` (add + remove)

```prisma
customerEmail           String?        // new; required for new orders, null allowed for legacy rows
mercadopagoPaymentId    String?        // primary transaction ID (already exists)

// PIX-specific
pixQrCode               String?        // copia-e-cola payload
pixQrCodeBase64         String?        // PNG as base64
pixTicketUrl            String?        // MP-hosted fallback URL
pixExpiresAt            DateTime?

// removed: mercadopagoPreferenceId
```

### 2.3 Migration

Applied via `npx prisma db push` (project uses `prisma.config.ts`, no versioned migrations per `CLAUDE.md`):

1. `ALTER TABLE Restaurant ADD COLUMN mercadopagoPublicKey TEXT`.
2. `ALTER TABLE Order ADD COLUMN customerEmail TEXT, pixQrCode TEXT, pixQrCodeBase64 TEXT, pixTicketUrl TEXT, pixExpiresAt TIMESTAMP`.
3. `ALTER TABLE Order DROP COLUMN mercadopagoPreferenceId`.

### 2.4 Other models

No changes to `OrderItem`, `Category`, `MenuItem`, `MenuItemImage`, or the `OrderStatus` / `PaymentMethod` enums.

---

## 3. Backend API

### 3.1 `POST /api/restaurants/[slug]/orders` (modify)

Add `customerEmail` to body; validate email format. Other fields unchanged.

**Request**
```json
{
  "customerName": "Maria",
  "customerPhone": "11999999999",
  "customerEmail": "maria@example.com",
  "items": [{ "menuItemId": "cuid", "quantity": 2 }]
}
```

**Response** `201 { id, orderNumber }` (unchanged shape).

### 3.2 `POST /api/restaurants/[slug]/orders/[orderId]/pay/pix` (new)

Body: `{}` (email already in order).

Server flow:
1. Load order + restaurant; return 400 if missing `mercadopagoAccessToken` or `customerEmail`.
2. Call MP `/v1/payments` with header `X-Idempotency-Key: order-{orderId}-pix`:
   ```json
   {
     "transaction_amount": totalInCents / 100,
     "description": "Pedido #42 — Pizzaria Bella",
     "payment_method_id": "pix",
     "payer": {
       "email": order.customerEmail,
       "first_name": order.customerName
     },
     "external_reference": orderId,
     "notification_url": "{baseUrl}/api/webhooks/mercadopago",
     "date_of_expiration": now + 24h
   }
   ```
3. Extract `point_of_interaction.transaction_data.{qr_code, qr_code_base64, ticket_url}` and `date_of_expiration`; persist with `mercadopagoPaymentId`, `paymentMethod=PIX`, `status=PAYMENT_PENDING`.

**Response 200**
```json
{
  "paymentId": "…",
  "qrCode": "00020126…",
  "qrCodeBase64": "iVBORw0K…",
  "ticketUrl": "https://…",
  "expiresAt": "2026-04-19T12:00:00Z"
}
```

Errors: `400` missing email/access token; `502` MP 5xx.

### 3.3 `POST /api/restaurants/[slug]/orders/[orderId]/pay/card` (new)

**Request** (from Card Brick `onSubmit` payload + CPF)
```json
{
  "token": "ff8080814c11e237014c1ff593b57b4d",
  "paymentMethodId": "visa",
  "issuerId": "25",
  "installments": 1,
  "cpf": "19119119100"
}
```

Validation: `cpf` is 11 digits; server forces `installments: 1` regardless of input.

Server flow:
1. Load order + restaurant; verify `CREATED` status and `mercadopagoAccessToken`.
2. Call MP `/v1/payments` with header `X-Idempotency-Key: order-{orderId}-card`:
   ```json
   {
     "transaction_amount": totalInCents / 100,
     "description": "Pedido #42 — Pizzaria Bella",
     "token": "…",
     "installments": 1,
     "payment_method_id": "visa",
     "issuer_id": "25",
     "payer": {
       "email": order.customerEmail,
       "first_name": order.customerName,
       "identification": { "type": "CPF", "number": "19119119100" }
     },
     "external_reference": orderId,
     "notification_url": "{baseUrl}/api/webhooks/mercadopago"
   }
   ```
3. Map status → order:
   - `approved` → `PAYMENT_APPROVED` + response 200.
   - `in_process` / `pending` → `PAYMENT_PENDING` + response 200.
   - `rejected` / `cancelled` → `CANCELLED` + response 402.

**Response 200/402**
```json
{
  "paymentId": "…",
  "status": "approved",
  "statusDetail": "accredited"
}
```

### 3.4 `GET /api/restaurants/[slug]/orders/[orderId]` (extend)

Already exists. Extend response to include `pixQrCode`, `pixQrCodeBase64`, `pixTicketUrl`, `pixExpiresAt`, `customerEmail`. Used by the polling on the order page.

### 3.5 `POST /api/webhooks/mercadopago` (minor edit)

Already receives webhook, calls `fetchPaymentStatus`, updates order by `external_reference`. Remove any reference to `mercadopagoPreferenceId`; keep rest intact.

### 3.6 `src/lib/mercadopago.ts`

**Remove**: `createOrderPreference`.

**Add**:
- `createPixPayment(accessToken, params)` → `{ paymentId, qrCode, qrCodeBase64, ticketUrl, expiresAt }`.
- `createCardPayment(accessToken, params)` → `{ paymentId, status, statusDetail }`.

**Keep**: `fetchPaymentStatus` (used by webhook).

Both new functions use the `Payment` class from the `mercadopago` SDK with an explicit `X-Idempotency-Key` via `requestOptions.idempotencyKey`.

---

## 4. Frontend

### 4.1 `src/app/[slug]/checkout/page.tsx` (modify)

Fields in order: Nome, Telefone, **Email** (new, required), payment method radios, **CPF** (new, conditional on CARD).

Client-side validation: email regex; CPF masked `999.999.999-99` with 11 digits.

Submit flow:
1. `POST /orders` with name, phone, email, items.
2. If `PIX` → `POST /orders/[id]/pay/pix` → `clearCart()` → `router.push("/{slug}/pedido/{orderId}")`.
3. If `CARD` → store CPF in `sessionStorage` (key `order-{orderId}-cpf`) → `clearCart()` → `router.push("/{slug}/checkout/cartao/{orderId}")`.

### 4.2 `src/app/[slug]/pedido/[orderId]/page.tsx` (extend)

When `order.status === "PAYMENT_PENDING" && order.paymentMethod === "PIX"`, render `<PixPaymentView>` with QR image (base64), copy-to-clipboard button, countdown to `pixExpiresAt`, and ticket URL fallback link.

The existing `<OrderStatusPolling>` keeps polling `GET /orders/[id]` every 4s; once status becomes `PAYMENT_APPROVED`, the QR section is replaced by a confirmation message.

### 4.3 `src/app/[slug]/checkout/cartao/[orderId]/page.tsx` (new)

Server component fetches order + `restaurant.mercadopagoPublicKey` and renders the client `<CardPaymentForm>`. If `publicKey` is null, render an error message.

Client component loads `https://sdk.mercadopago.com/js/v2`, creates the Card Payment Brick. If `sessionStorage` has no `order-{orderId}-cpf` entry (user refreshed or entered via URL directly), render an error and a link back to `/{slug}/checkout` to re-enter the CPF.

```ts
const mp = new MercadoPago(publicKey, { locale: "pt-BR" });
mp.bricks().create("cardPayment", "cardPaymentBrick_container", {
  initialization: { amount: totalInCents / 100 },
  customization: { paymentMethods: { maxInstallments: 1 } },
  callbacks: {
    onSubmit: async (cardFormData) => {
      const cpf = sessionStorage.getItem(`order-${orderId}-cpf`);
      const res = await fetch(`/api/restaurants/${slug}/orders/${orderId}/pay/card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: cardFormData.token,
          paymentMethodId: cardFormData.payment_method_id,
          issuerId: cardFormData.issuer_id,
          installments: 1,
          cpf,
        }),
      });
      router.push(`/${slug}/pedido/${orderId}`);
    },
    onError: (error) => setApiError(error.message),
  },
});
```

### 4.4 `src/components/SettingsForm.tsx` (extend)

Add field "Public Key (MercadoPago)" below the Access Token with helper text. Validation: if either of the two is filled, both must be filled (or both empty).

### 4.5 New components

- `src/components/PixPaymentView.tsx` — QR image + copia-e-cola + countdown.
- `src/components/CardPaymentForm.tsx` — Card Brick wrapper + CPF retrieval from sessionStorage.

### 4.6 Types

`src/types/mercadopago-brick.ts` — minimal interfaces for the Brick API (MP does not ship stable types, so we declare a conservative local interface).

---

## 5. Testing & Migration

### 5.1 Unit tests (Vitest)

**`src/lib/mercadopago.ts`**
- `createPixPayment` builds correct body (`payment_method_id: "pix"`, `payer.email`, `external_reference`, `date_of_expiration` ≈ +24h).
- `createPixPayment` sets `X-Idempotency-Key` header.
- `createPixPayment` extracts `qr_code`, `qr_code_base64`, `ticket_url` from `point_of_interaction.transaction_data`.
- `createCardPayment` builds correct body (`token`, `installments: 1`, `payer.identification.type="CPF"`).
- `createCardPayment` status mapping: `approved`, `in_process`, `rejected`.
- `fetchPaymentStatus` — keep existing tests.

**Utilities & components**
- Email regex, CPF mask, 11-digit validation.
- `<PixPaymentView>`: renders QR, copy button works, countdown decrements.

### 5.2 Integration tests (Vitest + real Prisma)

- `POST /orders` accepts `customerEmail`; rejects invalid email (400).
- `POST /orders/[id]/pay/pix`:
  - 400 without order email or restaurant access token.
  - 200 persists QR fields, `mercadopagoPaymentId`, `status=PAYMENT_PENDING`.
  - 502 when MP returns 5xx.
- `POST /orders/[id]/pay/card`:
  - 400 without token or CPF.
  - 400 without restaurant access token.
  - 200 with MP `approved` → `PAYMENT_APPROVED`.
  - 402 with MP `rejected` → `CANCELLED`.
- `GET /orders/[id]` returns PIX fields when present.
- `POST /webhooks/mercadopago` — update existing test to not reference `mercadopagoPreferenceId`.
- `PATCH /settings` — enforces joint presence of Public Key + Access Token.

### 5.3 E2E (Playwright)

- **PIX happy path**: open menu → add item → checkout (fill name/phone/email) → "Pagar com PIX" → order page shows QR (base64 present in DOM). Simulate webhook via direct POST to `/api/webhooks/mercadopago`; polling updates UI to `PAYMENT_APPROVED`.
- **Card page load**: navigate to `/[slug]/checkout/cartao/[orderId]` → verifies page renders, `cardPaymentBrick_container` div present, CPF in `sessionStorage`. Actual Brick submit is covered in integration, not E2E.

### 5.4 Quality gates (CLAUDE.md)

- `tsc --noEmit` — clean.
- `eslint .` — clean.
- `vitest run` — all pass; coverage ≥ 80% on new files.
- `playwright test` — all pass.

### 5.5 Rollout

- Single branch `feature/checkout-transparente` replacing Checkout Pro.
- Close PR #43 without merging.
- Update `docs/mercadopago.md` to describe the Transparente flow.
- Rollback = revert merge commit + `npx prisma db push` against previous schema (no prod data to preserve).

### 5.6 Env vars

None added. Public Key is per-restaurant in the database.

### 5.7 Implementation order (for writing-plans)

1. Schema update (`prisma/schema.prisma` + `npx prisma db push` + `npx prisma generate`).
2. `src/lib/mercadopago.ts` — new functions via TDD unit tests.
3. API routes: `pay/pix`, `pay/card`; update `orders` POST; update webhook.
4. `SettingsForm` + `/api/restaurants/[slug]/settings` — Public Key.
5. Checkout page — email + CPF conditional.
6. Order page — PIX view; reuse existing polling.
7. Card payment page + Brick wrapper.
8. E2E Playwright.
9. Remove `createOrderPreference` and related dead code; close PR #43.
10. Update `docs/mercadopago.md`.
