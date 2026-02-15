const HIGHLIGHT_CLASS = 'annotator-highlight';
const HIGHLIGHT_TYPE = 'highlight';
const HIGHLIGHT_COLOR = 'rgba(255, 220, 0, 0.35)';

export function highlightRange(
  range: Range,
  annotationId: string
): boolean {
  if (range.collapsed) return false;
  const root = range.commonAncestorContainer;
  const walkRoot: Node =
    root.nodeType === Node.TEXT_NODE ? (root.parentNode ?? root) : root;
  const { textSegments } = collectHighlightRanges(range, walkRoot);

  if (textSegments.length === 0) return false;

  let firstSpan: HTMLSpanElement | undefined;
  for (let i = textSegments.length - 1; i >= 0; i--) {
    const span = wrapTextSegment(textSegments[i]!, annotationId);
    if (span && firstSpan === undefined) firstSpan = span;
  }
  return firstSpan !== undefined;
}

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

interface TextSegment {
  node: Text;
  start: number;
  end: number;
}

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

function rangeFullyContainsElement(range: Range, element: Element): boolean {
  const elRange = document.createRange();
  elRange.selectNodeContents(element);
  return (
    range.compareBoundaryPoints(Range.START_TO_START, elRange) <= 0 &&
    range.compareBoundaryPoints(Range.END_TO_END, elRange) >= 0
  );
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
): HTMLSpanElement | null {
  const { node, start, end } = segment;
  const midText = node.data.slice(start, end);
  if (midText.trim().length === 0) return null;
  const parent = node.parentNode;
  if (!parent) return null;
  const span = document.createElement('span');
  span.className = HIGHLIGHT_CLASS;
  span.setAttribute('data-annotation-id', annotationId);
  span.setAttribute('data-highlight-type', HIGHLIGHT_TYPE);
  span.style.setProperty('background-color', HIGHLIGHT_COLOR, 'important');

  const beforeText = node.data.slice(0, start);
  const afterText = node.data.slice(end);

  if (start > 0) parent.insertBefore(document.createTextNode(beforeText), node);
  span.appendChild(document.createTextNode(midText));
  parent.insertBefore(span, node);
  if (node.length - end > 0) parent.insertBefore(document.createTextNode(afterText), node);
  parent.removeChild(node);
  return span;
}
