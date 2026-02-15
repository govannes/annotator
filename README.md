# Annotator

Highlight and annotate any webpage with persistent, fuzzy-anchored selections. Works as a Chrome extension that injects a floating toolbar onto every page.

Annotations survive page changes. When the DOM shifts — ads load, elements reorder, whitespace changes — the four-strategy anchoring system (modeled after [Hypothesis](https://web.hypothes.is/blog/fuzzy-anchoring/)) finds the original text and re-attaches the highlight.

## How It Works

When you highlight text, three selectors are stored simultaneously:

| Selector | What it stores | When it helps |
|---|---|---|
| **RangeSelector** | XPath to start/end elements + character offsets | DOM unchanged (best case) |
| **TextPositionSelector** | Global character offsets in the full page text | DOM restructured, text unchanged |
| **TextQuoteSelector** | Exact text + 32 chars of prefix/suffix context | Text moved or whitespace changed (fuzzy) |

On reload, the system tries all four strategies in order until one succeeds:

```
1. Range     → XPath + offsets (exact DOM match)
2. Position  → global char offsets (structure changed, text same)
3. Quote+ctx → prefix + exact + suffix search (fuzzy, whitespace-normalized)
4. Quote     → exact text search, disambiguated by position/context (last resort)
```

This gives ~99% re-attachment on real-world pages including SPAs, dynamic feeds, and content that loads asynchronously.

## Project Structure

```
src/
├── types.ts                    # Annotation, Selector, AnchorResult types
├── annotation.ts               # Fluent API: Annotation.annotate().done(), Annotation.load()
├── main.ts                     # Annotator init, button handlers, highlight selection
├── extension-content.ts        # Chrome extension entry: toolbar, DB overlay, SPA lifecycle
│
├── core/
│   ├── index.ts                # Barrel exports
│   ├── selectors.ts            # Build selectors from a Range (XPath, TextPosition, TextQuote)
│   ├── anchoring.ts            # Raw anchoring strategy functions (range, position, quote)
│   ├── anchorer.ts             # Orchestrator: tries all 4 strategies, disambiguates duplicates
│   ├── annotation-highlighter.ts  # Per-annotation pipeline: resolve range → draw highlight
│   ├── highlighter.ts          # DOM highlight rendering (wrap text in <span>)
│   ├── dom-text-mapper.ts      # Bidirectional mapping: DOM ↔ character offsets
│   └── content-url.ts          # Derive stable content URLs for blocks (tweets, articles, etc.)
│
├── api/
│   ├── index.ts                # Barrel exports
│   ├── storage.ts              # AnnotationStore interface + in-memory implementation
│   └── local-store.ts          # localStorage-backed AnnotationStore
│
└── global.d.ts                 # Minimal Chrome extension API types

extension/
├── manifest.json               # Chrome MV3 manifest (content script + side panel)
└── sidepanel.html              # Placeholder side panel
```

## Quick Start

```bash
# Install dependencies
npm install

# Development (Vite dev server)
npm run dev

# Build the Chrome extension
npm run build:extension
```

### Load the Extension in Chrome

1. Run `npm run build:extension`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the `dist-extension/` folder
5. Navigate to any page — the floating toolbar appears at the bottom

## API

### Create an Annotation

```typescript
import { Annotation } from './annotation';

// Configure once at startup
Annotation.configure({
  getStore: () => Promise.resolve(myStore),
  getPageUrl: () => window.location.href,
});

// Highlight a selection and persist it
const selection = window.getSelection();
const range = selection.getRangeAt(0);

const annotation = await Annotation.annotate({
  range,
  root: document.body,
  highlightColor: 'rgba(255, 220, 0, 0.35)',
}).done();
```

### Load and Draw Annotations

```typescript
// Load all annotations for the current page and draw highlights
const result = await Annotation.load(window.location.href).into(document.body);

console.log(`${result.anchored}/${result.total} highlights anchored`);
```

### Storage

The `AnnotationStore` interface is intentionally simple — swap implementations without touching the rest of the code:

```typescript
interface AnnotationStore {
  load(options?: LoadOptions): Promise<Annotation[]>;
  save(annotation: Annotation): Promise<Annotation>;
  delete(id: string): Promise<void>;
}
```

Built-in implementations:
- `createLocalStore()` — localStorage (used by the extension)
- `createMemoryStore()` — in-memory (for development/testing)

## Architecture

```
User selects text
       │
       ▼
 ┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
 │  Build 3     │     │  Store          │     │  Draw        │
 │  selectors   │────▶│  annotation     │────▶│  highlight   │
 │  (Range,     │     │  (localStorage  │     │  (<span>     │
 │   Position,  │     │   or API)       │     │   wrapping)  │
 │   Quote)     │     └─────────────────┘     └──────────────┘
 └─────────────┘

Page loads / reloads
       │
       ▼
 ┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
 │  Load from   │     │  Anchor each    │     │  Draw        │
 │  store       │────▶│  (4 strategies  │────▶│  highlights  │
 │              │     │   in order)     │     │              │
 └─────────────┘     └─────────────────┘     └──────────────┘
```

## Content-Scoped Annotations

On feed pages (Twitter, Reddit, HN, etc.), annotations are scoped to individual content blocks rather than the whole page. The system automatically:

1. Discovers content blocks by looking for permalink-style links, element IDs, and `data-*` attributes
2. Assigns each block a stable content URL (e.g., a tweet's permalink)
3. Anchors annotations within the correct block, falling back to page-level if the block isn't found

This means an annotation on a specific tweet will re-anchor correctly even as the feed reorders.

## Tech Stack

- **TypeScript** — strict mode, no `any`
- **Vite** — dev server and IIFE bundle for the extension content script
- **Chrome Extension MV3** — content script injected on all pages
- **Zero runtime dependencies** for the core (DOM APIs only); `node-html-parser` used in the text mapper

## Status

v0.1.0 — Core anchoring, highlighting, and persistence work. The extension injects a toolbar with highlight, view DB, and delete actions. SPA navigation and dynamic content loading are handled via MutationObserver.
