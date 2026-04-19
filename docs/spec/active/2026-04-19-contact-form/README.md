---
project_id: SPEC-2026-04-19-001
project_name: "Formulário de Contato"
slug: contact-form
status: in-review
created: 2026-04-19T00:00:00Z
approved: null
started: null
completed: null
expires: 2026-07-19T00:00:00Z
superseded_by: null
tags: [contact-form, lead-capture, landing-page]
stakeholders: []
worktree:
  branch: claude/modest-proskuriakova-eb921d
  base_branch: main
---

# Formulário de Contato

## Summary

Criar uma página `/contato` com formulário de captura de leads para restaurantes interessados no Cardápio Rápido. O botão "Quero abrir minha loja" na hero section deve redirecionar para esta página em vez do anchor `#contato`.

## Current State

- HeroSection tem link `href="#contato"` (linha 31)
- ContactSection atual usa mailto para contato@cardapiorapido.com.br
- Não há página `/contato` dedicada

## Proposed Changes

1. Criar página `/contato` com formulário
2. Atualizar link na HeroSection de `#contato` para `/contato`
3. Formulário salva dados em `form.txt` na raiz

## Status

- [x] Project initialized
- [x] Requirements elicitation
- [x] Architecture design
- [x] Implementation plan
- [ ] Review and approval
