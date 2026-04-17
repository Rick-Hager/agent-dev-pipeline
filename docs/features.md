# MenuApp — Catalogo de Funcionalidades

Este documento descreve todas as funcionalidades implementadas no MenuApp. Cada feature segue um formato padrao que serve como **template para especificacao de novas funcionalidades**.

---

## Indice

### Consumidor (Cliente Final)
1. [Cardapio Digital](#1-cardapio-digital)
2. [Carrinho de Compras](#2-carrinho-de-compras)
3. [Checkout e Pedido](#3-checkout-e-pedido)
4. [Acompanhamento de Pedido](#4-acompanhamento-de-pedido)

### Cozinha
5. [KDS — Kitchen Display System](#5-kds--kitchen-display-system)

### Backoffice (Dono do Restaurante)
6. [Autenticacao (Login/Logout)](#6-autenticacao-loginlogout)
7. [Dashboard Administrativo](#7-dashboard-administrativo)
8. [Gestao de Cardapio](#8-gestao-de-cardapio)
9. [Dashboard de Pedidos](#9-dashboard-de-pedidos)
10. [Configuracoes do Restaurante](#10-configuracoes-do-restaurante)

### APIs Base
11. [Restaurant API](#11-restaurant-api)
12. [Category API](#12-category-api)
13. [MenuItem API](#13-menuitem-api)
14. [Order API](#14-order-api)

### Integracoes
15. [Stripe — Pagamentos PIX e Cartao](#15-stripe--pagamentos-pix-e-cartao)
16. [WhatsApp — Notificacoes via Twilio](#16-whatsapp--notificacoes-via-twilio)

### Infraestrutura
17. [Database Seed](#17-database-seed)

---

## Formato de Especificacao

Cada feature abaixo segue este formato. **Ao descrever novas funcionalidades, use a mesma estrutura:**

```
### N. Nome da Feature

**Objetivo**: O que a feature faz e por que existe.

**Fluxo do Usuario**: Passo a passo de como o usuario interage.

**Componentes**:
- Paginas: onde o usuario acessa
- Componentes: elementos de UI envolvidos
- APIs: endpoints consumidos
- Lib: logica de negocio

**Regras de Negocio**: Comportamentos obrigatorios.

**Criterios de Aceitacao**: Lista verificavel de "pronto".

**Testes Existentes**: Quais testes cobrem esta feature.
```

---

## Consumidor (Cliente Final)

### 1. Cardapio Digital

**Objetivo**: Permitir que clientes visualizem o cardapio completo de um restaurante acessando uma URL unica (ex: QR code).

**Fluxo do Usuario**:
1. Cliente acessa `/{slug}` (ex: `/pizzaria-bella`)
2. Ve o nome do restaurante e categorias organizadas
3. Cada categoria mostra seus itens com nome, descricao e preco
4. Itens indisponiveis (`isAvailable = false`) nao aparecem
5. Botao "Adicionar" em cada item adiciona ao carrinho
6. Badge no header mostra quantidade de itens no carrinho

**Componentes**:
- Pagina: `src/app/[slug]/page.tsx` (Server Component)
- Componentes: `AddToCartButton`, `CartBadge`, `CartProvider`
- API: `GET /api/restaurants/{slug}/menu`
- Lib: `cart.ts` (addItemToCart, getTotalItems)

**Regras de Negocio**:
- Apenas itens com `isAvailable = true` sao exibidos
- Categorias ordenadas por `sortOrder`
- Itens ordenados por `sortOrder` dentro da categoria
- Precos exibidos em BRL (R$ XX,XX) — armazenados em centavos

**Criterios de Aceitacao**:
- [ ] Acessar `/{slug}` exibe o nome do restaurante
- [ ] Categorias e itens aparecem ordenados
- [ ] Itens indisponiveis nao aparecem na listagem
- [ ] Botao "Adicionar" adiciona item ao carrinho
- [ ] Badge do carrinho atualiza com a quantidade correta
- [ ] Slug inexistente retorna 404

**Testes Existentes**:
- Unit: `MenuPage.test.tsx`
- E2E: `consumer-menu.spec.ts`

---

### 2. Carrinho de Compras

**Objetivo**: Permitir que o cliente revise, ajuste quantidades e remova itens antes de finalizar o pedido.

**Fluxo do Usuario**:
1. Cliente clica no badge do carrinho ou navega para `/{slug}/cart`
2. Ve lista de itens com nome, preco unitario, quantidade e subtotal
3. Pode aumentar/diminuir quantidade com botoes +/-
4. Quantidade zero remove o item
5. Ve o total geral
6. Pode limpar o carrinho inteiro
7. Botao "Finalizar Pedido" leva ao checkout

**Componentes**:
- Pagina: `src/app/[slug]/cart/page.tsx` (Client Component)
- Componentes: `CartProvider` (contexto)
- Lib: `cart.ts` (loadCart, saveCart, updateItemQuantity, getTotalInCents)

**Regras de Negocio**:
- Carrinho persiste em `localStorage` com chave `cart:{slug}`
- Cada restaurante tem carrinho independente
- Adicionar item existente incrementa quantidade (nao duplica)
- Total calculado como soma de `priceInCents * quantity`

**Criterios de Aceitacao**:
- [ ] Carrinho mostra itens adicionados com quantidades corretas
- [ ] Botoes +/- alteram quantidade
- [ ] Quantidade zero remove o item
- [ ] Total reflete a soma correta
- [ ] Carrinho persiste ao recarregar a pagina
- [ ] "Limpar carrinho" remove todos os itens
- [ ] Carrinho vazio mostra mensagem apropriada

**Testes Existentes**:
- Unit: `cart.test.ts`, `CartProvider.test.tsx`
- E2E: `cart.spec.ts`

---

### 3. Checkout e Pedido

**Objetivo**: Permitir que o cliente informe seus dados e confirme o pedido.

**Fluxo do Usuario**:
1. Cliente acessa `/{slug}/checkout` (vindo do carrinho)
2. Ve resumo do pedido (itens + total)
3. Preenche nome e telefone (com mascara)
4. Clica "Confirmar Pedido"
5. Sistema cria o pedido via API
6. Carrinho e limpo
7. Cliente e redirecionado para a pagina de acompanhamento

**Componentes**:
- Pagina: `src/app/[slug]/checkout/page.tsx` (Client Component)
- API: `POST /api/restaurants/{slug}/orders`
- Lib: `validation.ts` (validatePhone)

**Regras de Negocio**:
- Nome e telefone sao obrigatorios
- Telefone validado e armazenado somente digitos
- Pedido criado com status `CREATED`
- `orderNumber` sequencial por restaurante (com retry em caso de race condition)
- `OrderItem` armazena snapshot de nome e preco
- Total calculado no servidor (nao confia no cliente)

**Criterios de Aceitacao**:
- [ ] Resumo mostra itens e total corretos
- [ ] Validacao impede envio sem nome ou telefone
- [ ] Pedido e criado com numero sequencial
- [ ] Carrinho limpo apos confirmacao
- [ ] Redirect para pagina de acompanhamento
- [ ] Checkout com carrinho vazio redireciona para o cardapio

**Testes Existentes**:
- Unit: `CheckoutPage.test.tsx`, `validation.test.ts`
- Integration: `orders.test.ts`
- E2E: `checkout.spec.ts`

---

### 4. Acompanhamento de Pedido

**Objetivo**: Permitir que o cliente acompanhe o status do seu pedido em tempo real.

**Fluxo do Usuario**:
1. Apos checkout, cliente e redirecionado para `/{slug}/pedido/{orderId}`
2. Ve numero do pedido, itens, total e status atual
3. Barra de progresso visual mostra as etapas
4. Pagina faz polling a cada 5 segundos para atualizar status
5. Se cancelado, mostra indicador vermelho

**Componentes**:
- Pagina: `src/app/[slug]/pedido/[orderId]/page.tsx` (Server Component)
- Componentes: `OrderStatusPolling`, `OrderProgressTracker`
- API: `GET /api/restaurants/{slug}/orders/{orderId}`

**Regras de Negocio**:
- Polling automatico a cada 5 segundos
- Status exibido com barra de progresso de 6 etapas
- Pedido cancelado mostra estado especial (vermelho)
- Dados do pedido sao imutaveis (snapshot)

**Criterios de Aceitacao**:
- [ ] Pagina exibe numero, itens, total e status
- [ ] Barra de progresso reflete o status atual
- [ ] Status atualiza automaticamente via polling
- [ ] Pedido cancelado mostra indicador especifico
- [ ] Pedido inexistente retorna erro

**Testes Existentes**:
- Unit: `OrderStatusPage.test.tsx`, `OrderProgressTracker.test.tsx`, `OrderStatusPolling.test.tsx`
- E2E: `order-status.spec.ts`

---

## Cozinha

### 5. KDS — Kitchen Display System

**Objetivo**: Painel para a cozinha visualizar e gerenciar pedidos em tempo real, organizado por status.

**Fluxo do Usuario**:
1. Funcionario acessa `/{slug}/kds`
2. Ve tres colunas: Novos, Preparando, Prontos
3. Cada coluna mostra cards de pedidos com numero, cliente, itens e tempo
4. Badge em cada coluna mostra a contagem
5. Botoes de acao avancam o status:
   - Novos → "Iniciar Preparo" (muda para PREPARING)
   - Preparando → "Marcar Pronto" (muda para READY)
   - Prontos → "Entregar" (muda para PICKED_UP)
6. Painel atualiza automaticamente a cada 30 segundos

**Componentes**:
- Pagina: `src/app/[slug]/kds/page.tsx` (Client Component)
- Componentes: `OrderCard`
- APIs: `GET /api/restaurants/{slug}/kds`, `PATCH /api/restaurants/{slug}/orders/{orderId}`

**Regras de Negocio**:
- Exibe apenas pedidos com status: PAYMENT_APPROVED, PREPARING, READY
- Ordenados por `createdAt` (mais antigo primeiro)
- Transicoes de status seguem a maquina de estados
- Polling a cada 30 segundos
- Apos acao, recarrega a lista imediatamente

**Criterios de Aceitacao**:
- [ ] Tres colunas renderizam com os pedidos corretos
- [ ] Badges mostram contagem por coluna
- [ ] Botao de acao avanca o status
- [ ] Pedido some da coluna apos avanco
- [ ] Painel atualiza automaticamente
- [ ] Coluna vazia mostra "Nenhum pedido"

**Testes Existentes**:
- Unit: `KdsPage.test.tsx`, `OrderCard.test.tsx`
- Integration: `kds.test.ts`
- E2E: `kds.spec.ts`

---

## Backoffice (Dono do Restaurante)

### 6. Autenticacao (Login/Logout)

**Objetivo**: Proteger o acesso ao backoffice com login por email/senha e sessao JWT.

**Fluxo do Usuario**:
1. Dono acessa `/backoffice/login`
2. Insere email e senha
3. Sistema valida credenciais e cria sessao (cookie JWT)
4. Redirect para `/backoffice/dashboard`
5. Todas as paginas do backoffice verificam a sessao
6. Botao "Logout" encerra a sessao e redireciona para login

**Componentes**:
- Pagina: `src/app/backoffice/login/page.tsx` (Client Component)
- Layout: `src/app/backoffice/(protected)/layout.tsx` (Server Component, gate)
- Componentes: `LogoutButton`
- APIs: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- Lib: `auth.ts`, `password.ts`

**Regras de Negocio**:
- JWT com expiracao de 7 dias
- Cookie HttpOnly, Secure, SameSite=Strict
- Layout protegido verifica JWT no servidor antes de renderizar
- APIs protegidas validam JWT E pertenencia ao restaurante (anti cross-tenant)
- Senha hashada com bcrypt (10 rounds)

**Criterios de Aceitacao**:
- [ ] Login com credenciais corretas redireciona para dashboard
- [ ] Login com credenciais erradas mostra erro
- [ ] Acessar backoffice sem sessao redireciona para login
- [ ] Logout limpa a sessao e redireciona para login
- [ ] Apos logout, nao e possivel acessar paginas protegidas
- [ ] JWT expirado redireciona para login

**Testes Existentes**:
- Unit: `LoginPage.test.tsx`, `auth.test.ts`, `password.test.ts`
- Integration: `auth.test.ts`
- E2E: `auth.spec.ts`

---

### 7. Dashboard Administrativo

**Objetivo**: Visao geral com metricas do dia e acesso rapido as funcoes do backoffice.

**Fluxo do Usuario**:
1. Dono acessa `/backoffice/dashboard` (apos login)
2. Ve tres cards: Pedidos Hoje, Receita Hoje, Pedidos Ativos
3. Abaixo, links rapidos: Gerenciar Cardapio, Ver Pedidos, Abrir KDS, Configuracoes
4. Sidebar (AdminNav) permite navegacao entre todas as secoes

**Componentes**:
- Pagina: `src/app/backoffice/(protected)/dashboard/page.tsx` (Server Component)
- Componentes: `StatCard`, `AdminNav`
- API: Consulta direta ao Prisma (Server Component, sem API intermediaria)

**Regras de Negocio**:
- "Pedidos Hoje": count de pedidos com status nao-cancelado criados hoje (UTC)
- "Receita Hoje": sum de `totalInCents` dos mesmos pedidos
- "Pedidos Ativos": count de pedidos com status PREPARING ou READY
- Valores monetarios formatados em BRL

**Criterios de Aceitacao**:
- [ ] Dashboard exibe tres metricas corretas
- [ ] Receita formatada em BRL (R$ X.XXX,XX)
- [ ] Links rapidos navegam para as paginas corretas
- [ ] AdminNav aparece em todas as paginas do backoffice
- [ ] Pagina requer autenticacao

**Testes Existentes**:
- Unit: `StatCard.test.tsx`, `AdminNav.test.tsx`
- Integration: `stats.test.ts`
- E2E: `dashboard.spec.ts`

---

### 8. Gestao de Cardapio

**Objetivo**: Permitir que o dono gerencie categorias e itens do cardapio com CRUD completo.

**Fluxo do Usuario**:
1. Dono acessa `/backoffice/menu`
2. Ve lista de categorias com seus itens
3. Pode criar, editar e excluir categorias
4. Pode criar, editar e excluir itens dentro de cada categoria
5. Pode marcar itens como disponivel/indisponivel
6. Todas as operacoes sao inline (sem navegacao)

**Componentes**:
- Pagina: `src/app/backoffice/(protected)/menu/page.tsx` (Server Component)
- Componentes: `MenuManager` (Client Component, CRUD completo)
- APIs: Category API + MenuItem API (ver secoes 12 e 13)

**Regras de Negocio**:
- Excluir categoria exclui todos os itens (cascade)
- Excluir item faz soft-delete (isAvailable = false)
- Preco deve ser inteiro positivo (centavos)
- Nome e obrigatorio para categorias e itens

**Criterios de Aceitacao**:
- [ ] Lista categorias e itens do restaurante autenticado
- [ ] Criar categoria com nome
- [ ] Editar nome de categoria
- [ ] Excluir categoria (com confirmacao)
- [ ] Criar item com nome, descricao e preco
- [ ] Editar campos do item
- [ ] Excluir item (soft-delete)
- [ ] Validacao de campos obrigatorios

**Testes Existentes**:
- Unit: `MenuManager.test.tsx`
- Integration: `categories.test.ts`, `menuItems.test.ts`
- E2E: `backoffice-menu.spec.ts`

---

### 9. Dashboard de Pedidos

**Objetivo**: Permitir que o dono visualize e filtre todos os pedidos do restaurante.

**Fluxo do Usuario**:
1. Dono acessa `/backoffice/orders`
2. Ve tabela de pedidos com: numero, cliente, status, total, data
3. Pode filtrar por status (dropdown)
4. Pode filtrar por periodo (data inicial e final)
5. Paginacao para navegar entre paginas

**Componentes**:
- Pagina: `src/app/backoffice/(protected)/orders/page.tsx` (Server Component)
- Componentes: `OrdersClient`, `OrderFilters`, `OrderTable`, `OrderPagination`
- API: `GET /api/restaurants/{slug}/orders?status=&dateFrom=&dateTo=&page=&limit=`

**Regras de Negocio**:
- Filtros combinaveis (status + data)
- Data default: hoje
- Paginacao: 20 itens por pagina
- Status com badges coloridos
- Linhas expandiveis para ver itens do pedido

**Criterios de Aceitacao**:
- [ ] Tabela lista pedidos do restaurante
- [ ] Filtro de status funciona
- [ ] Filtro de data funciona
- [ ] Paginacao navega entre paginas
- [ ] Linhas expandem para mostrar itens
- [ ] Badges de status com cores corretas

**Testes Existentes**:
- Unit: `OrderTable.test.tsx`, `OrderFilters.test.tsx`, `OrderPagination.test.tsx`
- Integration: `orders.test.ts`
- E2E: `backoffice-orders.spec.ts`

---

### 10. Configuracoes do Restaurante

**Objetivo**: Permitir que o dono configure informacoes do restaurante, chaves Stripe e WhatsApp.

**Fluxo do Usuario**:
1. Dono acessa `/backoffice/settings`
2. Ve formulario com secoes: Informacoes Gerais, Stripe, WhatsApp
3. Edita campos desejados
4. Clica "Salvar"
5. Feedback de sucesso/erro

**Componentes**:
- Pagina: `src/app/backoffice/(protected)/settings/page.tsx` (Server Component)
- Componentes: `SettingsForm` (Client Component)
- API: `GET/PATCH /api/restaurants/{slug}/settings`

**Regras de Negocio**:
- Chave secreta Stripe exibida mascarada (****XXXX)
- Apenas o restaurante autenticado pode ver/editar suas configuracoes
- Nunca expor `passwordHash` na API
- Campos opcionais podem ser nulos
- Template WhatsApp suporta variaveis `{orderNumber}` e `{status}`

**Criterios de Aceitacao**:
- [ ] Formulario carrega dados atuais do restaurante
- [ ] Chave Stripe secreta aparece mascarada
- [ ] Salvar atualiza os dados com sucesso
- [ ] Validacao impede nome vazio
- [ ] Requer autenticacao
- [ ] Outro restaurante nao consegue acessar

**Testes Existentes**:
- Unit: `SettingsForm.test.tsx`
- Integration: `restaurantSettings.test.ts`
- E2E: `backoffice-settings.spec.ts`

---

## APIs Base

### 11. Restaurant API

**Endpoints**:
| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/api/restaurants` | Cria restaurante (name, slug, email, password) |
| GET | `/api/restaurants/{slug}` | Retorna info publica do restaurante |

**Regras**:
- Slug deve ser unico
- Email deve ser unico
- Senha hashada com bcrypt antes de salvar
- GET nunca retorna `passwordHash` ou chaves secretas

**Testes**: `restaurants.test.ts`, `restaurants.spec.ts`

---

### 12. Category API

**Endpoints**:
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/api/restaurants/{slug}/categories` | Lista categorias |
| POST | `/api/restaurants/{slug}/categories` | Cria categoria |
| PUT | `/api/restaurants/{slug}/categories/{id}` | Atualiza categoria |
| DELETE | `/api/restaurants/{slug}/categories/{id}` | Exclui categoria (cascade) |

**Regras**:
- Ordenadas por `sortOrder`
- Delete cascata para itens
- Valida que a categoria pertence ao restaurante

**Testes**: `categories.test.ts`, `categories.spec.ts`

---

### 13. MenuItem API

**Endpoints**:
| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/api/restaurants/{slug}/categories/{id}/items` | Cria item |
| PUT | `/api/restaurants/{slug}/categories/{id}/items/{itemId}` | Atualiza item |
| DELETE | `/api/restaurants/{slug}/categories/{id}/items/{itemId}` | Soft-delete (isAvailable=false) |

**Regras**:
- `priceInCents` deve ser inteiro positivo
- Delete = soft-delete (preserva historico de pedidos)
- Suporta update parcial (apenas campos enviados)

**Testes**: `menuItems.test.ts`, `menu-items.spec.ts`

---

### 14. Order API

**Endpoints**:
| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/api/restaurants/{slug}/orders` | Cria pedido |
| GET | `/api/restaurants/{slug}/orders` | Lista pedidos (filtros + paginacao) |
| GET | `/api/restaurants/{slug}/orders/{orderId}` | Detalhe do pedido |
| PATCH | `/api/restaurants/{slug}/orders/{orderId}` | Atualiza status |

**Regras**:
- POST: valida que todos os itens existem e estao disponiveis
- POST: calcula total no servidor
- POST: gera `orderNumber` sequencial com retry em race condition
- GET lista: suporta `?status=`, `?dateFrom=`, `?dateTo=`, `?page=`, `?limit=`
- PATCH: valida transicao de status conforme maquina de estados
- PATCH: dispara notificacao WhatsApp apos sucesso (assincrono)

**Testes**: `orders.test.ts`, `orders.spec.ts`, `checkout.spec.ts`

---

## Integracoes

### 15. Stripe — Pagamentos PIX e Cartao

**Objetivo**: Integrar pagamentos via Stripe suportando PIX e Cartao de credito, com chaves configuradas por restaurante.

**Componentes**:
- Chaves armazenadas em `Restaurant.stripePublishableKey` e `Restaurant.stripeSecretKey`
- Campo `Order.stripePaymentIntentId` para rastreamento
- Campo `Order.paymentMethod` (PIX | CARD)

**Regras de Negocio**:
- Chaves Stripe sao per-restaurant (cada dono configura as suas)
- Chave secreta nunca exposta na API (mascarada com ****)
- PaymentIntent criado com `amount: totalInCents, currency: 'brl'`
- PIX: `payment_method_types: ['pix']`
- Cartao: `payment_method_types: ['card']`
- Webhook deve usar `request.text()` para raw body (verificacao de assinatura)

**Testes**: Cobertura via testes de settings e order

---

### 16. WhatsApp — Notificacoes via Twilio

**Objetivo**: Enviar notificacoes automaticas via WhatsApp quando o status do pedido muda.

**Componentes**:
- Lib: `src/lib/whatsapp.ts`
- Configuracao por restaurante: `whatsappNumber`, `whatsappApiConfig`, `whatsappMessageTemplate`

**Regras de Negocio**:
- Notificacao enviada apos PATCH de status com sucesso
- Envio assincrono (nao bloqueia a resposta da API)
- Template suporta variaveis: `{orderNumber}`, `{status}`
- Se restaurante nao tem WhatsApp configurado, nao envia (silencioso)
- Credenciais Twilio armazenadas por restaurante no banco

**Testes**: `whatsapp.test.ts` (unit + integration), `whatsapp-notifications.spec.ts` (E2E)

---

## Infraestrutura

### 17. Database Seed

**Objetivo**: Popular o banco com dados de exemplo para desenvolvimento e demonstracao.

**Execucao**: `npx tsx prisma/seed.ts`

**Dados criados**:
- 2 restaurantes: "Pizzaria Bella" (slug: `pizzaria-bella`) e "Sushi Zen" (slug: `sushi-zen`)
- 4 categorias por restaurante com itens realistas
- 8 pedidos de exemplo por restaurante em diferentes status
- Usuarios com senha `password123`

**Emails de acesso**:
| Restaurante | Email | Senha |
|-------------|-------|-------|
| Pizzaria Bella | `bella@example.com` | `password123` |
| Sushi Zen | `zen@example.com` | `password123` |

---

## Template para Novas Funcionalidades

Ao especificar uma nova feature para implementacao por agentes, use este template:

```markdown
## feat: [Nome da Feature]

### Objetivo
O que a feature faz e por que existe. Uma ou duas frases.

### Fluxo do Usuario
1. Passo a passo numerado
2. Do ponto de vista do usuario
3. Descrevendo cada interacao

### Componentes Envolvidos
- **Pagina**: caminho do arquivo (novo ou existente)
- **Componentes**: componentes React necessarios
- **API**: endpoints (metodo + rota + descricao)
- **Lib**: funcoes utilitarias necessarias
- **Schema**: alteracoes no Prisma schema (se houver)

### Regras de Negocio
- Comportamento obrigatorio 1
- Comportamento obrigatorio 2
- Restricoes e validacoes

### Criterios de Aceitacao
- [ ] Criterio verificavel 1
- [ ] Criterio verificavel 2
- [ ] Criterio verificavel 3

### Contexto Tecnico
- Dependencias de outras features
- Padroes a seguir (referenciar features existentes)
- Consideracoes de performance/seguranca

### Prioridade
alta | media | baixa
```

> **Dica**: Quanto mais detalhados os criterios de aceitacao, melhor o resultado da implementacao automatica. Cada criterio vira um teste E2E.
