# Highlight algorithm

This document describes how the annotator highlights a DOM `Range` without breaking document structure (e.g. tables, lists).

## Goal

- **Never wrap block or structural elements** (e.g. `<table>`, `<thead>`, `<tr>`, `<td>`) in a `<span>`. Wrapping would break HTML and layout.
- **Use two strategies**: wrap only **text** in `<span>`s, and add a **CSS class** (and `data-*`) to **elements** that are fully inside the selection.
- **Avoid empty spans**: do not create spans for whitespace-only segments (newlines, spaces between tags).

## Input and output

- **Input**: a DOM `Range`, an `annotationId`, and optional style (`type`, `color`).
- **Output**: the DOM is updated so the selection is visually highlighted; the function returns the first created span (or `undefined` if only elements were styled).

## Algorithm overview

1. **Collect** what to highlight: text segments (node + start/end offsets) and elements that are fully contained in the range.
2. **Apply** highlights: add class to collected elements, then wrap each text segment in a `<span>` (from last to first so DOM changes don’t invalidate earlier segments).

---

## Step 1: Walk root

- `root = range.commonAncestorContainer`
- If `root` is a text node, set `walkRoot = root.parentNode ?? root` so we always walk from an element.
- Otherwise `walkRoot = root`.

We will only visit nodes under `walkRoot` that intersect the range.

---

## Step 2: Collect ranges

We do a single tree walk from `walkRoot` and fill two lists:

- **Text segments**: `{ node: Text, start: number, end: number }` for each text node that intersects the range and has **non-whitespace** selected text.
- **Elements**: every **element** that is **fully contained** in the range (selection starts before the element and ends after it).

### Text nodes

- For each node that intersects the range (`range.intersectsNode(node)`):
  - If it’s a **text node**, compute the intersection of the range with that node → `(start, end)` character offsets.
  - If the substring `node.data.slice(start, end)` has at least one non-whitespace character (`text.trim().length > 0`), push `{ node, start, end }` into **text segments**.
  - If the substring is empty or only whitespace, **do not** add a segment (avoids empty spans between table cells, etc.).

Intersection is computed with `Range.compareBoundaryPoints` against a range that selects the full text node, then taking the overlapping `[start, end]` in that node.

### Element nodes

- If the node is an **element**:
  - If the range **fully contains** the element (range start ≤ element start and range end ≥ element end, using `compareBoundaryPoints` on a range that selects the element’s contents), push the element into **elements** and **do not** recurse into its children (the whole element is highlighted).
  - Otherwise, recurse into its children (the element is only partially selected; we will only wrap text and/or highlight descendants).

So we either highlight the whole element with a class or we descend and only touch text and inner elements.

---

## Step 3: Apply highlights

### 3a. Style fully contained elements

For each collected element:

- Add class `annotator-highlight`.
- Set `data-annotation-id`, optional `data-highlight-type`, and optional inline `backgroundColor`.

No new nodes are inserted; the existing `<td>`, `<th>`, `<tr>`, etc. are just styled.

### 3b. Wrap text segments in spans

For each text segment (processed **from last to first** by document order):

- If the segment’s text is empty or whitespace-only, skip (return `null`).
- If the text node’s `parentNode` is null (detached), skip.
- Otherwise:
  - Split the text node into: *before* `[0, start)`, *middle* `[start, end)`, *after* `[end, length]`.
  - Create a `<span class="annotator-highlight">` with `data-annotation-id` (and optional type/color).
  - Replace the original text node with: *before* text node, span containing *middle*, *after* text node.

Processing from **last to first** keeps earlier segment positions valid while we mutate the DOM.

---

## Summary table

| Content in range              | Action                                                                 |
|------------------------------|-----------------------------------------------------------------------|
| Text (non-whitespace)        | Wrap that slice in `<span class="annotator-highlight">`               |
| Text (whitespace-only)       | Ignore (no span)                                                      |
| Element fully inside range   | Add `annotator-highlight` class + `data-*` on the element            |
| Element partially in range  | Recurse; only wrap text and/or highlight fully contained descendants |

## Edge cases

- **Detached nodes**: If a segment’s text node has no `parentNode` when we try to wrap (e.g. after other highlights changed the DOM), we skip that segment and return `null`.
- **Empty/whitespace segments**: Skipped both at collection time and again in `wrapTextSegment`, so we never create empty spans.
- **Loading multiple annotations**: The app rebuilds the DOM–text mapper after each highlight so the next annotation is anchored against the current DOM and never uses detached nodes.

## Files

- Implementation: `src/highlighter.ts`
- Usage: `src/main.ts` (create annotation, load and re-attach annotations)
