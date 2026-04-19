---
document_type: implementation_plan
project_id: SPEC-2026-04-19-001
version: 1.0.0
last_updated: 2026-04-19
status: draft
estimated_effort: 2-3 horas
---

# Formulário de Contato - Implementation Plan

## Overview

Implementação TDD de formulário de contato com 7 tarefas em 3 fases.

## Phase Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1: Backend | ~1h | API route + testes |
| Phase 2: Frontend | ~1h | Página + componente + testes |
| Phase 3: Integration | ~30min | Atualizar home, remover ContactSection |

---

## Phase 1: Backend (API Route)

**Goal**: API funcional que salva dados em CSV

### Task 1.1: Criar teste da API route

- **Description**: Escrever teste unitário para POST /api/contact
- **Estimated Effort**: 15 min
- **Dependencies**: None
- **Acceptance Criteria**:
  - [ ] Teste para request válido → 200 + escrita no arquivo
  - [ ] Teste para email inválido → 400
  - [ ] Teste de escape CSV (vírgulas, aspas)

### Task 1.2: Implementar API route

- **Description**: Criar `/api/contact/route.ts` que passa os testes
- **Estimated Effort**: 30 min
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - [ ] Valida campos obrigatórios
  - [ ] Valida formato de email
  - [ ] Escapa valores CSV corretamente
  - [ ] Append ao form.txt com timestamp
  - [ ] Cria header se arquivo não existe
  - [ ] Retorna JSON {success, message}

### Phase 1 Deliverables

- [ ] `/api/contact/route.ts` funcional
- [ ] Testes passando
- [ ] form.txt criado com header CSV

---

## Phase 2: Frontend (Página e Componente)

**Goal**: Página /contato com formulário funcional

### Task 2.1: Criar teste do componente ContactForm

- **Description**: Teste de renderização e submit do formulário
- **Estimated Effort**: 15 min
- **Dependencies**: None
- **Acceptance Criteria**:
  - [ ] Renderiza todos os campos
  - [ ] Submit chama API
  - [ ] Mostra mensagem de sucesso
  - [ ] Mostra erro em email inválido

### Task 2.2: Implementar ContactForm

- **Description**: Componente client com formulário
- **Estimated Effort**: 30 min
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - [ ] Campos: nome, email, nomeRestaurante, endereco, pedidosPorDia
  - [ ] Validação de email inline
  - [ ] Loading state no botão
  - [ ] Success state com mensagem "formulário enviado"
  - [ ] Error handling

### Task 2.3: Criar página /contato

- **Description**: Page component que usa ContactForm
- **Estimated Effort**: 15 min
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - [ ] Rota `/contato` acessível
  - [ ] Layout consistente com landing page
  - [ ] Título e descrição

### Phase 2 Deliverables

- [ ] `ContactForm.tsx` funcional
- [ ] `/contato/page.tsx` acessível
- [ ] Testes passando

---

## Phase 3: Integration

**Goal**: Conectar tudo e limpar código legado

### Task 3.1: Atualizar HeroSection

- **Description**: Mudar href de `#contato` para `/contato`
- **Estimated Effort**: 5 min
- **Dependencies**: Phase 2
- **Acceptance Criteria**:
  - [ ] Link aponta para /contato
  - [ ] Teste E2E: click → navega para /contato

### Task 3.2: Remover ContactSection da home

- **Description**: Remover import e uso de ContactSection em page.tsx
- **Estimated Effort**: 5 min
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - [ ] ContactSection não renderiza na home
  - [ ] Pode manter arquivo ou deletar (decision: manter para histórico)

### Task 3.3: Teste E2E completo

- **Description**: Fluxo completo: home → click → preencher → enviar → sucesso
- **Estimated Effort**: 15 min
- **Dependencies**: Tasks 3.1, 3.2
- **Acceptance Criteria**:
  - [ ] Teste Playwright passa
  - [ ] form.txt contém dados do teste

### Phase 3 Deliverables

- [ ] HeroSection atualizado
- [ ] ContactSection removido da home
- [ ] Teste E2E passando

---

## Dependency Graph

```
Phase 1: Backend
  Task 1.1 (test) ──▶ Task 1.2 (impl)
                           │
                           ▼
Phase 2: Frontend      (API ready)
  Task 2.1 (test) ──▶ Task 2.2 (impl) ──▶ Task 2.3 (page)
                                              │
                                              ▼
Phase 3: Integration                    (Page ready)
  Task 3.1 (hero) ──▶ Task 3.2 (remove) ──▶ Task 3.3 (e2e)
```

## Testing Checklist

- [ ] Unit tests para API route (validation, CSV escape)
- [ ] Unit tests para ContactForm (render, submit, states)
- [ ] E2E test para fluxo completo

## Launch Checklist

- [ ] Todos os testes passando
- [ ] Build sem erros
- [ ] form.txt no .gitignore
- [ ] Manual test no dev server
