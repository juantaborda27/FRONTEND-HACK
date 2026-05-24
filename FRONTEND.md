# GEO Copilot — Guía de integración Frontend

Documento de contexto para el equipo frontend (Next.js/React + Cursor).  
Backend: **FastAPI** · Repo compartido en GitHub · API version **2.0.0**

---

## Conexión

| Concepto | Valor |
|---|---|
| Base URL local | `http://localhost:8000` |
| Swagger | `http://localhost:8000/docs` |
| OpenAPI JSON | `http://localhost:8000/openapi.json` |
| Auth | **Ninguna** (sin JWT, sin API key en frontend) |
| Content-Type POST | `application/json` |

### Variable de entorno frontend

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### CORS

Backend acepta `http://localhost:3000` por defecto. Si el frontend corre en otro origen, el backend debe agregar en su `.env`:

```env
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:5173
```

---

## Arquitectura — 4 verbos

```
AUDITAR  → scrape + scores + probe + GSC
RECOMENDAR → propuestas con Gemini
EDITAR   → preview + approve/reject → WordPress
APRENDER → rechazos alimentan prompts + measure-impact
```

### Modelo de datos clave

```
1 URL  =  1 analysis_id  (estado: completed | failed)
1 analysis_id  =  N propuestas  (estado: pending | approved | rejected)
```

**IMPORTANTE — dos tipos de "pending":**

| Entidad | `pending` significa | Endpoint |
|---|---|---|
| **Analysis** | Scrape en curso (~ms). Casi siempre vacío. | `GET /analyses?status=pending` ❌ no usar |
| **Proposal** | Esperando revisión humana | `GET /proposals?status=pending` ✅ |

Para "pendientes de revisar" usar **propuestas**, no análisis.

---

## Enums TypeScript

```typescript
type AnalysisStatus = "pending" | "completed" | "failed"

type ProposalStatus = "pending" | "approved" | "rejected"

type ProposalType =
  | "BLOG_POST"
  | "META_DESCRIPTION"
  | "FAQ_SCHEMA"
  | "ALT_TEXT_FIX"
  | "SCHEMA_MARKUP"
  | "GEO_INSIGHT"

type Severity = "high" | "medium" | "low"

type TriggerSource = "scrape" | "llm_probe" | "gsc"

type PublishAction = "create_post" | "patch_meta" | "append_to_post" | "update_alt"
```

Generar tipos automáticos:

```bash
npx openapi-typescript http://localhost:8000/openapi.json -o src/types/api.ts
```

---

## Endpoints completos

### Sistema

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/health` | — | `{ "status": "ok" }` |

---

### AUDITAR

#### Auditar una URL

```
POST /analyze
{ "url": "https://ejemplo.com/pagina" }
```

Respuesta:

```json
{
  "analysis_id": 21,
  "url": "https://...",
  "seo_score": 60,
  "geo_score": 25,
  "status": "completed",
  "scrape_warning": null,
  "scrape_summary": {
    "title": "...",
    "meta_description": "...",
    "h1": "...",
    "word_count": 184,
    "has_faq_schema": false,
    "has_structured_data": false,
    "internal_links_count": 5,
    "images_without_alt": 2,
    "scrape_warning": null
  }
}
```

Si `scrape_warning` tiene texto → mostrar banner (anti-bot, scores no confiables).

#### Auditar todo el sitio WordPress

```
POST /analyze/wordpress-pages
{
  "wordpress_url": "https://wordpress-production-d55e.up.railway.app",
  "include_posts": true,
  "status": "publish"
}
```

| Campo | Default | Descripción |
|---|---|---|
| `wordpress_url` | `WORDPRESS_URL` del backend | URL **base** del sitio (también acepta `/wp-json/wp/v2/pages`) |
| `include_posts` | `false` | Si `true`, incluye entradas de blog además de páginas |
| `status` | `"publish"` | Filtro WP: `publish`, `draft`, `any` |

Respuesta:

```json
{
  "source": "https://...",
  "total_found": 4,
  "analyzed": 4,
  "failed": 0,
  "results": [
    {
      "analysis_id": 21,
      "url": "https://.../pagina-ejemplo/",
      "wp_id": 2,
      "wp_title": "Página de ejemplo",
      "content_type": "page",
      "seo_score": 60,
      "geo_score": 20,
      "status": "completed"
    }
  ]
}
```

#### Listar análisis

```
GET /analyses?limit=20&offset=0
GET /analyses?status=completed   ← recomendado
GET /analyses/{id}               ← detalle + scrape + probes + propuestas
```

Respuesta paginada:

```json
{
  "items": [{ "id": 21, "url": "...", "seo_score": 60, "geo_score": 20, "status": "completed", "created_at": "..." }],
  "total": 24,
  "limit": 20,
  "offset": 0
}
```

#### LLM Probe

```
POST /probe/run
{
  "analysis_id": 21,
  "queries": ["¿qué tarjeta me conviene en Colombia?"]
}
```

Usar **1 query** en demo (cuota Gemini). Sin body usa 7 queries default.

```
GET /probe/results?analysis_id=21&limit=20
```

#### GSC mock

```
GET /gsc/opportunities
```

---

### RECOMENDAR

#### Una página

```
POST /agent/recommend
{ "analysis_id": 21 }
```

Respuesta:

```json
{
  "analysis_id": 21,
  "proposals_created": 5,
  "proposals": [{ "id": 40, "proposal_type": "META_DESCRIPTION", "status": "pending", ... }]
}
```

#### Todas las páginas (recomendado tras wordpress-pages)

```
POST /agent/recommend-all
{
  "analysis_ids": null,
  "skip_existing": true
}
```

| Campo | Default | Descripción |
|---|---|---|
| `analysis_ids` | `null` (todos) | Solo esos IDs |
| `skip_existing` | `true` | Omite análisis que ya tienen propuestas |

Respuesta:

```json
{
  "total_analyses": 4,
  "processed": 2,
  "skipped": 2,
  "failed": 0,
  "total_proposals_created": 10,
  "results": [
    {
      "analysis_id": 21,
      "url": "https://...",
      "proposals_created": 5,
      "proposals": [...],
      "skipped": false,
      "error": null
    }
  ]
}
```

#### Ciclo completo (una URL)

```
POST /agent/run-full-cycle
{ "url": "https://..." }
```

Audit + 2 probes + recommend. Tarda 30–90 s.

---

### EDITAR — Cola de revisión

#### Listar propuestas

```
GET /proposals?status=pending&limit=20&offset=0
GET /proposals?proposal_type=BLOG_POST
GET /proposals/{id}
```

#### Preview para el editor (HTML inline como se verá en WordPress)

```
GET /proposals/review/next          ← siguiente pendiente (FIFO)
GET /proposals/{id}/preview         ← preview de una específica
```

Respuesta `ProposalPreviewResponse`:

```json
{
  "id": 40,
  "analysis_id": 21,
  "analysis_url": "https://.../pagina-ejemplo/",
  "proposal_type": "FAQ_SCHEMA",
  "title": "Agregar FAQ schema.org",
  "summary": "...",
  "severity": "high",
  "status": "pending",
  "content_raw": "{ \"faqs\": [...] }",
  "content_html": "<section style=\"...\">...</section>",
  "publish_action": "append_to_post",
  "publish_action_label": "Agregar sección FAQ al final del post existente",
  "target_post_id": 1,
  "wordpress_url": "https://...",
  "can_review": true,
  "pending_count": 32,
  "approve_url": "/proposals/40/approve",
  "reject_url": "/proposals/40/reject"
}
```

**UI editor:**
- Renderizar `content_html` en un panel preview (`dangerouslySetInnerHTML` o iframe)
- Botones solo si `can_review === true`
- Mostrar `publish_action_label` como hint
- Mostrar `pending_count` como "Quedan N por revisar"

#### Aprobar

```
POST /proposals/{id}/approve
(sin body)
```

Respuesta:

```json
{
  "id": 40,
  "status": "approved",
  "wp_published_url": "https://.../2026/05/23/blog-geo-.../",
  "wp_published_id": 8,
  "reviewed_at": "2026-05-23T..."
}
```

#### Rechazar (alimenta aprendizaje IA)

```
POST /proposals/{id}/reject
{ "reason": "El tono es muy formal, usa lenguaje más cercano" }
```

Mínimo 3 caracteres. El motivo se inyecta en futuros prompts de Gemini.

---

### APRENDER

```
POST /proposals/{id}/measure-impact
(sin body, solo propuestas approved)
```

```json
{
  "proposal_id": 40,
  "measurement": {
    "llm_mentioned_after": true,
    "similarity_score_after": 0.72,
    "google_position_after": 8.5,
    "measured_at": "..."
  },
  "improvement_summary": "Serfinanza ahora es mencionada en el 72%..."
}
```

---

## Flujos recomendados

### Flujo A — Sitio WordPress completo (demo hackathon)

```
1. POST /analyze/wordpress-pages   { include_posts: true }
2. POST /agent/recommend-all       { skip_existing: true }
3. GET  /proposals/review/next     → editor preview
4. POST /proposals/{id}/approve | /reject
5. POST /proposals/{id}/measure-impact
```

### Flujo B — Una URL manual

```
1. POST /analyze
2. POST /probe/run                 (1 query)
3. POST /agent/recommend
4. GET  /proposals/{id}/preview
5. POST /proposals/{id}/approve
```

### Flujo C — Demo rápida (1 botón)

```
POST /agent/run-full-cycle  { "url": "..." }
→ luego GET /proposals?status=pending
```

---

## Errores HTTP

Formato: `{ "detail": "mensaje en español" }`

| Código | Cuándo | Acción UI |
|---|---|---|
| 400 | URL inválida, propuesta ya procesada | Mostrar `detail` |
| 404 | ID no existe, cola vacía | Mensaje amigable |
| 429 | **Cuota Gemini agotada** (~20 req/día free) | "Cuota IA agotada, intenta más tarde" |
| 502 | WordPress no responde | "Error al publicar" |
| 503 | IA bloqueó respuesta | Permitir reintentar |

**Cuota Gemini:** `recommend` y `recommend-all` pueden devolver `429` o `200` con `proposals_created: 0`. Siempre verificar el contador.

---

## Tiempos de espera (mostrar loading)

| Endpoint | Duración típica |
|---|---|
| `POST /analyze` | 2–10 s |
| `POST /analyze/wordpress-pages` | 5–30 s (por cantidad de páginas) |
| `POST /probe/run` | 5–15 s por query |
| `POST /agent/recommend` | 15–60 s |
| `POST /agent/recommend-all` | 30 s – varios minutos |
| `POST /agent/run-full-cycle` | 30–90 s |
| `POST /proposals/{id}/approve` | 2–10 s |

Timeout recomendado frontend: **120 s** para operaciones con IA.

---

## Publicación WordPress (comportamiento backend)

Al aprobar, según `proposal_type`:

| Tipo | Acción |
|---|---|
| `BLOG_POST` | Crea entrada nueva con HTML inline estilizado |
| `META_DESCRIPTION` | Actualiza excerpt del post existente |
| `FAQ_SCHEMA` | Agrega sección FAQ al post existente |
| `SCHEMA_MARKUP` | Agrega JSON-LD al post |
| `GEO_INSIGHT` | Agrega bloque insight al post |
| `ALT_TEXT_FIX` | Actualiza alt de imagen en medios |

Posts nuevos se publican con `WORDPRESS_POST_STATUS` del backend (`publish` o `draft`).

---

## Aprendizaje de rechazos

Cuando el usuario rechaza con motivo → backend guarda en `proposal_feedback` → próximo `recommend` / `recommend-all` inyecta esos motivos en prompts Gemini para no repetir errores.

---

## URLs demo recomendadas

| URL | Uso |
|---|---|
| `https://wordpress-production-d55e.up.railway.app` | WordPress del equipo (Railway) |
| `https://bancolombia.com/personas/blog` | Scrape OK para demo |
| `https://gruposerfinanza.com` | Marca Serfinanza |

Evitar `bancoserfinanza.com` en vivo (anti-bot Radware).

---

## Helper fetch (copiar)

```typescript
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Error de API");
  }
  return res.json();
}

// Ejemplos
await api("/health");
await api("/analyses?limit=50");
await api("/proposals/review/next");
await api("/proposals/40/approve", { method: "POST" });
await api("/proposals/40/reject", {
  method: "POST",
  body: JSON.stringify({ reason: "Tono muy formal" }),
});
```

---

## Pantallas sugeridas

1. **Dashboard** — health + botón "Auditar sitio WordPress"
2. **Análisis** — tabla de `/analyses` con SEO/GEO scores
3. **Propuestas** — lista `/proposals?status=pending` + contador
4. **Editor** — `/proposals/review/next` con preview HTML + approve/reject
5. **Impacto** — measure-impact para aprobadas

---

## Lo que NO necesita el frontend

- `GEMINI_API_KEY` (solo backend)
- Credenciales WordPress (solo backend `.env`)
- Lógica de scrape, Gemini, ni publicación WP