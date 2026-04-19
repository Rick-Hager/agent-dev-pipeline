---
document_type: architecture
project_id: SPEC-2026-04-19-001
version: 1.0.0
last_updated: 2026-04-19
status: draft
---

# Formulário de Contato - Technical Architecture

## System Overview

Feature simples de formulário com persistência em arquivo. Sem banco de dados, sem autenticação.

```
┌─────────────────┐     POST      ┌─────────────────┐     append     ┌──────────┐
│  /contato page  │ ──────────────▶│ /api/contact    │ ───────────────▶│ form.txt │
│  (React form)   │               │ (Route Handler) │                │ (CSV)    │
└─────────────────┘               └─────────────────┘                └──────────┘
        │                                 │
        │                                 ▼
        │                         ┌─────────────────┐
        └─────────────────────────│ JSON response   │
                                  │ {success: true} │
                                  └─────────────────┘
```

## Component Design

### Component 1: ContactPage (`src/app/contato/page.tsx`)

- **Purpose**: Renderizar formulário de captura de leads
- **Responsibilities**: 
  - Exibir campos do formulário
  - Validar email no frontend
  - Chamar API e mostrar feedback
- **Technology**: React Server Component + Client Form

### Component 2: ContactForm (`src/components/ContactForm.tsx`)

- **Purpose**: Componente de formulário reutilizável
- **Responsibilities**:
  - Gerenciar estado do formulário
  - Validação inline
  - Submit handling
  - Loading/success/error states
- **Technology**: React Client Component

### Component 3: Contact API Route (`src/app/api/contact/route.ts`)

- **Purpose**: Receber e persistir dados do formulário
- **Responsibilities**:
  - Validar payload
  - Escapar valores CSV
  - Append ao form.txt
  - Retornar status
- **Technology**: Next.js Route Handler

## Data Design

### Data Model

```typescript
interface ContactFormData {
  nome: string;
  email: string;
  nomeRestaurante: string;
  endereco: string;
  pedidosPorDia: string;
}
```

### CSV Format

```csv
nome,email,nomeRestaurante,endereco,pedidosPorDia,timestamp
João Silva,joao@email.com,Pizzaria do João,Rua A 123,50,2026-04-19T10:30:00Z
```

### File Location

- Path: `./form.txt` (raiz do projeto)
- Header escrito na primeira linha se arquivo não existir

## API Design

### POST /api/contact

**Request:**
```json
{
  "nome": "string",
  "email": "string",
  "nomeRestaurante": "string",
  "endereco": "string",
  "pedidosPorDia": "string"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "formulário enviado"
}
```

**Response (400):**
```json
{
  "success": false,
  "message": "email inválido"
}
```

## Security Considerations

- Input sanitization (escapar CSV)
- Rate limiting não implementado (v1)
- Sem dados sensíveis além de email

## File Structure Changes

```
src/
├── app/
│   ├── contato/
│   │   └── page.tsx          # NEW: página do formulário
│   ├── api/
│   │   └── contact/
│   │       └── route.ts      # NEW: API route
│   └── page.tsx              # MODIFY: remover ContactSection import
├── components/
│   ├── ContactForm.tsx       # NEW: componente do formulário
│   └── landing/
│       ├── HeroSection.tsx   # MODIFY: href="#contato" → href="/contato"
│       └── ContactSection.tsx # DELETE ou ignorar (não mais importado)
form.txt                       # NEW: arquivo de dados (criado pelo API)
```
