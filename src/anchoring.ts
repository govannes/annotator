/**
 * Phase C (START.md Steps 7–11): Re-attach annotations to DOM using four strategies.
 *
 * Step 7:  anchorFromRangeSelector(selector, root, expectedQuote?) → Range | null
 * Step 8:  anchorFromTextPositionSelector(selector, mapper, expectedQuote?) → Range | null
 * Step 9:  anchorFromQuoteContext(documentText, quote, hintStart?, fuzzy?) → { start, end } | null
 * TODO Step 10: anchorFromQuoteOnly(documentText, exact) → { start, end } | null
 * TODO Step 11: anchorAnnotation(annotation, root, mapper) → Range | null
 */

import type { Mapper } from './dom-text-mapper';
import { nodeFromXPath, offsetInElementToDomPosition } from './selectors';
import type { Annotation, RangeSelector, TextPositionSelector, TextQuoteSelector } from './types';

function getRootElement(root: Node): Element | null {
  if (root.nodeType === Node.DOCUMENT_NODE) return (root as Document).body;
  if (root.nodeType === Node.ELEMENT_NODE) return root as Element;
  return null;
}

/**
 * Step 7 – Strategy 1: Re-attach from RangeSelector.
 * Resolves XPath start/end to DOM elements, builds a Range from stored character offsets.
 * If expectedQuote is provided, returns null when the range’s text doesn’t match.
 */
export function anchorFromRangeSelector(
  selector: RangeSelector,
  root: Node,
  expectedQuote?: string
): Range | null {
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

export function anchorFromTextPositionSelector(
  selector: TextPositionSelector,
  mapper: Mapper,
  _expectedQuote?: string
): Range | null {
  return mapper.offsetsToRange(selector.start, selector.end);
}

/**
 * Step 9 – Find quote in document using prefix + exact + suffix context.
 * Tries exact match of prefix+exact+suffix first; if hintStart is given, searches near that offset.
 * If fuzzy, falls back to whitespace-normalized matching and maps offsets back to original.
 */
export function anchorFromQuoteContext(
  documentText: string,
  quote: TextQuoteSelector,
  hintStart?: number,
  fuzzy?: boolean
): { start: number; end: number } | null {
  const exact = quote.exact?.trim();
  if (!exact) return null;

  const prefix = (quote.prefix ?? '').trim();
  const suffix = (quote.suffix ?? '').trim();
  const needle = prefix + exact + suffix;

  const searchStart = hintStart != null
    ? Math.max(0, hintStart - Math.max(prefix.length, 200))
    : 0;

  let idx = documentText.indexOf(needle, searchStart);
  if (idx < 0 && searchStart > 0) idx = documentText.indexOf(needle, 0);
  if (idx >= 0) {
    return {
      start: idx + prefix.length,
      end: idx + prefix.length + exact.length,
    };
  }

  if (!fuzzy) return null;

  const normDoc = normalizeWhitespace(documentText);
  const normNeedle = normalizeWhitespace(needle);
  const normPrefix = normalizeWhitespace(prefix);
  const normExact = normalizeWhitespace(exact);
  const nIdx = normDoc.indexOf(normNeedle);
  if (nIdx < 0) return null;

  const normStart = nIdx + normPrefix.length;
  const normEnd = normStart + normExact.length;
  const { start, end } = normalizedToOriginalOffsets(documentText, normStart, normEnd);
  return { start, end };
}

/**
 * Step 10 – Find exact quote in document text and return character offsets.
 * Used when Range and TextPosition fail (e.g. DOM or layout changed on reload).
 * @param startFromOffset – start searching from this character offset (for finding next occurrence).
 */
export function anchorFromQuoteOnly(
  documentText: string,
  exact: string,
  startFromOffset = 0
): { start: number; end: number } | null {
  const trimmed = exact.trim();
  if (!trimmed) return null;

  const idx = documentText.indexOf(trimmed, startFromOffset);
  if (idx >= 0) return { start: idx, end: idx + trimmed.length };

  const normalizedDoc = normalizeWhitespace(documentText);
  const normalizedQuote = normalizeWhitespace(trimmed);
  const nIdx = normalizedDoc.indexOf(normalizedQuote);
  if (nIdx < 0) return null;

  const { start, end } = normalizedToOriginalOffsets(documentText, nIdx, nIdx + normalizedQuote.length);
  return { start, end };
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Map normalized string indices back to original (for whitespace-collapsed search). */
function normalizedToOriginalOffsets(
  original: string,
  normStart: number,
  normEnd: number
): { start: number; end: number } {
  const spans: { start: number; end: number }[] = [];
  let o = 0;
  while (o < original.length && /\s/.test(original[o] ?? '')) o++;
  let runStart = -1;
  for (; o < original.length; o++) {
    const isSpace = /\s/.test(original[o] ?? '');
    if (isSpace) {
      if (runStart < 0) runStart = o;
    } else {
      if (runStart >= 0) {
        spans.push({ start: runStart, end: o });
        runStart = -1;
      }
      spans.push({ start: o, end: o + 1 });
    }
  }
  if (runStart >= 0) spans.push({ start: runStart, end: original.length });
  if (normStart >= spans.length) return { start: 0, end: 0 };
  const startOriginal = spans[normStart]!.start;
  const endIdx = Math.min(normEnd, spans.length);
  const endOriginal = endIdx > normStart ? spans[endIdx - 1]!.end : startOriginal;
  return { start: startOriginal, end: endOriginal };
}

/**
 * Step 11 – Re-attach orchestrator.
 * Tries strategies in order: Range → TextPosition (quote context/quote-only when implemented).
 * Returns the first non-null Range, or null if none succeed.
 */
export function anchorAnnotation(
  annotation: Annotation,
  root: Node,
  mapper: Mapper,
  documentText?: string
): Range | null {
  const { selector } = annotation.target;
  const expectedQuote = selector.textQuote?.exact;

  if (selector.range) {
    const r = anchorFromRangeSelector(selector.range, root, expectedQuote);
    if (r) return r;
  }
  if (selector.textPosition) {
    const r = anchorFromTextPositionSelector(selector.textPosition, mapper, expectedQuote);
    if (r) return r;
  }
  if (documentText && selector.textQuote) {
    const offsets = anchorFromQuoteContext(
      documentText,
      selector.textQuote,
      selector.textPosition?.start,
      true
    );
    if (offsets) {
      const r = mapper.offsetsToRange(offsets.start, offsets.end);
      if (r) return r;
    }
  }
  if (documentText && selector.textQuote?.exact) {
    const offsets = anchorFromQuoteOnly(documentText, selector.textQuote.exact);
    if (offsets) {
      const r = mapper.offsetsToRange(offsets.start, offsets.end);
      if (r) return r;
    }
  }
  return null;
}
