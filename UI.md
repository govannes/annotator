Perfect — let’s lock this in as **one clear, implementation-ready UI/UX explanation**, written so a frontend team can start building immediately. I’ll keep it decisive, not fluffy, and I’ll include **conceptual mock references** (visual inspiration) plus **layout descriptions precise enough to implement without guessing**.

---

## Product intent (1 paragraph, align everyone)

The Highlighter sidebar is a **contextual knowledge panel for the web**.
It shows annotations, notes, projects, and authors **filtered by what the user is currently looking at**, while allowing instant navigation to the broader knowledge graph. Annotations are page-anchored highlights. Notes are global, first-class ideas that can reference anything (annotations, pages, projects, or other notes). The sidebar must feel fast, calm, and invisible when not needed—and powerful when opened.

---

## Core UX Principles (non-negotiable)

1. **Context ≠ ownership**
   Pages don’t own notes. Context only filters what’s shown.
2. **Immediate feedback**
   Highlight → appears instantly in sidebar.
3. **Progressive disclosure**
   Shallow by default, deep when requested.
4. **Graph, not folders**
   Relationships are visible but not overwhelming.
5. **Future AI-ready**
   Layout reserves space and mental room for chat.

---

## Sidebar Container

* Docked panel (Chrome extension)
* Position:

  * Right (default)
  * Left (user setting)
* Width presets:

  * Small: ~320px
  * Medium (default): ~420px
  * Large: ~560px
* Resizable by drag
* Toggle shortcut: `Cmd/Ctrl + Shift + H`

---

## Global Layout (Top → Bottom)

```
┌────────────────────────────────┐
│ Top Bar                        │
├────────────────────────────────┤
│ Context Selector               │
├────────────────────────────────┤
│ Main Content (Tabs)             │
│                                │
│  - Annotations                  │
│  - Notes                        │
│  - Projects                     │
│  - Authors                      │
│  - (Future) Chat                │
│                                │
└────────────────────────────────┘
```

---

## Top Bar (Always Visible)

**Left**

* Page favicon
* Page title (1 line, ellipsis)
* Domain (subtle)

**Center**

* Search input (global, fuzzy)

  * searches notes, annotation text, authors, projects

**Right**

* Settings icon
* Collapse sidebar button

---

## Context Selector (Critical UX)

Directly under top bar.

Dropdown values:

* **This Page**
* **This Project** (if selected)
* **All Notes**
* **All Projects**

What it does:

* Changes *filters*, not data scope
* Never hides the existence of global notes

---

## Tabs & Behaviors

---

## 1. Annotations Tab (Default on page load)

**Purpose:**
Show everything highlighted **on the current page**.

### Annotation Card

```
[ Color strip ]
"Highlighted text snippet…"

👤 Author · 🕒 2h ago · 📁 ProjectName

Optional inline comment
────────────────────────
💬 Notes (3)   ↪ Jump
```

**Behaviors**

* Hover card → scroll page to highlight + pulse
* Click highlight text → centers page
* “Notes (n)” → expands linked notes inline

**Key rule**
Annotations are always page-anchored.
They may *link out* to notes.

---

## 2. Notes Tab (Most Important)

**Purpose:**
Represent the **thinking layer**, not tied to pages.

### Default Mode: Contextual Notes

When on a page, show notes that relate to:

* annotations on this page
* this page URL
* selected project(s)

### Toggle: “All Notes”

Global knowledge view.

---

### Note Card

```
Title or first line of note

This is a longer note body that can
span multiple lines and supports
markdown…

🔗 Annotation  🌐 Page  📁 Project
👤 Author · 🕒 Yesterday

💬 Replies (2)
```

### Relationships (visually encoded)

* Icons indicate what the note references
* Multiple allowed
* No hierarchy implied

---

### Threaded Notes

Notes can reply to notes.

Two UX levels:

1. **Inline expansion**
2. **Focused thread view**

Focused view replaces main content, with breadcrumb:

```
Notes / Research Ideas / Thread
```

Replies are vertically stacked with subtle connectors.

---

## 3. Projects Tab

**Purpose:**
Zoom out and organize meaning.

Project list shows:

* Name
* Color/icon
* Members
* Counts (notes, annotations)

Project detail view:

* Filtered timeline of:

  * notes
  * annotations
  * pages referenced
* Filters by author / type

Projects never “contain” notes — they **reference** them.

---

## 4. Authors Tab

Shows contributors.

Clicking an author:

* Filters annotations + notes
* Highlights thread participation

---

## 5. Chat Tab (Future, Reserved)

Do not implement now, but reserve space.

Planned:

* Chat scoped to:

  * page
  * project
  * selected notes
* Context auto-assembled

---

## Highlight Creation Flow (On Page)

1. User selects text
2. Floating mini-toolbar appears:

   * Highlight style
   * Add note
   * Assign project
3. On action:

   * Highlight applied immediately
   * Annotation appears in sidebar
   * Optional note is created and linked

No modals. Ever.

---

## Settings Page

### Behavior

* Open links: same tab / new tab
* Auto-open sidebar on highlight
* Scroll page on hover

### Appearance

* Sidebar side (L/R)
* Default width (S/M/L)
* Theme (Light/Dark/System)

### Highlights

* Default style
* Opacity
* Animation

### Notes

* Default creation behavior:

  * Standalone
  * Auto-link to context

---

## Empty States (Mandatory)

Examples:

* “No highlights on this page”
  → “Select text to highlight”
* “No notes yet”
  → “Create your first idea”
* “No projects”
  → “Organize your knowledge”

---

## Visual Tone

* Editorial, calm
* Soft surfaces, minimal borders
* Color reserved for meaning (highlights)
* Motion: subtle, 150–200ms

---

## Summary Sentence (Implementation North Star)

> The Highlighter sidebar is a **context-aware knowledge panel** that shows annotations anchored to pages and global notes that connect ideas across pages, projects, people, and threads—without ever breaking the user’s reading flow.

---
