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
15. [MercadoPago — Checkout Pro (PIX e Cartao)](#15-mercadopago--checkout-pro-pix-e-cartao)
16. [WhatsApp — Notificacoes via Twilio](#16-whatsapp--notificacoes-via-twilio)

### Midia
18. [Galeria de Imagens de Produtos](#18-galeria-de-imagens-de-produtos)

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
3. Cada categoria mostra seus itens com nome, descricao, preco e thumbnail
4. Thumbnail da imagem principal (64px) aparece a esquerda de cada item
5. Itens sem imagem exibem placeholder visual
6. Click na thumbnail abre popup fullscreen com galeria de imagens
7. Galeria com swipe horizontal (touch/drag), dots indicadores, botao fechar e Escape
8. Itens indisponiveis (`isAvailable = false`) nao aparecem
9. Botao "Adicionar" em cada item adiciona ao carrinho
10. Badge no header mostra quantidade de itens no carrinho

**Componentes**:
- Pagina: `src/app/[slug]/page.tsx` (Server Component)
- Componentes: `AddToCartButton`, `CartBadge`, `CartProvider`, `ImageGallery`
- API: `GET /api/restaurants/{slug}/menu`
- Lib: `cart.ts` (addItemToCart, getTotalItems)

**Regras de Negocio**:
- Apenas itens com `isAvailable = true` sao exibidos
- Categorias ordenadas por `sortOrder`
- Itens ordenados por `sortOrder` dentro da categoria
- Precos exibidos em BRL (R$ XX,XX) — armazenados em centavos
- Thumbnail exibe a imagem com menor `sortOrder` (imagem principal)
- Galeria exibe todas as imagens do item ordenadas por `sortOrder`

**Criterios de Aceitacao**:
- [ ] Acessar `/{slug}` exibe o nome do restaurante
- [ ] Categorias e itens aparecem ordenados
- [ ] Itens indisponiveis nao aparecem na listagem
- [ ] Thumbnail da imagem principal aparece a esquerda de cada item
- [ ] Placeholder visual para itens sem imagem
- [ ] Click na thumbnail abre galeria fullscreen
- [ ] Galeria com swipe horizontal e dots indicadores
- [ ] Fechar galeria com botao X, click fora ou Escape
- [ ] Botao "Adicionar" adiciona item ao carrinho
- [ ] Badge do carrinho atualiza com a quantidade correta
- [ ] Slug inexistente retorna 404

**Testes Existentes**:
- Unit: `MenuPage.test.tsx`, `ImageGallery.test.tsx`
- E2E: `consumer-menu.spec.ts`, `menu-item-images.spec.ts`

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
4. Seleciona forma de pagamento (PIX ou Cartao)
5. Clica "Ir para pagamento"
6. Sistema cria o pedido via API e gera Preference no MercadoPago
7. Carrinho e limpo
8. Cliente e redirecionado para pagina do MercadoPago
9. Apos pagamento, MercadoPago redireciona para `/{slug}/pedido/{orderId}`

**Componentes**:
- Pagina: `src/app/[slug]/checkout/page.tsx` (Client Component)
- API: `POST /api/restaurants/{slug}/orders` (cria pedido)
- API: `POST /api/restaurants/{slug}/orders/{orderId}/pay` (cria Preference MercadoPago)
- Lib: `validation.ts` (validatePhone), `mercadopago.ts` (criar preference)

**Regras de Negocio**:
- Nome e telefone sao obrigatorios
- Telefone validado e armazenado somente digitos
- Pedido criado com status `CREATED`
- `orderNumber` sequencial por restaurante (com retry em caso de race condition)
- `OrderItem` armazena snapshot de nome e preco
- Total calculado no servidor (nao confia no cliente)
- Pagamento via MercadoPago Checkout Pro (redirect)
- Metodos restritos a PIX e Cartao

**Criterios de Aceitacao**:
- [ ] Resumo mostra itens e total corretos
- [ ] Validacao impede envio sem nome ou telefone
- [ ] Seletor de forma de pagamento (PIX ou Cartao)
- [ ] Botao "Ir para pagamento" cria pedido e redireciona ao MercadoPago
- [ ] Pedido e criado com numero sequencial
- [ ] Carrinho limpo apos confirmacao
- [ ] Apos pagamento, retorna para pagina de acompanhamento
- [ ] Checkout com carrinho vazio redireciona para o cardapio

**Testes Existentes**:
- Unit: `CheckoutPage.test.tsx`, `validation.test.ts`
- Integration: `orders.test.ts`, `payments.test.ts`
- E2E: `checkout.spec.ts`, `payments.spec.ts`

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
2. Ve cinco cards: Pedidos Hoje, Receita Hoje, Pedidos Ativos, Pagamentos Pendentes, Taxa de Conversao
3. Se MercadoPago nao configurado, ve alerta visual com link para configuracoes
4. Abaixo, links rapidos: Gerenciar Cardapio, Ver Pedidos, Abrir KDS, Configuracoes, Ver Cardapio
5. Sidebar (AdminNav) permite navegacao entre todas as secoes

**Componentes**:
- Pagina: `src/app/backoffice/(protected)/dashboard/page.tsx` (Server Component)
- Componentes: `StatCard`, `AdminNav`, `DashboardView`
- API: Consulta direta ao Prisma (Server Component, sem API intermediaria)

**Regras de Negocio**:
- "Pedidos Hoje": count de pedidos com status nao-cancelado criados hoje (UTC)
- "Receita Hoje": sum de `totalInCents` dos mesmos pedidos
- "Pedidos Ativos": count de pedidos com status PREPARING ou READY
- "Pagamentos Pendentes": count de pedidos com status PAYMENT_PENDING
- "Taxa de Conversao": % de pedidos com pagamento aprovado vs total criados hoje
- Alerta de configuracao exibido se `mercadopagoAccessToken` esta vazio
- "Ver Cardapio": link rapido para `/{slug}` (cardapio publico)
- Valores monetarios formatados em BRL

**Criterios de Aceitacao**:
- [ ] Dashboard exibe cinco metricas corretas
- [ ] Receita formatada em BRL (R$ X.XXX,XX)
- [ ] Card de pagamentos pendentes mostra contagem correta
- [ ] Taxa de conversao exibida como percentual
- [ ] Alerta visual se MercadoPago nao configurado
- [ ] Links rapidos navegam para as paginas corretas (incluindo Ver Cardapio)
- [ ] AdminNav aparece em todas as paginas do backoffice
- [ ] Pagina requer autenticacao

**Testes Existentes**:
- Unit: `StatCard.test.tsx`, `AdminNav.test.tsx`, `DashboardView.test.tsx`
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
5. Pode fazer upload de ate 5 imagens por item (jpg, png, webp, max 5MB)
6. Ve preview das imagens com indicador de contagem (ex: "3/5 imagens")
7. Pode remover imagens individuais
8. Pode reordenar imagens via drag-and-drop
9. Pode marcar itens como disponivel/indisponivel
10. Todas as operacoes sao inline (sem navegacao)

**Componentes**:
- Pagina: `src/app/backoffice/(protected)/menu/page.tsx` (Server Component)
- Componentes: `MenuManager` (Client Component, CRUD completo), `ImageUploader` (upload/preview/delete/reorder)
- APIs: Category API + MenuItem API (ver secoes 12 e 13) + Image API (ver secao 18)

**Regras de Negocio**:
- Excluir categoria exclui todos os itens (cascade)
- Excluir item faz soft-delete (isAvailable = false)
- Preco deve ser inteiro positivo (centavos)
- Nome e obrigatorio para categorias e itens
- Maximo 5 imagens por item (validacao na API e no frontend)
- Tipos de imagem aceitos: jpg, png, webp
- Tamanho maximo por imagem: 5MB
- Imagens armazenadas no Vercel Blob

**Criterios de Aceitacao**:
- [ ] Lista categorias e itens do restaurante autenticado
- [ ] Criar categoria com nome
- [ ] Editar nome de categoria
- [ ] Excluir categoria (com confirmacao)
- [ ] Criar item com nome, descricao e preco
- [ ] Editar campos do item
- [ ] Excluir item (soft-delete)
- [ ] Validacao de campos obrigatorios
- [ ] Upload de imagens com preview e indicador de contagem
- [ ] Remover imagens individuais
- [ ] Reordenar imagens via drag-and-drop
- [ ] Input de upload oculto quando 5 imagens ja existem

**Testes Existentes**:
- Unit: `MenuManager.test.tsx`, `ImageUploader.test.tsx`
- Integration: `categories.test.ts`, `menuItems.test.ts`, `menuItemImages.test.ts`
- E2E: `backoffice-menu.spec.ts`, `menu-item-images.spec.ts`

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

**Objetivo**: Permitir que o dono configure informacoes do restaurante, Access Token do MercadoPago e WhatsApp.

**Fluxo do Usuario**:
1. Dono acessa `/backoffice/settings`
2. Ve formulario com secoes: Informacoes Gerais, MercadoPago, WhatsApp
3. Edita campos desejados
4. Clica "Salvar"
5. Feedback de sucesso/erro

**Componentes**:
- Pagina: `src/app/backoffice/(protected)/settings/page.tsx` (Server Component)
- Componentes: `SettingsForm` (Client Component)
- API: `GET/PATCH /api/restaurants/{slug}/settings`

**Regras de Negocio**:
- Access Token do MercadoPago exibido mascarado (****XXXX)
- Apenas o restaurante autenticado pode ver/editar suas configuracoes
- Nunca expor `passwordHash` na API
- Campos opcionais podem ser nulos
- Template WhatsApp suporta variaveis `{orderNumber}` e `{status}`

**Criterios de Aceitacao**:
- [ ] Formulario carrega dados atuais do restaurante
- [ ] Access Token MercadoPago aparece mascarado
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

### 15. MercadoPago — Checkout Pro (PIX e Cartao)

**Objetivo**: Integrar pagamentos via MercadoPago Checkout Pro. O consumidor e redirecionado para a pagina do MercadoPago para pagar (PIX ou Cartao), e o valor vai direto para a conta do restaurante. Substitui a integracao anterior com Stripe.

**Fluxo do Usuario**:
1. Consumidor preenche nome, telefone e seleciona forma de pagamento (PIX ou Cartao)
2. Clica em "Ir para pagamento"
3. Pedido e criado e uma Preference e gerada no MercadoPago
4. Consumidor e redirecionado para pagina do MercadoPago
5. Apos pagamento, MercadoPago redireciona para `/{slug}/pedido/{orderId}`
6. Webhook IPN do MercadoPago atualiza status do pedido automaticamente

**Componentes**:
- Checkout: `src/app/[slug]/checkout/page.tsx` — resumo do pedido e botao de pagamento
- API pagamento: `src/app/api/restaurants/[slug]/orders/[orderId]/pay/route.ts` — cria Preference
- Webhook: `src/app/api/webhooks/mercadopago/route.ts` — recebe IPN e atualiza status
- Lib: `src/lib/mercadopago.ts` — wrapper do SDK MercadoPago (criar preference, consultar pagamento)
- Schema: `Restaurant.mercadopagoAccessToken` (per-restaurant), `Order.mercadopagoPreferenceId`, `Order.mercadopagoPaymentId`

**Regras de Negocio**:
- Access Token do MercadoPago e per-restaurant (cada dono configura o seu nas settings)
- Token nunca exposto na API (mascarado com ****)
- Preference criada com `payment_methods` restrito a PIX + Cartao
- `back_urls` apontam para pagina do pedido (success, failure, pending)
- `notification_url` configurada para receber webhooks IPN
- Webhook consulta API do MercadoPago com payment ID para verificar status
- Status approved → PAYMENT_APPROVED, rejected → CANCELLED

**Criterios de Aceitacao**:
- [ ] POST /pay cria Preference e retorna URL de redirect
- [ ] Consumidor e redirecionado ao MercadoPago
- [ ] Apos pagamento, retorna para pagina do pedido
- [ ] Webhook IPN atualiza status do pedido
- [ ] Apenas PIX e Cartao como metodos de pagamento
- [ ] Restaurante sem Access Token recebe erro 400
- [ ] Valor vai direto para conta do restaurante

**Testes Existentes**:
- Unit: `mercadopago.test.ts` (criar preference, validar webhook)
- Unit: `CheckoutPage.test.tsx`
- Integration: `payments.test.ts` (POST /pay, webhooks)
- E2E: `payments.spec.ts`

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

## Midia

### 18. Galeria de Imagens de Produtos

**Objetivo**: Permitir que cada item do cardapio tenha ate 5 imagens, exibidas como thumbnail no cardapio publico e gerenciadas via upload no backoffice. Imagens armazenadas no Vercel Blob.

**Fluxo do Usuario (Consumidor)**:
1. Cliente acessa `/{slug}` e ve o cardapio
2. Cada item exibe thumbnail quadrada (64px) da imagem principal a esquerda
3. Itens sem imagem exibem placeholder visual
4. Click na thumbnail abre popup fullscreen com galeria
5. Galeria com swipe horizontal (touch em mobile, drag em desktop)
6. Dots indicadores mostram posicao na galeria
7. Fechar com botao X, click fora da imagem ou tecla Escape

**Fluxo do Usuario (Backoffice)**:
1. Dono acessa `/backoffice/menu` e edita um item
2. Secao de imagens mostra thumbnails das imagens existentes
3. Indicador de contagem (ex: "3/5 imagens")
4. Botao de upload para adicionar nova imagem
5. Botao de remover em cada thumbnail
6. Drag-and-drop para reordenar imagens
7. Input de upload oculto quando limite de 5 atingido
8. Feedback de loading durante upload

**Componentes**:
- Pagina (consumidor): `src/app/[slug]/page.tsx` — thumbnail e abertura da galeria
- Componente galeria: `src/components/ImageGallery.tsx` (Client Component, swipe/touch)
- Componente upload: `src/components/admin/ImageUploader.tsx` (Client Component, upload/preview/delete/reorder)
- APIs:
  - `POST /api/restaurants/{slug}/menu-items/{itemId}/images` — upload de imagem
  - `DELETE /api/restaurants/{slug}/menu-items/{itemId}/images/{imageId}` — remover imagem
  - `PATCH /api/restaurants/{slug}/menu-items/{itemId}/images/reorder` — reordenar imagens
- Lib: `src/lib/imageValidation.ts` (validacao de tipo, tamanho, limite), `src/lib/blob.ts` (wrapper Vercel Blob)
- Schema: modelo `MenuItemImage` (id, menuItemId, url, sortOrder)

**Regras de Negocio**:
- Maximo 5 imagens por item do cardapio
- Tipos aceitos: image/jpeg, image/png, image/webp
- Tamanho maximo: 5MB por imagem
- Imagens ordenadas por `sortOrder` — a de menor sortOrder e a thumbnail principal
- Upload armazenado no Vercel Blob (requer `BLOB_READ_WRITE_TOKEN`)
- Delete remove do banco e do Vercel Blob
- Reorder valida que os IDs enviados correspondem exatamente as imagens existentes
- Todas as rotas protegidas por JWT com validacao de tenant (403 se slug nao pertence ao JWT)
- Item deve pertencer ao restaurante autenticado (404 se nao)

**Criterios de Aceitacao**:
- [ ] Modelo MenuItemImage com relacao MenuItem 1→N (cascade delete)
- [ ] POST upload cria registro e armazena no Vercel Blob
- [ ] DELETE remove registro e arquivo do Blob
- [ ] PATCH reorder atualiza sortOrder de todas as imagens
- [ ] Validacao de limite de 5 imagens (400)
- [ ] Validacao de tipo de arquivo (400)
- [ ] Validacao de tamanho (400)
- [ ] Autenticacao obrigatoria (401)
- [ ] Validacao de tenant (403)
- [ ] Item deve pertencer ao restaurante (404)
- [ ] Thumbnail no cardapio publico
- [ ] Placeholder para itens sem imagem
- [ ] Popup fullscreen com galeria swipe
- [ ] Dots indicadores e navegacao por toque/drag
- [ ] Fechar com X, click fora ou Escape
- [ ] Upload com preview no backoffice
- [ ] Indicador de contagem (N/5)
- [ ] Remover imagens individuais
- [ ] Drag-and-drop para reordenar

**Testes Existentes**:
- Unit: `imageValidation.test.ts` (14 testes), `ImageGallery.test.tsx` (10 testes), `ImageUploader.test.tsx` (7 testes)
- Integration: `menuItemImages.test.ts` (14 testes — upload, delete, reorder, auth, tenant, validacoes)
- E2E: `menu-item-images.spec.ts` (4 testes — placeholder, thumbnail+galeria, contagem backoffice, delete)

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
