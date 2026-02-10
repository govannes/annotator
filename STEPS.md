# Sidebar UI implementation steps

Track progress and move between steps here. **Before starting any step**, read [BACKEND.md](./BACKEND.md) so you understand how the current backend works (annotations, notes, projects, authors, full-page, highlight styles, and API shapes).

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

## Step 1: Sidebar shell and layout

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
