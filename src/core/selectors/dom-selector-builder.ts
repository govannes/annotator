import type {
  RangeSelector,
  TextPositionSelector,
  TextQuoteSelector,
} from '../../types';
import type {
  Mapper,
  RangeSelectorBuilder,
  TextPositionSelectorBuilder,
  TextQuoteSelectorBuilder,
} from './types';

export class DomRangeSelectorBuilder implements RangeSelectorBuilder {
  build(domRange: Range, root: Node): RangeSelector {
    const startElement = getElementContaining(domRange.startContainer);
    const endElement = getElementContaining(domRange.endContainer);
    if (!startElement || !endElement) {
      throw new Error('Range start or end is not inside an element under root');
    }
    const rootEl = root.nodeType === Node.DOCUMENT_NODE
      ? (root as Document).body
      : (root as Element);
    if (!rootEl || !rootEl.contains(startElement) || !rootEl.contains(endElement)) {
      throw new Error('Range is not within the given root');
    }
    return {
      start: getXPathFromRoot(startElement, rootEl),
      end: getXPathFromRoot(endElement, rootEl),
      startOffset: getOffsetInElement(startElement, domRange.startContainer, domRange.startOffset),
      endOffset: getOffsetInElement(endElement, domRange.endContainer, domRange.endOffset),
    };
  }

  resolve(selector: RangeSelector, root: Node, expectedQuote?: string): Range | null {
    const rootEl = getRootElement(root);
    if (!rootEl) return null;

    const startEl = nodeFromXPath(rootEl, selector.start);
    const endEl = nodeFromXPath(rootEl, selector.end);
    if (!startEl || !endEl) return null;

    const startPos = offsetInElementToDomPosition(startEl, selector.startOffset);
    const endPos = offsetInElementToDomPosition(endEl, selector.endOffset);
    if (!startPos || !endPos) return null;

    const range = document.createRange();
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);

    if (expectedQuote != null && range.toString().trim() !== expectedQuote.trim()) {
      return null;
    }
    return range;
  }
}

export class DomTextPositionSelectorBuilder implements TextPositionSelectorBuilder {
  build(domRange: Range, mapper: Mapper): TextPositionSelector {
    const { start, end } = mapper.rangeToOffsets(domRange);
    return { start, end };
  }

  resolve(selector: TextPositionSelector, mapper: Mapper, _expectedQuote?: string): Range | null {
    return mapper.offsetsToRange(selector.start, selector.end);
  }
}

export class DomTextQuoteSelectorBuilder implements TextQuoteSelectorBuilder {
  build(
    documentText: string,
    start: number,
    end: number,
    prefixLen = 32,
    suffixLen = 32
  ): TextQuoteSelector {
    const exact = documentText.slice(start, end);
    const prefix = documentText.slice(Math.max(0, start - prefixLen), start);
    const suffix = documentText.slice(end, Math.min(documentText.length, end + suffixLen));
    return { exact, prefix, suffix };
  }
}

export function nodeFromXPath(root: Element, xpath: string): Element | null {
  const segments = xpath.split('/').filter(Boolean);
  let current: Element | null = root;
  for (const seg of segments) {
    if (!current) return null;
    const match = seg.match(/^([a-zA-Z][a-zA-Z0-9-]*)\[(\d+)\]$/);
    if (!match) return null;
    const tag = match[1].toLowerCase();
    const index = parseInt(match[2], 10);
    if (index < 1) return null;
    const sameTagSiblings: Element[] = Array.from(current.childNodes).filter(
      (n): n is Element => n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName.toLowerCase() === tag
    );
    const el: Element | undefined = sameTagSiblings[index - 1];
    current = el ?? null;
  }
  return current;
}

export function offsetInElementToDomPosition(
  element: Element,
  charOffset: number
): { node: Text; offset: number } | null {
  if (charOffset < 0) return null;
  let pos = 0;
  let result: { node: Text; offset: number } | null = null;
  walkTextUntil(element, (node, len) => {
    if (charOffset <= pos + len) {
      result = { node, offset: Math.min(charOffset - pos, len) };
      return true;
    }
    pos += len;
    return false;
  });
  return result;
}

function getRootElement(root: Node): Element | null {
  if (root.nodeType === Node.DOCUMENT_NODE) return (root as Document).body;
  if (root.nodeType === Node.ELEMENT_NODE) return root as Element;
  return null;
}

function getElementContaining(node: Node): Element | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentNode;
    return parent && parent.nodeType === Node.ELEMENT_NODE ? (parent as Element) : null;
  }
  if (node.nodeType === Node.ELEMENT_NODE) return node as Element;
  return null;
}

function getXPathFromRoot(element: Element, root: Element): string {
  const segments: string[] = [];
  let el: Element | null = element;
  while (el && el !== root) {
    const tag = el.tagName.toLowerCase();
    const sameTagSiblings = Array.from(el.parentNode?.childNodes ?? []).filter(
      (n) => n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName.toLowerCase() === tag
    );
    const index = sameTagSiblings.indexOf(el) + 1;
    segments.unshift(`${tag}[${index}]`);
    el = el.parentNode && el.parentNode.nodeType === Node.ELEMENT_NODE ? (el.parentNode as Element) : null;
  }
  return segments.join('/');
}

function getOffsetInElement(element: Element, container: Node, offset: number): number {
  let pos = 0;
  const found = walkTextUntil(element, (node, len) => {
    if (node === container) {
      pos += Math.min(offset, len);
      return true;
    }
    pos += len;
    return false;
  });
  return found ? pos : 0;
}

function walkTextUntil(element: Element, fn: (textNode: Text, length: number) => boolean): boolean {
  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node as Text).textContent?.length ?? 0;
      return fn(node as Text, len);
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      for (let i = 0; i < node.childNodes.length; i++) {
        if (walk(node.childNodes[i])) return true;
      }
    }
    return false;
  };
  for (let i = 0; i < element.childNodes.length; i++) {
    if (walk(element.childNodes[i])) return true;
  }
  return false;
}
