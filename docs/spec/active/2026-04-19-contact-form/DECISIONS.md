---
document_type: decisions
project_id: SPEC-2026-04-19-001
---

# Formulário de Contato - Architecture Decision Records

## ADR-001: Persistência em Arquivo CSV

**Date**: 2026-04-19
**Status**: Accepted
**Deciders**: User

### Context

Precisamos armazenar os dados do formulário de contato. Opções consideradas:
- Banco de dados (Prisma/PostgreSQL existente)
- Arquivo JSON
- Arquivo CSV
- Serviço externo (Google Sheets, Airtable)

### Decision

Usar arquivo CSV (`form.txt`) na raiz do projeto.

### Consequences

**Positive:**
- Simples de implementar
- Fácil de exportar/importar em planilhas
- Sem dependências adicionais
- Atende ao requisito explícito do usuário

**Negative:**
- Sem queries ou buscas
- Concorrência limitada (acceptable para volume esperado)
- Perde dados em deploy (pode ser mitigado com volume persistente)

**Neutral:**
- Precisará de rotação manual se crescer muito

---

## ADR-002: Remover ContactSection em vez de Modificar

**Date**: 2026-04-19
**Status**: Accepted
**Deciders**: User

### Context

A homepage tem uma seção ContactSection com mailto. Com a nova página /contato, precisamos decidir o que fazer com ela.

### Decision

Remover completamente a ContactSection da homepage. O arquivo pode ser mantido no repo para histórico.

### Consequences

**Positive:**
- UX mais limpo (um único ponto de contato)
- Menos código para manter
- Força usuários para o formulário rastreável

**Negative:**
- Perde opção de email direto para quem prefere

---

## ADR-003: Validação Mínima (Email Only)

**Date**: 2026-04-19
**Status**: Accepted
**Deciders**: User

### Context

Formulários podem ter validação extensiva ou mínima.

### Decision

Validar apenas formato de email. Demais campos são livres.

### Consequences

**Positive:**
- UX com menos fricção
- Implementação mais simples

**Negative:**
- Pode receber dados incompletos
- Campo pedidos/dia pode ter valores não numéricos

### Alternatives Considered

1. **Todos os campos obrigatórios**: Rejeitado - mais fricção
2. **Validação de número para pedidos**: Pode adicionar em v2 se necessário
