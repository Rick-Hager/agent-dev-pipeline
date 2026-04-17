# Pipeline de Desenvolvimento Agenticol

## Visao Geral

O MenuApp usa um pipeline automatizado onde **agentes IA implementam features a partir de GitHub Issues**, sem escrita manual de codigo. O processo segue TDD, passa por CI automatizado, e faz deploy via Vercel.

---

## Fluxo Completo

```
1. Humano cria GitHub Issue (usando template)
       ↓
2. Humano adiciona label "agent-ready"
       ↓
3. GitHub Actions detecta a label
       ↓
4. Workflow roda no self-hosted runner (Mac local)
       ↓
5. Claude Code (Maestro) le a issue e orquestra:
   a. Cria branch feature/issue-{N}-{slug}
   b. Delega para Backend Agent → implementa API + testes
   c. Delega para Frontend Agent → implementa UI + testes
   d. Delega para Test Agent → escreve testes E2E
   e. Roda suite completa de testes
   f. Faz commit e push
       ↓
6. Workflow cria PR automaticamente
       ↓
7. CI Quality Gates roda (GitHub Actions, ubuntu-latest):
   - Type check (tsc)
   - Lint (eslint)
   - Unit + Integration tests (vitest)
   - E2E tests (playwright)
       ↓
8. Se CI falha: Agent Fix tenta corrigir automaticamente
       ↓
9. Humano revisa e faz merge
       ↓
10. Vercel detecta push em main → deploy automatico
```

---

## Arquitetura dos Agentes

### Hierarquia

```
Maestro (orquestrador)
├── Backend Agent (APIs, schema, testes unit/integration)
├── Frontend Agent (paginas, componentes, testes de componente)
└── Test Agent (testes E2E)
```

### Maestro (`agents/maestro.md`)

**Responsabilidades**:
- Le a issue do GitHub
- Valida que tem criterios de aceitacao
- Cria feature branch
- Decompoeem o trabalho e delega sequencialmente
- Roda a suite de testes completa
- Faz push e reporta resultado

**Regras**:
- Maximo 3 retries por agente delegado
- Maximo 2 tentativas de fix de CI
- Se falhar: comenta na issue e adiciona label `agent-blocked`

### Backend Agent (`agents/backend.md`)

**Escopo permitido**:
- `src/app/api/` — Route Handlers
- `prisma/schema.prisma` — Schema do banco
- `src/lib/` — Logica de negocio
- `tests/unit/` e `tests/integration/` — Testes

**Escopo proibido**: Componentes, paginas, agentes

### Frontend Agent (`agents/frontend.md`)

**Escopo permitido**:
- `src/app/` — Paginas e layouts (exceto `api/`)
- `src/components/` — Componentes React
- `tests/unit/` — Testes de componente

**Regras**:
- Mobile-first (max-w-lg para consumidor, full width para backoffice)
- Nunca toca em API routes

### Test Agent (`agents/test.md`)

**Escopo permitido**:
- `tests/e2e/` — Apenas testes Playwright

**Regras**:
- Um teste por criterio de aceitacao
- Roda suite completa e reporta
- Nunca corrige implementacao (apenas testa)

---

## Workflows do GitHub Actions

### Agent Trigger (`agent-trigger.yml`)

**Trigger**: Issue recebe label `agent-ready`
**Runner**: `self-hosted` (Mac local)
**Timeout**: 30 minutos
**Max turns**: 100

**Etapas**:
1. Checkout do repositorio
2. `npm ci` + `prisma generate` + `prisma db push`
3. Atualiza labels: remove `agent-ready`, adiciona `agent-working`
4. Salva body da issue em `/tmp/issue-body.txt`
5. Executa `claude --print` com prompt do Maestro
6. Se branch criada: cria PR automaticamente
7. Remove label `agent-working`
8. Se falhou: comenta na issue, adiciona `agent-blocked`

### Agent Fix (`agent-fix.yml`)

**Trigger**: Check suite falha em branch `feature/`
**Runner**: `self-hosted` (Mac local)
**Timeout**: 15 minutos
**Max turns**: 30

**Etapas**:
1. Checkout da branch com falha
2. Setup do ambiente
3. Verifica contagem de retries (maximo 2 commits `fix: ci`)
4. Se abaixo do limite: executa Claude para reproduzir e corrigir falhas
5. Se atingiu limite: comenta no PR pedindo revisao humana

### CI Quality Gates (`ci.yml`)

**Trigger**: PR para `main`
**Runner**: `ubuntu-latest` (GitHub hosted)
**Servicos**: PostgreSQL 16 (Docker container)

**Checks**:
1. `tsc --noEmit` — zero erros de tipo
2. `eslint .` — zero erros de lint
3. `vitest run --coverage` — todos os testes passam
4. `playwright test` — todos os E2E passam
5. Coverage >= 80% (warning)

---

## Self-Hosted Runner

### Por que Self-Hosted?

Os workflows de agentes (trigger e fix) usam Claude Code CLI, que consome tokens. Rodar no runner local usa os tokens da assinatura Claude (Pro/Max) em vez de creditos da API, eliminando custo.

### Configuracao

**Localizacao**: `~/actions-runner/`

**Iniciar**:
```bash
cd ~/actions-runner && ./start-runner.sh
```

**Ou como servico (auto-start no boot)**:
```bash
cd ~/actions-runner
sudo ./svc.sh install
sudo ./svc.sh start
```

**Prerequisitos no Mac**:
- Node.js 20+ (`/opt/homebrew/bin/node`)
- PostgreSQL 16 (`brew services start postgresql@16`)
- Claude Code CLI (`~/.local/bin/claude`) — autenticado
- gh CLI (`/opt/homebrew/bin/gh`) — autenticado

**Arquivo `.env` do runner** (`~/actions-runner/.env`):
```
PATH=/Users/superrick/.local/bin:/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin
```

### Separacao de Responsabilidades

| Workflow | Runner | Motivo |
|----------|--------|--------|
| Agent Trigger | self-hosted (Mac) | Usa Claude Code com tokens locais |
| Agent Fix | self-hosted (Mac) | Usa Claude Code com tokens locais |
| CI Quality Gates | ubuntu-latest (GitHub) | Nao usa Claude, roda testes apenas |

---

## GitHub Issue Template

O repositorio tem um template estruturado em `.github/ISSUE_TEMPLATE/agent-task.yml` com campos:

- **Tipo**: feature / bugfix / refactor
- **Descricao**: O que implementar
- **Criterios de Aceitacao** (obrigatorio): Lista de checkboxes
- **Contexto Tecnico** (opcional): Arquivos, APIs, padroes
- **Prioridade**: alta / media / baixa

### Exemplo de Issue Bem Escrita

```markdown
## feat: Relatorios de vendas por periodo

### Descricao
Adicionar uma pagina no backoffice que exiba relatorios de vendas
com graficos e filtros por periodo.

### Criterios de Aceitacao
- [ ] Pagina /backoffice/reports acessivel via AdminNav
- [ ] Filtro de periodo com data inicial e final
- [ ] Card com total de vendas no periodo
- [ ] Card com quantidade de pedidos no periodo
- [ ] Card com ticket medio
- [ ] Tabela com vendas por dia
- [ ] Requer autenticacao
- [ ] Integration test para endpoint de relatorios
- [ ] E2E test: login, navegar para relatorios, filtrar periodo

### Contexto Tecnico
- API: GET /api/restaurants/{slug}/reports?dateFrom=&dateTo=
- Pagina: src/app/backoffice/(protected)/reports/page.tsx
- Seguir padrao do Dashboard (StatCard para metricas)
- Usar Prisma aggregate para calculos

### Prioridade
media
```

---

## Labels do Pipeline

| Label | Significado |
|-------|------------|
| `agent-ready` | Issue pronta para implementacao automatica |
| `agent-working` | Agente esta trabalhando na issue |
| `agent-blocked` | Agente falhou, precisa revisao humana |

---

## Operacao do Pipeline

### Disparar uma Feature

```bash
# 1. Criar issue (pelo GitHub ou CLI)
gh issue create --title "feat: Nova feature" --body "..."

# 2. Adicionar label para disparar o agente
gh issue edit <N> --add-label "agent-ready"

# 3. Monitorar
gh run list --limit 5
```

### Quando CI Falha no PR

```bash
# Verificar logs de falha
gh run view <RUN_ID> --log-failed

# Opcao A: Agent Fix tenta corrigir automaticamente
# (acontece sozinho se runner esta rodando)

# Opcao B: Corrigir manualmente
git checkout <branch>
# ... fix ...
git push

# Retrigger CI (GITHUB_TOKEN nao dispara outros workflows)
gh pr close <N> && gh pr reopen <N>
```

### Merge

```bash
# Apos CI passar
gh pr merge <N> --merge --admin
```

---

## Limitacoes Conhecidas

1. **GITHUB_TOKEN nao dispara workflows**: PRs criadas por GITHUB_TOKEN nao ativam CI automaticamente. Workaround: close/reopen o PR.

2. **Concorrencia**: Agents nao devem rodar em paralelo na mesma branch. Issues independentes podem rodar em paralelo (branches diferentes).

3. **Complexidade**: Issues muito grandes (ex: Stripe com muitos endpoints) podem exceder o limite de turnos. Solucao: aumentar `--max-turns` ou decompor a issue.

4. **Rate limits**: Multiplos agents simultaneos podem atingir rate limits da API. Com self-hosted runner e assinatura Max, isso e mitigado.

5. **Shell escaping**: O body da issue e salvo em arquivo (`/tmp/issue-body.txt`) em vez de interpolado no shell, para evitar problemas com caracteres especiais.
