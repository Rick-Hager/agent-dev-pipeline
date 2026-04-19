---
document_type: requirements
project_id: SPEC-2026-04-19-001
version: 1.0.0
last_updated: 2026-04-19
status: draft
---

# Formulário de Contato - Product Requirements Document

## Executive Summary

Criar uma página `/contato` dedicada para captura de leads de restaurantes interessados no Cardápio Rápido. O formulário coleta informações básicas do estabelecimento e salva em arquivo CSV para processamento posterior. A seção de contato atual na homepage será removida.

## Problem Statement

### The Problem

O fluxo atual de captação de leads usa um link mailto, que é pouco rastreável e depende do cliente ter um email configurado no navegador.

### Impact

Leads potenciais são perdidos quando o mailto não funciona ou quando o usuário abandona antes de enviar o email.

### Current State

- Botão "Quero abrir minha loja" leva para `#contato` (anchor na página)
- Seção ContactSection mostra link mailto
- Não há captura estruturada de dados

## Goals and Success Criteria

### Primary Goal

Capturar informações de restaurantes interessados de forma estruturada e confiável.

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Taxa de conversão | Maior que mailto | Comparar envios vs visitas |
| Dados completos | 100% | Validação frontend |

### Non-Goals

- Sistema de CRM ou gestão de leads
- Envio de emails automáticos
- Dashboard de análise

## User Analysis

### Primary Users

- **Donos de restaurantes** que querem digitalizar seu cardápio
- **Gerentes** avaliando soluções de pedidos online

### User Stories

1. Como dono de restaurante, quero preencher um formulário simples para que a equipe do Cardápio Rápido entre em contato comigo.
2. Como visitante, quero ver uma confirmação clara de que meus dados foram enviados.

## Functional Requirements

### Must Have (P0)

| ID | Requirement | Rationale | Acceptance Criteria |
|----|-------------|-----------|---------------------|
| FR-001 | Página /contato com formulário | Core feature | Acessível via URL direta |
| FR-002 | Campos: nome, email, nome do restaurante, endereço, pedidos/dia | Dados necessários para qualificação | Todos renderizados e funcionais |
| FR-003 | Salvar em form.txt na raiz (CSV) | Persistência simples | Cada envio = nova linha |
| FR-004 | Mensagem "formulário enviado" | Feedback ao usuário | Exibida após sucesso |
| FR-005 | Validação de email | Evitar dados inválidos | Formato válido requerido |
| FR-006 | Atualizar HeroSection href | Navegação correta | Link aponta para /contato |
| FR-007 | Remover ContactSection da home | Consolidar em única página | Seção não renderiza |

### Should Have (P1)

| ID | Requirement | Rationale | Acceptance Criteria |
|----|-------------|-----------|---------------------|
| FR-101 | Loading state no botão | UX durante envio | Botão desabilitado enquanto salva |
| FR-102 | Tratamento de erro | Resiliência | Mensagem de erro se falhar |

## Non-Functional Requirements

### Performance

- Tempo de resposta do formulário < 1s

### Security

- Dados salvos no servidor (não expostos no cliente)
- API route valida input

### Maintainability

- Componente isolado para o formulário
- Tipos TypeScript para os dados

## Technical Constraints

- Next.js App Router (conforme projeto)
- TypeScript strict mode
- Tailwind CSS para estilos
- Prisma não necessário (arquivo texto)

## Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Arquivo form.txt cresce muito | Low | Low | Rotacionar periodicamente |
| Concorrência de escrita | Low | Medium | appendFileSync é atômico o suficiente |

## Open Questions

- [x] Formato do arquivo → CSV
- [x] O que fazer com ContactSection → Remover
- [x] Validações → Email obrigatório
