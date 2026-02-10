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

Save the annotation first, then optionally store the full page and link via `POST /full-page` with `annotationId`. Optional: `authorId`, `projectId`, `highlightStyleId` (preset for style/color; inline `highlightType`/`highlightColor` still apply).

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
    "baseUrl": "https://example.com",
    "authorId": "optional-author-uuid",
    "projectId": "optional-project-uuid",
    "highlightStyleId": "optional-highlight-style-uuid"
  }'
# Response includes annotation id — use it in POST /full-page annotationId to link (non-blocking)
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

**3. Store full page and link** (non-blocking, 10MB body limit): `POST /full-page` with `html`, `baseUrl`, `fullPath`, optional **`annotationId`**, and optional **`projectId`**. The server hashes HTML, finds or creates the snapshot, then links that annotation to the snapshot. Same hash → existing row, no duplicate HTML.

```bash
curl -s -X POST http://localhost:3000/full-page \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<!DOCTYPE html><html>...</html>",
    "baseUrl": "https://example.com",
    "fullPath": "https://example.com/article",
    "annotationId": "annotation-uuid-from-step-2",
    "projectId": "optional-project-uuid"
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

| Field             | Type   | Description                          |
|-------------------|--------|--------------------------------------|
| `id`              | string | Annotation ID                        |
| `source`          | string | Document URL (target.source)         |
| `pageUrl`         | string | Page URL where it was created        |
| `selector`        | object | `range` / `textPosition` / `textQuote`|
| `bodyType`        | string | e.g. `"comment"`, `"tag"`            |
| `bodyValue`       | string | Body content                         |
| `created`         | string | ISO 8601 date                        |
| `highlightType`   | string | e.g. `"highlight"`, `"underline"`    |
| `highlightColor`  | string | CSS color                            |
| `fullPageId`      | string | Set if linked to a full-page snapshot|
| `baseUrl`         | string | Base URL of the page                 |
| `authorId`        | string | Author ID (if set)                   |
| `projectId`       | string | Project ID (if set)                  |
| `highlightStyleId`| string | Highlight preset ID (if set)        |

---

## Authors

Attribution for team collaboration (no auth; just “who wrote this”).

**List:** `GET /authors` → `200` array of authors.

**Get one:** `GET /authors/:id` → `200` author or `404`.

**Create:** `POST /authors` body `{ "displayName": "string", "email": "optional" }` → `201`.

**Update:** `PATCH /authors/:id` body `{ "displayName": "string", "email": "string | null" }` → `200`. `404` if not found. `409` if author has notes or annotations (delete or reassign first).

**Delete:** `DELETE /authors/:id` → `204` or `404` / `409` (cannot delete if author has notes or annotations).

Author shape: `id`, `displayName`, `email` (optional), `createdAt`, `updatedAt` (ISO 8601).

---

## Projects

Container “thread” for notes, annotations, and full pages.

**List:** `GET /projects` → `200` array of projects.

**Get one:** `GET /projects/:id` → `200` project with `counts: { notes, annotations, fullPages, members }`. `404` if not found.

**Create:** `POST /projects` body `{ "name": "string" }` → `201`.

**Update:** `PATCH /projects/:id` body `{ "name": "string" }` → `200`. `404` if not found.

**Delete:** `DELETE /projects/:id` → `204`. Project members are removed; `projectId` on notes, annotations, and full pages is set to null (content is not deleted).

Project shape: `id`, `name`, `createdAt`, `updatedAt` (ISO 8601).

---

## Project members

**List:** `GET /projects/:id/members` → `200` array of members (each includes `id`, `projectId`, `authorId`, `createdAt`, `author: { id, displayName, email }`).

**Add:** `POST /projects/:id/members` body `{ "authorId": "string" }` → `201`. `409` if already a member. `404` if project or author not found.

**Remove:** `DELETE /projects/:id/members/:authorId` → `204`. `404` if member not found.

---

## Notes

Arbitrarily large text; can relate to **anything** (or nothing): an annotation, a full-page snapshot, another note (thread/reply), and/or a project. Requires `authorId`. Use `parentNoteId` to build threads (replies); list replies with `?parentNoteId=NOTE_ID`.

**List:** `GET /notes` optional query `?projectId=`, `?annotationId=`, `?fullPageId=`, `?parentNoteId=` (e.g. replies to a note), `?authorId=` → `200` array of notes. Body limit 10MB for POST.

**Get one:** `GET /notes/:id` → `200` note or `404`.

**Create:** `POST /notes` body `{ "content": "string", "authorId": "string", "annotationId": "optional", "fullPageId": "optional", "parentNoteId": "optional", "projectId": "optional" }` → `201`. `404` if any referenced entity not found.

**Update:** `PATCH /notes/:id` body `{ "content", "annotationId", "fullPageId", "parentNoteId", "projectId", "authorId" }` (all optional) → `200`. `404` if note or referenced entity not found.

**Delete:** `DELETE /notes/:id` → `204` or `404`. If the note had replies, their `parentNoteId` is set to null (they become top-level).

Note shape: `id`, `content`, `annotationId` (optional), `fullPageId` (optional), `parentNoteId` (optional), `projectId` (optional), `authorId`, `createdAt`, `updatedAt` (ISO 8601).

---

## Highlight styles

Configurable presets for highlight color, intensity, and style (e.g. highlight, underline).

**List:** `GET /highlight-styles` optional `?authorId=` (omit for all, including global) → `200` array.

**Get one:** `GET /highlight-styles/:id` → `200` or `404`.

**Create:** `POST /highlight-styles` body `{ "name": "string", "intensity": "string", "style": "string", "color": "string", "authorId": "optional" }` → `201`. `authorId` null = global preset. `404` if author not found.

**Update:** `PATCH /highlight-styles/:id` body any of `name`, `intensity`, `style`, `color`, `authorId` → `200`. `404` if style or author not found.

**Delete:** `DELETE /highlight-styles/:id` → `204` or `404`.

Highlight style shape: `id`, `name`, `intensity`, `style`, `color`, `authorId` (optional), `createdAt`, `updatedAt` (ISO 8601).

---

## Frontend config

Set the API base URL in your app (e.g. env or config):

- **Web:** `VITE_ANNOTATOR_API_URL=http://localhost:3000`
- **Extension:** store `apiUrl` (e.g. in `chrome.storage`) and use it in `backend-store.ts` for `fetch(\`${apiUrl}/annotations\`, ...)`.

No auth: no headers required for these endpoints.
