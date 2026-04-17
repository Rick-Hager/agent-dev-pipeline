# MenuApp — Agent Development Pipeline

Plataforma multi-tenant de cardapio digital e gestao de pedidos para restaurantes, construida inteiramente por **agentes IA** a partir de GitHub Issues.

**Live:** [agent-dev-pipeline.vercel.app](https://agent-dev-pipeline.vercel.app)

## O que e isto?

Um projeto que demonstra um **pipeline de desenvolvimento agenticol**: humanos escrevem GitHub Issues com criterios de aceitacao, e agentes IA (Claude Code) implementam o codigo com TDD, passam por CI automatizado, e fazem deploy via Vercel — sem escrita manual de codigo.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16 (App Router) + TypeScript |
| UI | React 19 + Tailwind CSS 4 |
| Banco | PostgreSQL 16 via Prisma 7 |
| Auth | JWT (jose) + bcryptjs |
| Pagamentos | Stripe (PIX + Card) |
| Notificacoes | WhatsApp via Twilio |
| Testes | Vitest + Playwright |
| Deploy | Vercel (auto-deploy) |
| Banco Prod | Supabase |
| Agentes | Claude Code CLI (self-hosted runner) |

## Features Implementadas

18 features implementadas por agentes:

- Cardapio digital publico com QR code
- Carrinho de compras (localStorage)
- Checkout com dados do cliente
- Sistema de pedidos com status tracking
- Kitchen Display System (KDS) com auto-refresh
- Pagamentos Stripe (PIX + Cartao)
- Notificacoes WhatsApp via Twilio
- Backoffice protegido com JWT
- CRUD completo de cardapio (categorias + itens)
- Dashboard com metricas em tempo real
- Configuracoes do restaurante
- Galeria de imagens de produtos (upload Vercel Blob, swipe gallery, drag-and-drop)
- Landing page com listagem de restaurantes

Detalhes completos em [`docs/features.md`](docs/features.md).

## Pipeline Agenticol

```
Humano cria Issue → Label "agent-ready" → GitHub Actions →
Claude Code (Maestro) orquestra agentes → TDD → CI → PR →
Humano revisa → Merge → Vercel deploy
```

O pipeline usa um **self-hosted runner** (Mac local) para executar Claude Code com tokens da assinatura, sem custo de API.

Detalhes em [`docs/agent-pipeline.md`](docs/agent-pipeline.md).

## Desenvolvimento Local

```bash
# Instalar dependencias
npm ci

# Configurar banco local
cp .env.example .env  # editar DATABASE_URL e JWT_SECRET
npx prisma generate
npx prisma db push
npx prisma db seed

# Rodar
npm run dev
```

## Testes

```bash
npm run test          # Unit + Integration (Vitest)
npm run test:e2e      # E2E (Playwright)
npm run test:coverage # Com coverage report
```

## Documentacao

- [`docs/architecture.md`](docs/architecture.md) — Arquitetura tecnica completa
- [`docs/features.md`](docs/features.md) — Catalogo de features + template para novas
- [`docs/agent-pipeline.md`](docs/agent-pipeline.md) — Pipeline agenticol e operacao

## Como Adicionar uma Feature

1. Criar GitHub Issue usando o template `agent-task`
2. Preencher criterios de aceitacao detalhados
3. Adicionar label `agent-ready`
4. O pipeline faz o resto

Template completo em [`docs/features.md`](docs/features.md#template-para-especificacao-de-nova-feature).

## Licenca

Projeto privado — uso educacional e demonstracao.
