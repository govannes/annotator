/**
 * Draw a highlight over a Range and associate it with an annotation id.
 * Only the text is highlighted: each run of text in the range is wrapped in a
 * <span class="annotator-highlight"> so that structure (tables, lists, etc.) is never broken.
 */

const HIGHLIGHT_CLASS = 'annotator-highlight';

export interface HighlightOptions {
  /** e.g. 'highlight', 'underline', 'sticky-note'. */
  type?: string;
  /** CSS color, e.g. '#ffff00' or 'rgba(255,220,0,0.35)'. */
  color?: string;
}

/** Returns the intersection of range with a text node as offsets, or null if none. */
function getTextNodeSlice(textNode: Text, range: Range): { start: number; end: number } | null {
  if (!range.intersectsNode(textNode)) return null;
  const nodeRange = document.createRange();
  nodeRange.selectNodeContents(textNode);
  const startCmp = range.compareBoundaryPoints(Range.START_TO_START, nodeRange);
  const endCmp = range.compareBoundaryPoints(Range.END_TO_END, nodeRange);
  if (startCmp >= 0 && endCmp <= 0) {
    return { start: range.startOffset, end: range.endOffset };
  }
  const intersectionStart = startCmp <= 0 ? 0 : range.startOffset;
  const intersectionEnd = endCmp >= 0 ? textNode.length : range.endOffset;
  if (intersectionStart >= intersectionEnd) return null;
  return { start: intersectionStart, end: intersectionEnd };
}

/** True if the range fully contains the element (element is entirely inside the range). */
function rangeFullyContainsElement(range: Range, element: Element): boolean {
  const elRange = document.createRange();
  elRange.selectNodeContents(element);
  return (
    range.compareBoundaryPoints(Range.START_TO_START, elRange) <= 0 &&
    range.compareBoundaryPoints(Range.END_TO_END, elRange) >= 0
  );
}

interface TextSegment {
  node: Text;
  start: number;
  end: number;
}

function collectHighlightRanges(
  range: Range,
  root: Node
): { textSegments: TextSegment[] } {
  const textSegments: TextSegment[] = [];

  function walk(node: Node | null): void {
    if (!node || !range.intersectsNode(node)) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const slice = getTextNodeSlice(node as Text, range);
      if (slice) {
        const text = (node as Text).data.slice(slice.start, slice.end);
        if (text.trim().length > 0) textSegments.push({ node: node as Text, ...slice });
      }
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      // Highlight only text: descend into fully-contained elements and wrap their text, don't style the whole element
      if (rangeFullyContainsElement(range, el)) {
        for (let i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i] ?? null);
        return;
      }
      for (let i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i] ?? null);
    }
  }

  walk(root);
  return { textSegments };
}

function wrapTextSegment(
  segment: TextSegment,
  annotationId: string,
  options: HighlightOptions
): HTMLSpanElement | null {
  const { node, start, end } = segment;
  const midText = node.data.slice(start, end);
  if (midText.trim().length === 0) return null;
  const parent = node.parentNode;
  if (!parent) return null;
  const span = document.createElement('span');
  span.className = HIGHLIGHT_CLASS;
  span.setAttribute('data-annotation-id', annotationId);
  if (options.type) span.setAttribute('data-highlight-type', options.type);
  if (options.color) span.style.setProperty('background-color', options.color, 'important');

  const beforeLen = start;
  const afterLen = node.length - end;
  const beforeText = node.data.slice(0, beforeLen);
  const afterText = node.data.slice(end);

  if (beforeLen > 0) parent.insertBefore(document.createTextNode(beforeText), node);
  span.appendChild(document.createTextNode(midText));
  parent.insertBefore(span, node);
  if (afterLen > 0) parent.insertBefore(document.createTextNode(afterText), node);
  parent.removeChild(node);
  return span;
}

/**
 * Highlight the given range without breaking DOM structure.
 * - Text inside the range is wrapped in <span class="annotator-highlight">.
 * - Elements that are fully inside the range get the class and data-* set on them (no wrapper).
 * Returns true if at least one highlight was applied (span or element), false otherwise.
 */
export function highlightRange(
  range: Range,
  annotationId: string,
  options: HighlightOptions = {}
): boolean {
  if (range.collapsed) return false;
  const root = range.commonAncestorContainer;
  const walkRoot: Node =
    root.nodeType === Node.TEXT_NODE ? (root.parentNode ?? root) : root;
  const { textSegments } = collectHighlightRanges(range, walkRoot);

  if (textSegments.length === 0) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[Annotator] highlightRange: no text segments in range', range.toString().slice(0, 80));
    }
    return false;
  }

  let firstSpan: HTMLSpanElement | undefined;
  for (let i = textSegments.length - 1; i >= 0; i--) {
    const span = wrapTextSegment(textSegments[i]!, annotationId, options);
    if (span && firstSpan === undefined) firstSpan = span;
  }
  return firstSpan !== undefined;
}

export function getHighlightAnnotationId(span: Element): string | null {
  return span.getAttribute('data-annotation-id');
}

export function isHighlightElement(el: Element): boolean {
  return el.classList.contains(HIGHLIGHT_CLASS);
}

/**
 * Remove all annotator highlights from the given root (unwrap spans, remove class/style from elements).
 * Use before re-running load-and-draw so highlights are not duplicated.
 */
export function clearHighlights(root: Element): void {
  const list = root.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
  list.forEach((el) => {
    if (el.tagName === 'SPAN') {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
    } else {
      el.classList.remove(HIGHLIGHT_CLASS);
      el.removeAttribute('data-annotation-id');
      el.removeAttribute('data-highlight-type');
      (el as HTMLElement).style.removeProperty('background-color');
    }
  });
}
