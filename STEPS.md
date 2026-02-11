# Sidebar UI implementation steps

Track progress and move between steps here. **Before starting any step**, read [BACKEND.md](./BACKEND.md) so you understand how the current backend works (annotations, notes, projects, authors, full-page, highlight styles, and API shapes).

---

## What was done

- **Step 1: Sidebar shell and layout** — Done.
  - **sidebar-prefs.ts:** Position (left/right) and width (px) with presets S/M/L (320 / 420 / 560), min/max 280–600, persisted in localStorage.
  - **sidebar-shell.ts:** New shell with placeholder top bar (Highlighter, Left/Right, S/M/L, close), placeholder context selector (“This Page” dropdown), tab strip (Annotations, Notes, Projects, Authors, Chat), main content area (placeholder tab labels). Resize handle on inner edge; width persisted.
  - **index.ts:** Uses `createSidebarShell` instead of old sidebar; Cmd/Ctrl+Shift+H toggles sidebar (listener looks up current handle from DOM). (Annotation loading added in Step 4.)
  - **Trigger** still repositions on `SIDEBAR_POSITION_CHANGED_EVENT` (reinject in extension-content).
- **Sidebar always on the side (no “append to bottom”):**
  - **index.ts:** UI container is now a **fixed viewport overlay** (`position: fixed; inset: 0; z-index: 2147483647`) so the sidebar and trigger stay on the side regardless of page layout (flex/grid, etc.). If a page uses `transform`/`filter` on an ancestor, fixed positioning can still be wrong; use Chrome Side Panel in that case.
- **Chrome Side Panel (optional):**
  - **extension/manifest.json:** `sidePanel` permission and `side_panel.default_path: "sidepanel.html"`.
  - **extension/sidepanel.html:** Static panel in the browser chrome (copy to dist-extension on build). Does not yet load annotations; see [SIDEPANEL.md](./SIDEPANEL.md) for wiring via messaging.
  - **SIDEPANEL.md** and **EXTENSION.md** updated with instructions.
- **Step 2: Top bar** — Done.
  - **sidebar-shell.ts:** Top bar: left (page favicon, page title with ellipsis, domain subtle); center (global search input, stub for in-memory filter); right (Settings icon placeholder, collapse/close). Calm styling; position/width controls moved to Settings (Step 10). `getPageUrl` optional for page info.
  - **ui/index.ts:** Passes `getPageUrl` into `createSidebarShell`.
- **Step 3: Context selector** — Done.
  - **sidebar-prefs.ts:** `SidebarContext` type and get/set (`this-page` | `this-project` | `all-notes` | `all-projects`), persisted in localStorage; optional `getSidebarContextProjectId` / `setSidebarContextProjectId` for "This Project" (stub until Step 7).
  - **sidebar-shell.ts:** Context selector dropdown wired to prefs; on change dispatches `SIDEBAR_CONTEXT_CHANGED_EVENT` and calls `refreshContent()`. Shell passes `{ tabId, context }` to optional `__renderContent` or shows placeholder "Tab — context: Label". Exposes `SidebarShellApi`: `__getContext`, `__getMainContent`, `__getActiveTab`, `__refresh`, `__renderContent`.
  - **ui/index.ts:** Exports `SIDEBAR_CONTEXT_CHANGED_EVENT`.
- **Step 4: Tabs + Annotations tab (backend data)** — Done.
  - **api/storage.ts:** `LoadOptions` (`pageUrl`, `baseUrl`, `projectId`); `load(options?)` for filtered fetch. **api/backend-store.ts:** GET /annotations with query params; client-side filter by `projectId` when set.
  - **types.ts:** `Annotation` has optional `authorId`, `projectId`. **core/anchorer.ts:** `BackendAnnotationResponse` and `fromBackendPayload` include them.
  - **ui/annotation-card.ts:** New card: color strip, snippet, author · time · project, optional comment, “Notes (0)” stub, **“Go to source”** button with `onGoToSource(annotationId)`.
  - **ui/annotations-tab.ts:** `renderAnnotationsTab(container, context, deps)` — builds `LoadOptions` from context, loads via `getStore().load(options)`, renders cards or empty state (“No highlights on this page” → “Select text to highlight”), or error.
  - **ui/index.ts:** `__renderContent` wires Annotations tab to `renderAnnotationsTab`; other tabs show “Coming soon”. `goToSource(id)` finds `[data-annotation-id]`, scrolls into view, adds pulse animation (injected style). Calls `__refresh()` after mount so Annotations load on open.
  - **Remaining (optional/follow-up):** Page → sidebar sync (hover/click highlight → switch to Annotations tab, scroll to card, highlight card); “Notes (n)” with real count and expand; author/project display names (GET /authors, GET /projects).
- **Step 5: Notes tab** — Done.
  - **api/notes.ts:** `createNotesApi(baseUrl)`, `listNotes(options?)` → GET /notes with `annotationId`, `fullPageId`, `projectId`, `authorId`, `parentNoteId`. **types.ts:** `Note` type (id, content, annotationId?, fullPageId?, parentNoteId?, projectId?, authorId, createdAt, updatedAt).
  - **ui/note-card.ts:** Note card: title/first line, body, 🔗 Annotation / 🌐 Page / 📁 Project, author · time, “Replies (0)” stub, **“Go to source”** (enabled when annotationId or fullPageId; navigates to annotation on page via existing scroll+pulse).
  - **ui/notes-tab.ts:** `renderNotesTab(container, context, deps)` — builds list options from context (This Page → annotations for page then filter notes by those annotationIds; This Project → projectId; All Notes/All Projects → no filter), loads via getNotesApi().listNotes(), renders cards or empty state (“No notes yet” → “Create your first idea”).
  - **ui/index.ts:** Notes tab wired in __renderContent; `goToSourceFromNote(note)` for note cards (annotationId → scroll to highlight). Mount options include `getNotesApi`.
  - **extension-content.ts:** Passes `getNotesApi` (createNotesApi from getApiBaseUrl).

**Next step to implement:** Step 6 (Threaded notes).

---

## Plan for next steps

| Order | Step | Status |
|-------|------|--------|
| 1 | Step 1: Sidebar shell and layout | Done |
| 2 | Step 2: Top bar (favicon, title, domain, search, settings, collapse) | Done |
| 3 | Step 3: Context selector (wire to shell/tabs) | Done |
| 4 | Step 4: Tabs + Annotations tab (new cards, “Go to source”, page↔sidebar sync) | Done |
| 5 | Step 5: Notes tab + note cards | Done |
| 6 | Step 6: Threaded notes | Next |
| 7 | Step 7: Projects tab | Pending |
| 8 | Step 8: Authors tab | Pending |
| 9 | Step 9: Highlight creation flow (floating mini-toolbar) | Pending |
| 10 | Step 10: Settings page | Pending |
| 11 | Step 11: Empty states and visual polish | Pending |

**Optional later:** Wire Chrome Side Panel to annotations via content-script messaging; add search; implement Chat tab when ready.

---

## Instructions for Step 5 (Notes tab)

**Goal:** Notes tab with note cards loaded from the backend. Each card has a **“Go to source”** button (linked annotation or page URL). Context filter applies (This Page vs All Notes).

**Before starting:** Read [BACKEND.md](./BACKEND.md) — **Notes** (list with `?annotationId=`, `?fullPageId=`, `?projectId=`, `?authorId=`, `?parentNoteId=`; note shape: `id`, `content`, `annotationId`, `fullPageId`, `parentNoteId`, `projectId`, `authorId`, `createdAt`, `updatedAt`).

**Implementation checklist:**

1. **Notes API client**
   - Add a small notes API module (e.g. `src/api/notes.ts` or extend backend-store) that:
     - `listNotes(options?: { annotationId?, fullPageId?, projectId?, authorId?, parentNoteId? })` → `GET /notes` with query params → returns note array.
   - Or call `fetch(\`${baseUrl}/notes?…\`)` from the Notes tab renderer; keep base URL from existing store/config.

2. **Note type**
   - Define a `Note` type matching the backend shape (id, content, annotationId?, fullPageId?, parentNoteId?, projectId?, authorId?, createdAt, updatedAt). Add to `src/types.ts` or next to the notes API.

3. **Notes tab renderer**
   - Create `src/ui/notes-tab.ts` (mirror of `annotations-tab.ts`):
     - `renderNotesTab(container, context, deps)` where deps include `getStore`, `getPageUrl`, `getNotesApi` (or baseUrl), and `onGoToSource(note)`.
     - Build list options from context: “This Page” → e.g. `fullPageId` or filter by current page URL (if backend supports `?fullPageId=` or you resolve page→fullPageId); “All Notes” → no filter.
     - Load notes, then render **note cards** (see below). Empty state: “No notes yet” → “Create your first idea”.

4. **Note card component**
   - Create `src/ui/note-card.ts` (or add to a cards file). Per UI.md:
     - Title or first line of note (from `content`).
     - Body (rest of content; optional markdown later).
     - Icons: 🔗 Annotation / 🌐 Page / 📁 Project (show which of `annotationId`, `fullPageId`, `projectId` are set).
     - Author · time (author stub or GET /authors/:id later; time like “Yesterday” or “2h ago”).
     - “Replies (n)” (count of notes with `parentNoteId === note.id`; stub 0 or real from list with `?parentNoteId=`).
     - **“Go to source”** button: if `annotationId` set → same as annotation “Go to source” (scroll to highlight on page; may need to open the note’s page first if different URL). If only `fullPageId`/page URL → navigate to that URL (same tab or new tab from settings later).

5. **Wire Notes tab in shell**
   - In `src/ui/index.ts`, inside `__renderContent`, when `payload.tabId === 'notes'` call `renderNotesTab(main, payload.context, { … })` with the same getStore/getPageUrl and a note-specific `onGoToSource` that can scroll to an annotation by id or navigate to a URL.

6. **Context**
   - “This Page” for notes: filter notes that are linked to the current page (e.g. by `annotationId` for annotations on this page, or by `fullPageId` if you have it for the current page). “All Notes”: no filter. “This Project” / “All Projects”: filter by `projectId` when applicable.

**When done:** Implement **Step 6: Threaded notes** (replies, inline expansion, thread view).

---

## Cross-cutting requirements (apply where relevant)

- **Go to source (every card):** Each card must have a **“Go to source”** button that takes the user to the source:
  - **Annotation card:** Scroll the page to the highlight and pulse it (use existing anchoring/highlighter; open sidebar if closed).
  - **Note card:** Navigate to the linked annotation’s location (page + scroll to highlight), or to the linked page URL if no annotation.
  - **Project / Author:** “Source” can be “view in context” (e.g. filter by project/author and scroll to first item) or open the relevant list.
- **Page ↔ sidebar sync:** When the user **hovers or clicks** on an annotation **on the page** (the highlight):
  - The sidebar should **show that annotation**: switch to Annotations tab if needed, scroll the sidebar to that card, and highlight the card (e.g. border or background).
  - Show **all related stuff**: e.g. linked notes, project, author—either inline on the card or in an expanded section so the user sees everything tied to that annotation without hunting.

---

## Step 1: Sidebar shell and layout — DONE

**Goal:** One sidebar container with correct layout and behavior: position (L/R), width presets (S/M/L), resizable, and Cmd/Ctrl+Shift+H toggle. Placeholder top bar, context selector, and tab strip; one main content area.

**Deliverables:**
- Sidebar shell: position from prefs, width presets (320 / 420 / 560 px), resizable by drag.
- Register Cmd/Ctrl+Shift+H to toggle sidebar (e.g. in `extension-content.ts` or UI mount).
- Placeholder top bar, context selector (“This Page” or static), tab strip (Annotations, Notes, Projects, Authors, Chat), single main content area showing e.g. “Annotations” when that tab is selected.
- Persist sidebar side and default width in `sidebar-prefs` (or chrome.storage). Trigger repositions when side changes (`SIDEBAR_POSITION_CHANGED_EVENT`).

**Before starting:** Read [BACKEND.md](./BACKEND.md) — focus on **List annotations**, **Annotation object shape**, and **Frontend config** so you know how the sidebar will get data.

**When done:** Implement **Step 2: Top bar**.

---

## Step 2: Top bar (favicon, title, domain, search, settings, collapse)

**Goal:** Top bar per UI.md: left (favicon, page title, domain), center (global search), right (settings, collapse).

**Deliverables:**
- Left: page favicon, page title (one line, ellipsis), domain (subtle).
- Center: search input (global fuzzy; can stub to filter in-memory list).
- Right: Settings icon (can open placeholder until Step 10), collapse button.
- Calm, editorial styling; minimal borders.

**Before starting:** Read [BACKEND.md](./BACKEND.md) — **List annotations** (filtering by page/base URL) and **Frontend config** for API base URL.

**When done:** Implement **Step 3: Context selector**.

---

## Step 3: Context selector (This Page / This Project / All Notes / All Projects)

**Goal:** Dropdown under the top bar that changes what is *filtered* in the main content. Options: This Page, This Project, All Notes, All Projects.

**Deliverables:**
- Context selector component; state: `this-page` | `this-project` | `all-notes` | `all-projects`. Persist or keep in memory; pass into active tab when rendering.
- “This Project” can show selected project name when applicable (stub until Projects tab exists).
- Shell passes current context to the active tab’s `render()` / `refresh()`.

**Before starting:** Read [BACKEND.md](./BACKEND.md) — **List annotations** (query params), **Notes** (query params: `projectId`, `annotationId`, `fullPageId`), **Projects** (list/get). Context is “filter”, not “data scope”.

**When done:** Implement **Step 4: Tabs + Annotations tab**.

---

## Step 4: Tabs + Annotations tab with new card design + “Go to source” + page–sidebar sync

**Goal:** Real tab switching; Annotations as default tab with new card design. **Each annotation card has a “Go to source” button.** **When the user hovers or clicks a highlight on the page, the sidebar shows that annotation and all related content.**

**Deliverables:**
- Tab strip switches content; only Annotations has real content; others show “Coming soon” or empty state.
- **Annotations tab:** New card design: color strip, snippet, author · time · project, optional comment, “Notes (n)”, and **“Go to source”** button that scrolls the page to the highlight and pulses it (use existing anchoring; open sidebar if closed).
- **Page → sidebar sync:** On hover/click on a page highlight (element with `data-annotation-id` or inside `.annotator-highlight`):
  - Switch to Annotations tab if needed; scroll sidebar to the matching card; visually highlight that card (e.g. border/background).
  - Show **all related**: linked notes, project, author—on the card or in an expandable section.
- Empty state: “No highlights on this page” → “Select text to highlight”.
- Optional: “Notes (n)” expands linked notes inline (stub or real via backend when available).

**Before starting:** Read [BACKEND.md](./BACKEND.md) — **Annotations** (list, get one, object shape with `authorId`, `projectId`), **Notes** (list by `annotationId`), **Authors** (get one for display name), **Projects** (get one for name). Highlighter uses `data-annotation-id` on spans ([BACKEND.md](./BACKEND.md) is API; DOM is in `src/core/highlighter.ts`).

**When done:** Implement **Step 5: Notes tab**.

---

## Step 5: Notes tab (list + note cards; “Go to source” on note cards)

**Goal:** Notes tab with note cards. Each **note card** has a **“Go to source”** button (linked annotation’s location or page URL).

**Deliverables:**
- Notes tab: list of note cards (title/first line, body, 🔗 Annotation / 🌐 Page / 📁 Project, author · time, “Replies (n)”).
- **“Go to source” on note card:** Navigate to linked annotation (scroll page to highlight) or to linked page URL.
- Context: “This Page” vs “All Notes” filters; use mock or in-memory notes until API is wired (GET /notes with `annotationId`, `fullPageId`, `projectId`).
- Empty state: “No notes yet” → “Create your first idea”.

**Before starting:** Read [BACKEND.md](./BACKEND.md) — **Notes** (list with `?annotationId=`, `?fullPageId=`, `?parentNoteId=`, `?authorId=`, `?projectId=`, note shape with `annotationId`, `fullPageId`, `parentNoteId`, `projectId`, `authorId`).

**When done:** Implement **Step 6: Threaded notes**.

---

## Step 6: Threaded notes (inline expansion + focused thread view)

**Goal:** Notes can reply to notes; inline expansion of replies and a focused thread view with breadcrumb.

**Deliverables:**
- Reply relationship (`parentNoteId`); “Replies (n)” expands inline with reply cards (indented/connector).
- Focused thread view: “Notes / [Note title] / Thread”, vertical list of replies; Back returns to Notes list.
- **“Go to source”** still works for each note in the thread (per Step 5).

**Before starting:** Read [BACKEND.md](./BACKEND.md) — **Notes** (create/update with `parentNoteId`, list with `?parentNoteId=` for replies).

**When done:** Implement **Step 7: Projects tab**.

---

## Step 7: Projects tab (list + detail; “Go to source” where applicable)

**Goal:** Projects list and detail view; projects reference notes/annotations, they don’t own them. “Go to source” for project can mean “view in context” or open filtered list.

**Deliverables:**
- Project list: name, color/icon, members, counts (notes, annotations). Use GET /projects and GET /projects/:id (with counts).
- Project detail: timeline of notes, annotations, pages; filters by author/type; back to list.
- Empty state: “No projects” → “Organize your knowledge”.
- **“Go to source”** on a project card: e.g. open project detail or filter main content by project.

**Before starting:** Read [BACKEND.md](./BACKEND.md) — **Projects** (list, get one with counts), **Project members** (list, add, remove).

**When done:** Implement **Step 8: Authors tab**.

---

## Step 8: Authors tab (list + filter; “Go to source” where applicable)

**Goal:** Authors list; clicking an author filters annotations/notes and highlights thread participation. “Go to source” can open filtered view or first item.

**Deliverables:**
- Authors list (GET /authors). Click author: set “filter by author”; Annotations/Notes tabs respect it; highlight thread participation in note threads.
- **“Go to source”** for author: e.g. show content filtered by that author and scroll to first relevant card.
- Empty state if no authors.

**Before starting:** Read [BACKEND.md](./BACKEND.md) — **Authors** (list, get one, create, update, delete). Annotation/note responses include `authorId` for filtering.

**When done:** Implement **Step 9: Highlight creation flow**.

---

## Step 9: Highlight creation flow (floating mini-toolbar)

**Goal:** On text selection, show floating mini-toolbar (highlight style, add note, assign project). No modals; highlight appears immediately and shows in sidebar; optional note/project.

**Deliverables:**
- On selection: floating toolbar near selection (style, “Add note”, “Assign project”).
- On highlight: create annotation via backend (POST /annotations), draw highlight, open sidebar and refresh Annotations tab. **Page–sidebar sync:** new highlight can be focused in sidebar (scroll to card, highlight card).
- “Add note” creates note (POST /notes with `annotationId`) and optionally focus it in Notes tab.
- “Assign project” (dropdown/list from GET /projects); PATCH annotation or send projectId on create.
- No modals; toolbar hides on blur or after action.

**Before starting:** Read [BACKEND.md](./BACKEND.md) — **Create annotation** (POST body with `authorId`, `projectId`, `highlightStyleId`), **Notes** (POST with `annotationId`, `projectId`, `authorId`), **Projects** (list for dropdown).

**When done:** Implement **Step 10: Settings page**.

---

## Step 10: Settings page

**Goal:** Settings view from top bar: Behavior, Appearance, Highlights, Notes. Persist and apply immediately.

**Deliverables:**
- Behavior: open links (same/new tab), auto-open sidebar on highlight, scroll page on hover.
- Appearance: sidebar side (L/R), default width (S/M/L), theme (Light/Dark/System).
- Highlights: default style, opacity, animation (optional); consider GET /highlight-styles for presets.
- Notes: default creation (standalone vs auto-link to context).
- Persist in `sidebar-prefs` or chrome.storage; apply theme and width/side in the shell.

**Before starting:** Read [BACKEND.md](./BACKEND.md) — **Highlight styles** (list, get, create, update) if you want presets in settings; **Frontend config** for API URL storage.

**When done:** Implement **Step 11: Empty states and polish**.

---

## Step 11: Empty states and visual polish

**Goal:** Consistent empty states and UI.md visual tone; Chat tab reserved.

**Deliverables:**
- Empty states everywhere (Annotations, Notes, Projects, Authors) with clear CTAs.
- Visual tone: editorial, calm; soft surfaces; minimal borders; color for meaning; motion 150–200 ms (hover, expand, tab switch).
- Chat tab: reserved placeholder (“Chat coming soon” or icon) for future AI.

**Before starting:** Re-read [BACKEND.md](./BACKEND.md) if you need to wire any last options (e.g. highlight presets, API URL) from settings.

**When done:** All steps complete. Optional follow-ups: wire Notes/Projects/Authors to real API if still using mocks; add search across notes/annotations/projects/authors; implement Chat tab when ready.

---

## Quick reference: BACKEND.md sections

| Step        | Relevant BACKEND.md sections                          |
|------------|--------------------------------------------------------|
| 1          | List annotations, Annotation shape, Frontend config   |
| 2          | List annotations, Frontend config                     |
| 3          | List annotations, Notes (query params), Projects      |
| 4          | Annotations, Notes (by annotationId), Authors, Projects; highlighter DOM |
| 5          | Notes (list, shape)                                    |
| 6          | Notes (parentNoteId, replies)                          |
| 7          | Projects, Project members                              |
| 8          | Authors                                                |
| 9          | Create annotation, Notes (create), Projects (list)     |
| 10         | Highlight styles, Frontend config                      |
| 11         | Any remaining wiring                                   |
