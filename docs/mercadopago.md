# MercadoPago — Checkout Transparente (PIX + Card)

MenuApp integrates with MercadoPago via **Checkout Transparente**. Payments are captured in-app, with no redirect to `mercadopago.com`. PIX is rendered as a QR code on our order page; Card is collected through the official **Card Payment Brick**.

## Per-restaurant credentials

Each restaurant holds its own MercadoPago credentials in the `Restaurant` table:

| Field | Purpose |
|---|---|
| `mercadopagoAccessToken` | Secret key used server-side to call `POST /v1/payments`. |
| `mercadopagoPublicKey`   | Public key injected into the browser to initialize `MercadoPago.js` and the Card Brick. |

Both are required — a restaurant without both cannot accept card payments (PIX requires at minimum the access token; card requires both). The backoffice `Settings` page enforces that both are saved together (XOR rejected with `400 mercadopagoAccessToken and mercadopagoPublicKey must be provided together`).

## PIX flow

1. Customer fills the checkout page (`/[slug]/checkout`) with name, phone, email, and selects PIX.
2. `POST /api/restaurants/[slug]/orders` creates the order (`customerEmail` is persisted).
3. `POST /api/restaurants/[slug]/orders/[orderId]/pay/pix` runs server-side and calls `payment.create({ payment_method_id: "pix", transaction_amount, external_reference: orderId, payer: { email, first_name }, date_of_expiration, notification_url })` with the restaurant's access token and an idempotency key of `order-${orderId}-pix`.
4. MercadoPago's response includes `point_of_interaction.transaction_data.{qr_code, qr_code_base64, ticket_url}` and a `date_of_expiration` (defaults to 24h). These are persisted on the order (`pixQrCode`, `pixQrCodeBase64`, `pixTicketUrl`, `pixExpiresAt`) and the status moves to `PAYMENT_PENDING`.
5. The customer is routed to `/[slug]/pedido/[orderId]`, which server-renders the `PixPaymentView` component (QR image + copy-to-clipboard + countdown + fallback link).
6. `OrderStatusPolling` on the same page polls `GET /api/restaurants/[slug]/orders/[orderId]` every few seconds. Once the MP webhook has moved the order to `PAYMENT_APPROVED`, the label updates.

## Card flow

1. Customer selects **Cartão** on the checkout page, fills CPF (required only for card), and submits.
2. The order is created the same way as PIX, but the CPF is saved in `sessionStorage` under `order-${orderId}-cpf` and the customer is routed to `/[slug]/checkout/cartao/[orderId]`.
3. The server page loads `CardPaymentForm`, which injects `https://sdk.mercadopago.com/js/v2`, instantiates `new MercadoPago(publicKey, { locale: "pt-BR" })`, and renders the official **Card Payment Brick** into `#cardPaymentBrick_container` with `initialization.amount = totalInCents / 100` and `customization.paymentMethods.maxInstallments = 1`.
4. On Brick submit, the client receives `{ token, payment_method_id, issuer_id, installments }` and `POST /api/restaurants/[slug]/orders/[orderId]/pay/card` with `{ token, paymentMethodId, issuerId, installments, cpf }`.
5. The server calls `payment.create({ token, installments: 1, payment_method_id, issuer_id, transaction_amount, external_reference, payer: { email, first_name, identification: { type: "CPF", number: cpf } }, notification_url })` with an idempotency key of `order-${orderId}-card`.
6. On approved response, the CPF is wiped from `sessionStorage` and the customer is routed to `/[slug]/pedido/[orderId]`.

## Webhook

Endpoint: `POST /api/webhooks/mercadopago` (unchanged — same URL for PIX and card).

1. MercadoPago calls with `{ type: "payment", data: { id } }`.
2. The handler fetches the payment (`fetchPaymentStatus`) using the restaurant's access token.
3. The order is looked up by `external_reference` (which is the internal `order.id`).
4. Status is mapped: `approved` → `PAYMENT_APPROVED`, `rejected` / `cancelled` / `refunded` → `CANCELLED`.
5. Any other topic (`merchant_order`, etc.) or an unknown `external_reference` returns `200 OK` with no state change — MercadoPago retries on non-2xx, so we ack everything we can safely ignore.

## Idempotency

`requestOptions.idempotencyKey` is `order-${orderId}-pix` for PIX and `order-${orderId}-card` for card. Retrying a failed call on the same order returns the same payment object rather than creating a duplicate.

## Required env / config

No global MercadoPago env vars — all credentials are per-restaurant in the database. The only env var used by the MP integration is `NEXT_PUBLIC_BASE_URL` (or an equivalent used to build `notification_url`).

## What was removed

- `Order.mercadopagoPreferenceId` (no Checkout Pro → no preferences).
- Legacy `POST /api/restaurants/[slug]/orders/[orderId]/pay` route.
- `createOrderPreference` helper in `src/lib/mercadopago.ts`.
- Any redirect to `mercadopago.com/checkout/v1/redirect`.

## Testing

- **Unit/integration (Vitest):** `tests/integration/orders-pay-pix.test.ts`, `tests/integration/orders-pay-card.test.ts`, `tests/integration/payments.test.ts` (webhook), `tests/integration/settings.test.ts`, `tests/unit/cpfUtils.test.ts`, `tests/unit/pixPaymentView.test.tsx`, `tests/unit/SettingsForm.test.tsx`.
- **E2E (Playwright):** `tests/e2e/checkout-pix.spec.ts` (happy path, QR + polling), `tests/e2e/checkout-card.spec.ts` (page load + Brick container mounts + CPF persistence).
