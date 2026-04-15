# MenuApp — Agent Development Pipeline

## Project Overview

Multi-restaurant online menu application built with Next.js. Consumers scan a QR code, browse a menu, place orders, and pay via Stripe (PIX or card). Kitchen staff manage orders via a real-time KDS panel. Restaurant owners manage menus and settings via a backoffice.

## Tech Stack

- **Framework:** Next.js (App Router) with TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL via Prisma ORM
- **Payments:** Stripe (PIX + Card)
- **Notifications:** WhatsApp via Twilio
- **Testing:** Vitest (unit/integration) + Playwright (E2E)
- **Deploy:** Vercel (auto-deploy on merge to main)

## Project Structure

- `src/app/` — Next.js App Router pages and API routes
- `src/components/` — Reusable React components
- `src/lib/` — Utility functions and shared logic
- `prisma/` — Database schema and migrations
- `tests/unit/` — Unit tests (Vitest)
- `tests/integration/` — Integration tests (Vitest)
- `tests/e2e/` — End-to-end tests (Playwright)
- `agents/` — Agent prompts (do not modify unless instructed)

## Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run test         # Run unit + integration tests
npm run test:e2e     # Run E2E tests
npm run test:coverage # Run tests with coverage report
npx prisma db push   # Push schema changes to database
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma studio    # Open database GUI
```

## Coding Conventions

- **Language:** TypeScript strict mode. No `any` types.
- **Naming:** camelCase for variables/functions, PascalCase for components/types, UPPER_SNAKE for constants.
- **Files:** One component per file. File name matches export name.
- **Imports:** Use `@/` alias for project imports (e.g., `@/lib/db`).
- **Prices:** Always in cents (integer). Display formatting happens in the UI layer only.
- **API routes:** Use Next.js Route Handlers in `src/app/api/`.
- **Error handling:** Return proper HTTP status codes. Never expose internal errors to the client.

## TDD Rules (MANDATORY)

Every code change MUST follow this cycle:

1. Write the failing test FIRST
2. Run the test — confirm it FAILS
3. Write the MINIMUM code to make it pass
4. Run the test — confirm it PASSES
5. Refactor if needed
6. Run ALL tests — confirm nothing is broken
7. Commit

Never write implementation code without a failing test first.

## Git Conventions

- **Branch naming:** `feature/issue-{number}-{short-description}`
- **Commit messages:** `type: description` where type is `feat`, `fix`, `refactor`, `test`, `chore`, `docs`
- **One logical change per commit.** Tests and implementation can be in the same commit.
- **PR title:** Same format as commit messages.
- **PR body:** Must include summary, link to issue (`closes #N`), and test results.

## Quality Gates

All of these must pass before a PR can be merged:

- `tsc --noEmit` — no type errors
- `eslint .` — no lint errors
- `vitest run` — all unit and integration tests pass
- `playwright test` — all E2E tests pass
- Coverage ≥ 80% on new files

## Database

- Schema is in `prisma/schema.prisma`
- After modifying the schema, always run `npx prisma generate`
- Prices are stored as integers (cents) in `priceInCents` columns
- Order numbers are sequential per restaurant (`@@unique([restaurantId, orderNumber])`)
- OrderItem stores snapshots of name and price at time of order

## Key Patterns

### API Route Pattern

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  // ... implementation
  return NextResponse.json(data);
}
```

### Test Pattern (Vitest)

```typescript
import { describe, it, expect } from "vitest";

describe("feature", () => {
  it("does specific thing", async () => {
    const result = await functionUnderTest(input);
    expect(result).toEqual(expected);
  });
});
```

### Test Pattern (Playwright E2E)

```typescript
import { test, expect } from "@playwright/test";

test("user can do specific thing", async ({ page }) => {
  await page.goto("/path");
  await page.getByRole("button", { name: "Action" }).click();
  await expect(page.getByText("Expected result")).toBeVisible();
});
```
