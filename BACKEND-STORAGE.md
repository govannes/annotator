# Highlighter API — curl reference

Base URL: **`http://localhost:3000`** (or your deployed URL).

---

## List annotations

```bash
# All annotations
curl -s http://localhost:3000/annotations

# Filter by page URL
curl -s "http://localhost:3000/annotations?pageUrl=https://example.com/article"

# Filter by base URL
curl -s "http://localhost:3000/annotations?baseUrl=https://example.com"
```

**Response:** `200` — JSON array of annotation objects.

---

## Get one annotation

```bash
curl -s http://localhost:3000/annotations/ANNOTATION_ID
```

**Response:** `200` — single annotation object. `404` if not found.

---

## Create or update annotation (save)

Fast path only (no full-page link here). Save the annotation first, then optionally store the full page and link it via `POST /full-page` with `annotationIds`.

```bash
curl -s -X POST http://localhost:3000/annotations \
  -H "Content-Type: application/json" \
  -d '{
    "id": "optional-uuid-if-updating",
    "source": "https://example.com/article",
    "pageUrl": "https://example.com/article",
    "selector": {
      "textQuote": {
        "exact": "the exact highlighted text",
        "prefix": "optional prefix",
        "suffix": "optional suffix"
      }
    },
    "bodyType": "comment",
    "bodyValue": "My note",
    "highlightType": "highlight",
    "highlightColor": "#ffff00",
    "baseUrl": "https://example.com"
  }'
# Response includes annotation id — use it in POST /full-page annotationIds to link (non-blocking)
```

**Required:** `source`, `pageUrl`, `selector`.  
**Response:** `201` — created/updated annotation (same shape as below). `400` if required fields missing.

---

## Full-page snapshots (by content hash)

One **full_page** can have **many annotations**. The link is stored in the middle table **`full_page_annotation`** (one row per annotation–snapshot pair). Same URL can have multiple snapshots (dynamic pages); storage is deduped by **content hash** (SHA-256 of HTML): same HTML → same row, different HTML → new row.

**1. (Optional) Check by hash** — if you hash HTML client-side, ask for existing id so you can skip sending HTML:

```bash
# hash = SHA-256 hex of page HTML (e.g. in JS: crypto.subtle.digest('SHA-256', new TextEncoder().encode(html)) then to hex)
curl -s http://localhost:3000/full-page/by-hash/HASH_HEX
# 200: {"id":"uuid","contentHash":"HASH_HEX"}  → use id as fullPageId
# 404: no snapshot for this content → upload with POST below
```

**2. Save annotation first** (fast): `POST /annotations` with annotation data. Response includes **`id`**.

**3. Store full page and link** (non-blocking, 10MB body limit): `POST /full-page` with `html`, `baseUrl`, `fullPath`, and optional **`annotationId`**. The server hashes HTML, finds or creates the snapshot, then links that annotation to the snapshot in the middle table. Same hash → existing row, no duplicate HTML.

```bash
curl -s -X POST http://localhost:3000/full-page \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<!DOCTYPE html><html>...</html>",
    "baseUrl": "https://example.com",
    "fullPath": "https://example.com/article",
    "annotationId": "annotation-uuid-from-step-2"
  }'
# Response: {"id":"uuid","contentHash":"sha256-hex"}
```

---

## Delete annotation

```bash
curl -s -X DELETE http://localhost:3000/annotations/ANNOTATION_ID
```

**Response:** `204` no body. `404` if not found.

---

## Annotation object shape (response)

| Field           | Type   | Description                          |
|-----------------|--------|--------------------------------------|
| `id`            | string | Annotation ID                        |
| `source`        | string | Document URL (target.source)         |
| `pageUrl`       | string | Page URL where it was created        |
| `selector`      | object | `range` / `textPosition` / `textQuote`|
| `bodyType`      | string | e.g. `"comment"`, `"tag"`            |
| `bodyValue`     | string | Body content                          |
| `created`       | string | ISO 8601 date                        |
| `highlightType` | string | e.g. `"highlight"`, `"underline"`     |
| `highlightColor`| string | CSS color                            |
| `fullPageId`    | string | Set if linked to a full-page snapshot |
| `baseUrl`       | string | Base URL of the page                 |

---

## Frontend config

Set the API base URL in your app (e.g. env or config):

- **Web:** `VITE_ANNOTATOR_API_URL=http://localhost:3000`
- **Extension:** store `apiUrl` (e.g. in `chrome.storage`) and use it in `backend-store.ts` for `fetch(\`${apiUrl}/annotations\`, ...)`.

No auth: no headers required for these endpoints.
