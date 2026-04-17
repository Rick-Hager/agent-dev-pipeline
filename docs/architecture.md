# MenuApp — Arquitetura Tecnica

## Visao Geral

MenuApp e uma plataforma multi-tenant de cardapio digital e gestao de pedidos para restaurantes. Clientes acessam o cardapio via QR code, fazem pedidos, e acompanham o status. Donos de restaurante gerenciam cardapio, pedidos e configuracoes via backoffice protegido.

O projeto tambem serve como prova de conceito de um **pipeline de desenvolvimento agenticol**: GitHub Issues sao automaticamente implementadas por agentes IA (Claude Code), com TDD, CI automatizado e deploy continuo.

---

## Stack Tecnologico

| Camada | Tecnologia | Versao |
|--------|-----------|--------|
| Framework | Next.js (App Router) | 16.x |
| Linguagem | TypeScript (strict mode) | 5.x |
| UI | React + Tailwind CSS | React 19, Tailwind 4 |
| Banco de Dados | PostgreSQL via Prisma ORM | Postgres 16, Prisma 7 |
| Autenticacao | JWT (jose) + bcryptjs | HS256, HttpOnly cookie |
| Storage | Vercel Blob | Imagens de produtos |
| Notificacoes | WhatsApp via Twilio | Per-restaurant config |
| Testes Unit/Integration | Vitest + React Testing Library | Vitest 4.x |
| Testes E2E | Playwright | 1.59.x |
| Deploy | Vercel (auto-deploy on merge) | |
| Banco Producao | Supabase (PostgreSQL) | |
| CI/CD | GitHub Actions | |
| Agentes | Claude Code CLI | Self-hosted runner |

---

## Estrutura do Projeto

```
agent-dev-pipeline/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Landing page
│   │   ├── layout.tsx          # Root layout (fonts, globals)
│   │   ├── [slug]/             # Paginas do consumidor (por restaurante)
│   │   │   ├── page.tsx        # Cardapio publico
│   │   │   ├── cart/           # Carrinho de compras
│   │   │   ├── checkout/       # Finalizar pedido
│   │   │   ├── kds/            # Kitchen Display System
│   │   │   └── pedido/[orderId]/ # Acompanhamento do pedido
│   │   ├── backoffice/         # Area administrativa
│   │   │   ├── login/          # Tela de login
│   │   │   └── (protected)/    # Rotas protegidas por JWT
│   │   │       ├── dashboard/  # Metricas e acoes rapidas
│   │   │       ├── menu/       # Gestao de cardapio (CRUD)
│   │   │       ├── orders/     # Dashboard de pedidos
│   │   │       └── settings/   # Configuracoes do restaurante
│   │   └── api/                # API Routes (Route Handlers)
│   │       ├── health/         # Health check
│   │       ├── auth/           # Login, logout, me
│   │       └── restaurants/    # CRUD completo
│   ├── components/             # Componentes React reutilizaveis
│   │   └── admin/              # Componentes do backoffice
│   └── lib/                    # Utilitarios e logica compartilhada
│       ├── db.ts               # Singleton Prisma (com adapter pg)
│       ├── auth.ts             # JWT sign/verify, cookies
│       ├── cart.ts             # Logica do carrinho (localStorage)
│       ├── password.ts         # Hash e verificacao bcrypt
│       ├── validation.ts       # Validacoes de input
│       ├── orderUtils.ts       # Formatacao de status/preco
│       └── whatsapp.ts         # Integracao Twilio WhatsApp
├── prisma/
│   ├── schema.prisma           # Schema do banco de dados
│   └── seed.ts                 # Dados de exemplo (2 restaurantes)
├── tests/
│   ├── unit/                   # Testes unitarios (23 arquivos)
│   ├── integration/            # Testes de integracao (9 arquivos)
│   └── e2e/                    # Testes E2E (17 arquivos)
├── agents/                     # Prompts dos agentes IA
│   ├── maestro.md              # Orquestrador
│   ├── backend.md              # Agente backend
│   ├── frontend.md             # Agente frontend
│   └── test.md                 # Agente de testes E2E
├── .github/workflows/
│   ├── ci.yml                  # Quality Gates (PR → main)
│   ├── agent-trigger.yml       # Dispara agente por label
│   └── agent-fix.yml           # Auto-fix quando CI falha
├── CLAUDE.md                   # Convencoes para agentes
└── docs/                       # Documentacao do projeto
```

---

## Modelo de Dados

### Diagrama de Relacionamentos

```
Restaurant (1) ──→ (N) Category (1) ──→ (N) MenuItem (1) ──→ (N) MenuItemImage
     │                                        │
     │                                        │ (ref, sem cascade)
     └──→ (N) Order (1) ──→ (N) OrderItem ───┘
```

### Modelos

**Restaurant** — Entidade central. Cada restaurante tem slug unico (usado na URL), credenciais de acesso, e configuracoes de pagamento/notificacao.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | String (cuid) | PK |
| name | String | Nome do restaurante |
| slug | String (unique) | Identificador na URL |
| email | String (unique) | Email de login |
| passwordHash | String | Hash bcrypt |
| logo | String? | URL do logo |
| businessHours | Json? | Horarios de funcionamento |
| stripePublishableKey | String? | Chave publica Stripe |
| stripeSecretKey | String? | Chave secreta Stripe |
| whatsappNumber | String? | Numero WhatsApp |
| whatsappApiConfig | Json? | {accountSid, authToken} |
| whatsappMessageTemplate | String? | Template com {orderNumber} e {status} |

**Category** — Agrupamento de itens no cardapio (ex: "Pizzas", "Bebidas").

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | String (cuid) | PK |
| restaurantId | String (FK) | Cascade delete |
| name | String | Nome da categoria |
| sortOrder | Int | Ordem de exibicao |

**MenuItem** — Item do cardapio.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | String (cuid) | PK |
| categoryId | String (FK) | Cascade delete |
| restaurantId | String (FK) | Cascade delete |
| name | String | Nome do item |
| description | String? | Descricao |
| priceInCents | Int | Preco em centavos (nunca float) |
| imageUrl | String? | URL da imagem |
| isAvailable | Boolean | Soft-delete (false = removido) |
| sortOrder | Int | Ordem de exibicao |

**Order** — Pedido de um cliente.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | String (cuid) | PK |
| restaurantId | String (FK) | Cascade delete |
| orderNumber | Int | Sequencial por restaurante |
| customerName | String | Nome do cliente |
| customerPhone | String | Telefone (somente digitos) |
| status | OrderStatus | Estado atual do pedido |
| paymentMethod | PaymentMethod? | PIX ou CARD |
| stripePaymentIntentId | String? | ID do Stripe |
| totalInCents | Int | Total em centavos |

**OrderItem** — Snapshot de item no momento do pedido.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | String (cuid) | PK |
| orderId | String (FK) | Cascade delete |
| menuItemId | String (FK) | Referencia (sem cascade) |
| name | String | Nome no momento do pedido |
| priceInCents | Int | Preco no momento do pedido |
| quantity | Int | Quantidade |

**MenuItemImage** — Imagem de um item do cardapio. Armazenada no Vercel Blob.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | String (cuid) | PK |
| menuItemId | String (FK) | Cascade delete |
| url | String | URL da imagem no Vercel Blob |
| sortOrder | Int | Ordem de exibicao (0 = imagem principal/thumbnail) |

### Enums

**OrderStatus** — Maquina de estados:
```
CREATED → PAYMENT_PENDING → PAYMENT_APPROVED → PREPARING → READY → PICKED_UP
              ↓                    ↓                ↓          ↓         ↓
          CANCELLED            CANCELLED         CANCELLED  CANCELLED CANCELLED
```

**PaymentMethod**: `PIX` | `CARD`

---

## Autenticacao

### Mecanismo: JWT em Cookie HttpOnly

- **Biblioteca**: jose (compativel com Edge/Vercel)
- **Algoritmo**: HS256
- **Expiracao**: 7 dias
- **Cookie**: `restaurant_session` (HttpOnly, Secure, SameSite=Strict)

### Fluxo

```
Cliente POST /api/auth/login {email, password}
    → Busca restaurante por email
    → bcrypt.compare(password, hash)
    → Assina JWT {restaurantId, slug, email}
    → Set-Cookie: restaurant_session=<token>
    → 200 {id, name, slug, email}

Backoffice Layout (Server Component)
    → Le cookie via cookies()
    → verifyJwt(token)
    → Se invalido: redirect('/backoffice/login')
    → Se valido: renderiza children com AdminNav

API Protegida (settings, stats)
    → getAuthFromRequest(request)
    → Valida que auth.restaurantId == restaurante da URL
    → Impede acesso cross-tenant
```

---

## Multi-Tenancy

O modelo e **slug-based**: cada restaurante tem um slug unico que define o escopo de todos os dados.

- URLs do consumidor: `/{slug}`, `/{slug}/cart`, `/{slug}/checkout`
- APIs: `/api/restaurants/{slug}/...`
- Backoffice: autenticacao identifica o restaurante via JWT

**Isolamento**: todas as queries sao filtradas por `restaurantId`. Rotas protegidas validam que o JWT pertence ao restaurante da URL.

---

## Padroes Arquiteturais

### Precos em Centavos
Todos os precos sao armazenados e trafegados como **inteiros em centavos** (`priceInCents`). Formatacao para BRL (`R$ XX,XX`) acontece apenas na camada de UI.

### Snapshot de Pedidos
`OrderItem` copia `name` e `priceInCents` no momento da criacao. Alteracoes futuras no cardapio nao afetam pedidos existentes.

### Soft Delete de Itens
`DELETE` em `MenuItem` seta `isAvailable = false` em vez de remover o registro, preservando integridade referencial com `OrderItem`.

### Prisma 7 com Driver Adapter
```typescript
// src/lib/db.ts — OBRIGATORIO
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
```
`new PrismaClient()` sem adapter **falha** no Prisma 7.

### Carrinho Client-Side
O carrinho usa `localStorage` com chave `cart:{slug}`. Toda a logica esta em `src/lib/cart.ts` e o estado e gerenciado pelo `CartProvider` (React Context).

---

## Estrategia de Testes

### Tres Camadas

| Camada | Ferramenta | Escopo | Arquivos |
|--------|-----------|--------|----------|
| Unit | Vitest + RTL | Funcoes puras, componentes isolados | 23 |
| Integration | Vitest + DB real | API routes contra Postgres | 9 |
| E2E | Playwright | Fluxos completos no browser | 17 |

### Quality Gates (CI)

Todos devem passar para merge:
1. `tsc --noEmit` — sem erros de tipo
2. `eslint .` — sem erros de lint
3. `vitest run --coverage` — testes unitarios e integracao
4. `playwright test` — testes E2E
5. Coverage >= 80% em arquivos novos (warning)

---

## Variaveis de Ambiente

### Obrigatorias

| Variavel | Descricao |
|----------|-----------|
| `DATABASE_URL` | Connection string PostgreSQL |
| `JWT_SECRET` | Chave secreta para assinar JWTs |

### Opcionais (por feature)

| Variavel | Descricao |
|----------|-----------|
| `BLOB_READ_WRITE_TOKEN` | Token Vercel Blob para upload de imagens |
| `STRIPE_WEBHOOK_SECRET` | Validacao de webhooks Stripe |
| `TWILIO_ACCOUNT_SID` | Conta Twilio (fallback app-level) |
| `TWILIO_AUTH_TOKEN` | Token Twilio |
| `TWILIO_WHATSAPP_FROM` | Numero de envio WhatsApp |

> WhatsApp: credenciais sao armazenadas **por restaurante** no banco (`whatsappApiConfig`). As env vars sao fallback.

---

## Deploy

### Producao
- **Plataforma**: Vercel (auto-deploy on merge to main)
- **Banco**: Supabase PostgreSQL (Session Pooler)
- **URL**: https://agent-dev-pipeline.vercel.app
- **Regiao**: iad1 (US East)

### CI/CD Flow
```
Push to feature/ branch
    → CI Quality Gates (GitHub Actions, ubuntu-latest)
    → Se passa: merge to main (manual ou via agent)
    → Vercel detecta push em main
    → Build + deploy automatico
```
