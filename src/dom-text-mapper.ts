/**
 * Phase A (START.md Steps 1–2): Document as string + DOM ↔ offset mapping.
 * Uses node-html-parser to parse the root's HTML and extract document text
 * in DOM order; real DOM is walked in parallel for the offset ↔ Range mapping.
 */

import { parse, NodeType } from 'node-html-parser';
import type { HTMLElement as ParsedHTMLElement, Node as ParsedNode } from 'node-html-parser';

/** Segment: character range [start, end) in document text and the corresponding DOM Text node. */
interface Segment {
  start: number;
  end: number;
  node: Text;
}

/**
 * Step 1: Extract full document text from root using node-html-parser.
 * Parses root's innerHTML and walks the parsed tree in document order,
 * concatenating visible text (same order as user selection).
 */
export function getDocumentText(root: Node): string {
  const html = serializeRoot(root);
  const parsed = parse(html);
  const parts: string[] = [];
  walkParsedText(parsed, (text) => parts.push(text));
  return parts.join('');
}

/**
 * Step 2: Build document text and bidirectional mapper (DOM ↔ character offsets).
 * - Parsed tree (node-html-parser) gives text and segment boundaries.
 * - Real DOM walk gives the corresponding Text nodes; we zip by document order.
 */
export function build(root: Node): DomTextMapperResult {
  const html = serializeRoot(root);
  const parsed = parse(html);

  // From parser: document text and segment offsets (no DOM refs)
  const segmentOffsets: { start: number; end: number }[] = [];
  const parts: string[] = [];
  let offset = 0;
  walkParsedText(parsed, (text) => {
    segmentOffsets.push({ start: offset, end: offset + text.length });
    parts.push(text);
    offset += text.length;
  });
  const text = parts.join('');

  // From real DOM: Text nodes in the same order
  const domTextNodes: Text[] = [];
  walkDomTextNodes(root, (node) => domTextNodes.push(node));

  // Zip: if counts match, we have (start, end, node) per segment
  const segments: Segment[] = [];
  let finalText = text;
  if (segmentOffsets.length === domTextNodes.length) {
    for (let i = 0; i < segmentOffsets.length; i++) {
      segments.push({
        ...segmentOffsets[i],
        node: domTextNodes[i],
      });
    }
  } else {
    // Parser and DOM structure diverged; build text and segments from DOM only
    let pos = 0;
    const parts: string[] = [];
    for (const node of domTextNodes) {
      const content = node.textContent ?? '';
      parts.push(content);
      segments.push({ start: pos, end: pos + content.length, node });
      pos += content.length;
    }
    finalText = parts.join('');
  }

  const mapper: Mapper = {
    rangeToOffsets(domRange: Range): { start: number; end: number } {
      const startPos = normalizeToTextPosition(domRange.startContainer, domRange.startOffset, 'start');
      const endPos = normalizeToTextPosition(domRange.endContainer, domRange.endOffset, 'end');
      if (!startPos || !endPos) return { start: 0, end: 0 };
      const start = positionToOffset(segments, startPos.node, startPos.offset, 'start');
      const end = positionToOffset(segments, endPos.node, endPos.offset, 'end');
      if (start == null || end == null) return { start: 0, end: 0 };
      return { start, end };
    },
    offsetsToRange(start: number, end: number): Range | null {
      const range = document.createRange();
      let startSet = false;
      let endSet = false;
      for (const seg of segments) {
        if (!startSet && start <= seg.end) {
          const offset = Math.max(0, Math.min(start - seg.start, seg.node.length));
          range.setStart(seg.node, offset);
          startSet = true;
        }
        if (!endSet && end <= seg.end) {
          const offset = Math.max(0, Math.min(end - seg.start, seg.node.length));
          range.setEnd(seg.node, offset);
          endSet = true;
          break;
        }
      }
      if (!startSet || !endSet) return null;
      return range;
    },
  };

  return { text: finalText, mapper };
}

export interface Mapper {
  rangeToOffsets(domRange: Range): { start: number; end: number };
  offsetsToRange(start: number, end: number): Range | null;
}

export interface DomTextMapperResult {
  text: string;
  mapper: Mapper;
}

// --- Helpers ---

function serializeRoot(root: Node): string {
  if (root.nodeType === Node.DOCUMENT_NODE) {
    return (root as Document).body?.innerHTML ?? '';
  }
  if (root.nodeType === Node.ELEMENT_NODE) {
    return (root as Element).innerHTML;
  }
  return '';
}

/** Depth-first walk of parsed tree; callback with text content of each text node (document order). */
function walkParsedText(parsed: ParsedNode, onText: (text: string) => void): void {
  const visit = (node: ParsedNode) => {
    if ((node as { nodeType?: number }).nodeType === NodeType.TEXT_NODE) {
      const content = (node as { textContent?: string; rawText?: string }).textContent
        ?? (node as { rawText?: string }).rawText
        ?? '';
      if (content) onText(content);
    } else if ((node as { nodeType?: number }).nodeType === NodeType.ELEMENT_NODE) {
      const el = node as ParsedHTMLElement;
      const tag = (el.rawTagName ?? '').toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'noscript') return;
      for (const child of el.childNodes ?? []) visit(child);
    }
  };
  const root = parsed as ParsedHTMLElement;
  for (const child of root.childNodes ?? []) visit(child);
}

/** Depth-first walk of real DOM; callback for each Text node in document order. */
function walkDomTextNodes(root: Node, onText: (node: Text) => void): void {
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      onText(node as Text);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'noscript') return;
      for (let i = 0; i < node.childNodes.length; i++) visit(node.childNodes[i]);
    }
  };
  for (let i = 0; i < root.childNodes.length; i++) visit(root.childNodes[i]);
}

function positionToOffset(
  segments: Segment[],
  container: Text,
  offset: number,
  _bound: 'start' | 'end'
): number | null {
  for (const seg of segments) {
    if (seg.node !== container) continue;
    return seg.start + Math.min(offset, seg.node.length);
  }
  return null;
}

/**
 * Normalize a (node, offset) position to (Text node, character offset).
 * When the range's container is an Element, offset is a child index; we convert to the
 * corresponding text position. For bound 'end', (element, 0) means "before first child"
 * so we use the previous node's last text position.
 */
function normalizeToTextPosition(
  node: Node,
  offset: number,
  bound: 'start' | 'end'
): { node: Text; offset: number } | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const textNode = node as Text;
    return { node: textNode, offset: Math.min(offset, textNode.length) };
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as Element;
  const children = el.childNodes;
  if (offset <= 0) {
    if (bound === 'end') {
      const prev = getLastTextNodeBefore(el);
      return prev ? { node: prev.node, offset: prev.offset } : null;
    }
    const first = getFirstTextNode(el);
    return first ? { node: first, offset: 0 } : null;
  }
  if (offset >= children.length) {
    const last = getLastTextNode(el);
    return last ? { node: last, offset: last.length } : null;
  }
  const child = children[offset];
  const first = child ? getFirstTextNode(child) : null;
  return first ? { node: first, offset: 0 } : null;
}

/** Last (text node, offset) that precedes element in document order (for range end at (element, 0)). */
function getLastTextNodeBefore(element: Element): { node: Text; offset: number } | null {
  let prev: Node | null = element.previousSibling;
  while (prev) {
    const last = getLastTextNode(prev);
    if (last) return { node: last, offset: last.length };
    prev = prev.previousSibling;
  }
  const parent = element.parentNode;
  if (parent && parent.nodeType === Node.ELEMENT_NODE) return getLastTextNodeBefore(parent as Element);
  return null;
}

function getFirstTextNode(node: Node): Text | null {
  if (node.nodeType === Node.TEXT_NODE) return node as Text;
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    if (el.tagName.toLowerCase() === 'script' || el.tagName.toLowerCase() === 'style' || el.tagName.toLowerCase() === 'noscript') return null;
    for (let i = 0; i < node.childNodes.length; i++) {
      const t = getFirstTextNode(node.childNodes[i]!);
      if (t) return t;
    }
  }
  return null;
}

function getLastTextNode(node: Node): Text | null {
  if (node.nodeType === Node.TEXT_NODE) return node as Text;
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    if (el.tagName.toLowerCase() === 'script' || el.tagName.toLowerCase() === 'style' || el.tagName.toLowerCase() === 'noscript') return null;
    for (let i = node.childNodes.length - 1; i >= 0; i--) {
      const t = getLastTextNode(node.childNodes[i]!);
      if (t) return t;
    }
  }
  return null;
}
