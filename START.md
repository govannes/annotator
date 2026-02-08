# TypeScript annotation + fuzzy anchoring (frontend-only)

Step-by-step plan to build an annotation system in TypeScript using the [Hypothesis fuzzy anchoring](https://web.hypothes.is/blog/fuzzy-anchoring/) approach. Frontend-only: no backend; behavior and data shapes so you can design the API later.

---

## 1. Target behavior (what the frontend does)

- **Create:** User selects text → compute and store **all three selectors** (Range, TextPosition, TextQuote) → persist (e.g. in memory / localStorage for now).
- **Load:** Given a list of annotations (each with selectors), **re-attach** each to the current DOM using the four strategies in order; draw a highlight if a match is found.
- **No server:** Storage is a simple interface (save/load annotations). You replace it with a real backend later.

---

## 2. Data shapes (TypeScript types)

Define these first; they drive the rest.

```ts
// One annotation target can have multiple selector types (we store all we can compute)
interface RangeSelector {
  start: string;       // XPath to element containing start of selection
  end: string;
  startOffset: number; // character offset within that element's text
  endOffset: number;
}

interface TextPositionSelector {
  start: number;       // character offset in "whole document" text
  end: number;
}

interface TextQuoteSelector {
  exact: string;       // selected text
  prefix: string;     // e.g. 32 chars before
  suffix: string;     // e.g. 32 chars after
}

interface AnnotationTarget {
  source: string;     // URL of the document (for later: which page)
  selector: {
    range?: RangeSelector;
    textPosition?: TextPositionSelector;
    textQuote?: TextQuoteSelector;
  };
}

interface Annotation {
  id: string;
  target: AnnotationTarget;
  body?: { type: string; value: string };  // your note content, etc.
  created?: string;
  // ... any other fields you want; backend can mirror this
}
```

The **frontend** is responsible for creating and updating `AnnotationTarget.selector`. The backend only needs to **store and return** these JSON objects.

---

## 3. Step-by-step implementation plan

### Phase A: Document as string + mapping (foundation)

You need a single “document text” and a two-way mapping: **DOM ↔ character offsets**. This is what the blog calls “internal text representation” and “bi-directional mapping.”

**Step 1 – Text extraction**

- **Input:** A root DOM element (e.g. `document.body` or your annotatable container).
- **Output:** One string = concatenation of “visible” text in DOM order (like the user would select it).
- **How:** Walk the DOM (e.g. in tree order); for each text node, append its `textContent` (or use the Selection API: select each node range and get `toString()`). Normalize whitespace in a consistent way (e.g. collapse spaces, handle block vs line breaks).
- **Deliverable:** `getDocumentText(root: Node): string`.

**Step 2 – DOM ↔ offset mapping**

- **Output:** A mapping that, for any character range `[start, end]` in the string from Step 1, gives you the corresponding DOM range (startContainer, startOffset, endContainer, endOffset), and vice versa.
- **How:** While building the string, record for each “segment” (e.g. each text node’s contribution) the start and end offsets in the string and the corresponding DOM node(s). Then you can:
  - **String → DOM:** Given `(start, end)`, find which segments they fall in and compute the exact Range.
  - **DOM → String:** Given a Range, get the selected text and its position in the concatenated string (walk the same segments).
- **Deliverable:** A small module, e.g. `DomTextMapper`, with:
  - `build(root: Node): { text: string; mapper: Mapper }`
  - `mapper.rangeToOffsets(domRange: Range): { start: number; end: number }`
  - `mapper.offsetsToRange(start: number, end: number): Range | null`

This is the same idea as the blog’s dom-text-mapper: “analyses the DOM, extracts the text strings, and creates the mappings between the DOM nodes and the resulting string slices.”

---

### Phase B: Capture all three selectors on create

When the user selects text and clicks “Annotate”, you compute Range, TextPosition, and TextQuote from the current DOM and document string.

**Step 3 – RangeSelector (XPath + offsets)**

- **Input:** Current selection (Range).
- **Output:** `RangeSelector`: XPath strings for the **element** containing the start and end of the selection, plus character offsets within those elements’ text.
- **How:** Same idea as current annotator + xpath-range: normalize the range to text nodes, then for start/end elements compute a path from root (e.g. `div[1]/p[2]`). Offsets = character counts within that element’s text.
- **Deliverable:** `toRangeSelector(domRange: Range, root: Node): RangeSelector`.
- **Reuse:** You can port the logic from `xpath-range` (serialize) or implement a minimal XPath-from-node and node-from-XPath.

**Step 4 – TextPositionSelector**

- **Input:** Same selection + your `DomTextMapper`.
- **Output:** `TextPositionSelector`: `{ start, end }` character offsets in the full document text.
- **How:** Use `mapper.rangeToOffsets(domRange)`.
- **Deliverable:** `toTextPositionSelector(domRange: Range, mapper: Mapper): TextPositionSelector`.

**Step 5 – TextQuoteSelector**

- **Input:** The document text + the offsets (or the selected text + document text).
- **Output:** `TextQuoteSelector`: `exact` (selected text), `prefix` (e.g. 32 chars before), `suffix` (e.g. 32 chars after). Clip prefix/suffix at document boundaries.
- **Deliverable:** `toTextQuoteSelector(documentText: string, start: number, end: number, prefixLen?: number, suffixLen?: number): TextQuoteSelector`.

**Step 6 – Create annotation (orchestration)**

- On “create annotation”:
  1. Get current selection → Range.
  2. Build or reuse `DomTextMapper` for your root.
  3. Compute `rangeSelector = toRangeSelector(selection, root)`.
  4. Compute `textPositionSelector = toTextPositionSelector(selection, mapper)`.
  5. Compute `textQuoteSelector = toTextQuoteSelector(mapper.text, textPosition.start, textPosition.end)`.
  6. Build `Annotation` with `target.selector = { range: ..., textPosition: ..., textQuote: ... }`, `target.source = window.location.href` (or your canonical URL).
  7. Save via your storage interface (e.g. in-memory array or localStorage).
  8. Draw highlight on the current selection (you already have the Range).

---

### Phase C: Re-attachment (four strategies)

When loading annotations (e.g. on page load, or when injecting into an iframe), for each annotation you try to find a DOM range, then draw the highlight.

**Step 7 – Strategy 1: From RangeSelector**

- **Input:** Stored `RangeSelector`, root node.
- **Output:** `Range | null`.
- **How:** Resolve XPath start/end to DOM nodes, then create a Range with the stored character offsets within those elements. If you have a `TextQuoteSelector`, get the text from that range and compare to `exact`; if it doesn’t match, return null.
- **Deliverable:** `anchorFromRangeSelector(selector: RangeSelector, root: Node, expectedQuote?: string): Range | null`.

**Step 8 – Strategy 2: From TextPositionSelector**

- **Input:** Stored `TextPositionSelector`, your current `DomTextMapper`.
- **Output:** `Range | null`.
- **How:** `mapper.offsetsToRange(selector.start, selector.end)`. Verify with `expectedQuote` if present.
- **Deliverable:** `anchorFromTextPositionSelector(selector: TextPositionSelector, mapper: Mapper, expectedQuote?: string): Range | null`.

**Step 9 – Strategy 3: Context-first fuzzy (prefix/suffix + exact)**

- **Input:** Document text, `TextQuoteSelector` (prefix, exact, suffix), optional hint position (e.g. from TextPositionSelector).
- **Output:** `{ start: number; end: number } | null` (offsets in document text).
- **How:**
  - Option A (exact): Find `prefix` in the document text (near hint if provided), then find `suffix` after that, then the text between must equal (or be very close to) `exact`.
  - Option B (fuzzy): Use a fuzzy matcher (e.g. diff-match-patch or similar) to find “best” prefix match, then suffix, then compare the span between to `exact` with a small tolerance.
- Then convert offsets → DOM range with `mapper.offsetsToRange(start, end)`.
- **Deliverable:** `anchorFromQuoteContext(documentText: string, quote: TextQuoteSelector, hintStart?: number, fuzzy?: boolean): { start: number; end: number } | null`.

**Step 10 – Strategy 4: Selector-only fuzzy (exact only)**

- **Input:** Document text, `exact` string.
- **How:** Fuzzy search for `exact` in the document (e.g. diff-match-patch). If there’s one good match (or you have a heuristic for “best” when there are many), return that offset range. Then `mapper.offsetsToRange(start, end)`.
- **Deliverable:** `anchorFromQuoteOnly(documentText: string, exact: string): { start: number; end: number } | null`.

**Step 11 – Re-attach orchestrator**

- For one annotation:
  1. Get `documentText` and `mapper` for current root (build once per page or per “annotatable” root).
  2. Try Strategy 1 (RangeSelector). If result non-null and (if you have quote) text matches → use it.
  3. Else try Strategy 2 (TextPositionSelector). Same.
  4. Else try Strategy 3 (TextQuote prefix/suffix + exact, optional fuzzy).
  5. Else try Strategy 4 (fuzzy exact only).
  6. If any step returns a Range (or offset range you can convert), draw highlight; otherwise mark as “could not anchor” (e.g. show in a sidebar without a highlight).
- **Deliverable:** `anchorAnnotation(annotation: Annotation, root: Node, mapper: DomTextMapper): Range | null`.

---

### Phase D: UI and storage (minimal)

**Step 12 – Selection → create flow**

- Listen for selection (e.g. mouseup on document or your container).
- When user triggers “Add annotation” (button or shortcut):
  - Build mapper for root.
  - Compute all three selectors and create `Annotation`.
  - Call storage.save(annotation).
  - Add highlight for the current selection (you already have the Range).

**Step 13 – Load → re-attach flow**

- On load (or when “loading” annotations from your storage):
  - Build mapper once for root.
  - For each annotation, call `anchorAnnotation(...)`.
  - For each that returns a Range, draw a highlight and associate it with that annotation (e.g. for hover/click to show note).
- **Deliverable:** Highlighter that takes a `Range` and draws a span (or uses CSS highlight); store `annotation.id` on the span so you can show the body on click.

**Step 14 – Storage interface (frontend-only)**

- Define an interface, e.g. `AnnotationStore { load(): Promise<Annotation[]>; save(annotation: Annotation): Promise<Annotation>; delete(id: string): Promise<void> }`.
- Implement one version that keeps annotations in memory (or localStorage). Later you swap this for `fetch` to your backend; the rest of the app only uses the interface.

---

## 4. Order of work (concise)

1. **DomTextMapper** (Steps 1–2): text extraction + bidirectional mapping.
2. **Selectors on create** (Steps 3–6): Range, TextPosition, TextQuote from selection; build `Annotation` and save.
3. **Strategy 1 & 2** (Steps 7–8): re-attach from Range and from TextPosition.
4. **Simple UI** (Steps 12–14): create on button click, load and draw, in-memory/localStorage store.
5. **Strategy 3 & 4** (Steps 9–11): fuzzy quote context, then quote-only; wire into `anchorAnnotation`.
6. **Polish:** when to rebuild mapper (e.g. after your own DOM changes from highlights), duplicate text handling (prefer position hint), etc.

---

## 5. What the frontend “dictates” for the backend

- **Stored per annotation:** Exactly the `Annotation` shape above (id, target with `range` / `textPosition` / `textQuote`, body, timestamps, etc.). The backend just stores and returns JSON.
- **No anchoring logic on the server:** Re-attachment is 100% frontend using the current DOM and the stored selectors.
- **Optional:** If you later want “search annotations by document,” the backend can index `target.source` (URL). If you want “list annotations that couldn’t anchor,” the frontend can send a flag when Strategy 4 fails or all strategies fail.

This plan gives you a TS frontend that implements the Hypothesis-style behavior and clear contracts so you can design the BE (REST or other) around the same `Annotation` shape and store interface.
