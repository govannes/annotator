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
import type { Annotation, RangeSelector, TextPositionSelector, TextQuoteSelector } from '../types';

function getRootElement(root: Node): Element | null {
  if (root.nodeType === Node.DOCUMENT_NODE) return (root as Document).body;
  if (root.nodeType === Node.ELEMENT_NODE) return root as Element;
  return null;
}

/**
 * Step 7 – Strategy 1: Re-attach from RangeSelector.
 * Resolves XPath start/end to DOM elements, builds a Range from stored character offsets.
 * If expectedQuote is provided, returns null when the range's text doesn't match.
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
 * Find all occurrences of needle in documentText.
 */
function findAllNeedleMatches(documentText: string, needle: string): { start: number; end: number }[] {
  const matches: { start: number; end: number }[] = [];
  let idx = documentText.indexOf(needle, 0);
  while (idx >= 0) {
    matches.push({ start: idx, end: idx + needle.length });
    idx = documentText.indexOf(needle, idx + 1);
  }
  return matches;
}

/**
 * Step 9 – Find quote in document using prefix + exact + suffix context.
 * When the same context appears multiple times, uses hintStart (position) to pick the closest match.
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

  const matches = findAllNeedleMatches(documentText, needle);
  if (matches.length === 0 && fuzzy) {
    const normDoc = normalizeWhitespace(documentText);
    const normNeedle = normalizeWhitespace(needle);
    const normPrefix = normalizeWhitespace(prefix);
    const normExact = normalizeWhitespace(exact);
    const nIdx = normDoc.indexOf(normNeedle);
    if (nIdx < 0) return null;
    const normStart = nIdx + normPrefix.length;
    const normEnd = normStart + normExact.length;
    return normalizedToOriginalOffsets(documentText, normStart, normEnd);
  }

  if (matches.length === 0) return null;
  if (matches.length === 1) {
    const m = matches[0]!;
    return { start: m.start + prefix.length, end: m.start + prefix.length + exact.length };
  }

  const best = pickBestMatch(matches, documentText, { positionHint: hintStart });
  if (!best) return null;
  return {
    start: best.start + prefix.length,
    end: best.start + prefix.length + exact.length,
  };
}

/**
 * Find all occurrences of exact text in documentText (exact match only).
 * Used to disambiguate when the same quote appears multiple times (e.g. "se" in "serverless" vs "seamless").
 */
export function findAllExactMatches(
  documentText: string,
  exact: string
): { start: number; end: number }[] {
  const trimmed = exact.trim();
  if (!trimmed) return [];

  const matches: { start: number; end: number }[] = [];
  let idx = documentText.indexOf(trimmed, 0);
  while (idx >= 0) {
    matches.push({ start: idx, end: idx + trimmed.length });
    idx = documentText.indexOf(trimmed, idx + 1);
  }
  return matches;
}

export interface PickBestMatchOptions {
  positionHint?: number;
  prefix?: string;
  suffix?: string;
}

/**
 * From multiple quote matches, pick the one that best matches position hint and/or prefix/suffix.
 * If only one match, returns it. Otherwise prefers: (1) prefix/suffix match, (2) closest to positionHint.
 */
export function pickBestMatch(
  matches: { start: number; end: number }[],
  documentText: string,
  options: PickBestMatchOptions = {}
): { start: number; end: number } | null {
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0]!;

  const { positionHint, prefix = '', suffix = '' } = options;
  const trim = (s: string) => s.trim();

  // Score each match: higher = better. Prefer prefix/suffix match, then closest to positionHint.
  let best: { start: number; end: number } | null = null;
  let bestScore = -1;

  for (const m of matches) {
    const before = documentText.slice(Math.max(0, m.start - prefix.length), m.start);
    const after = documentText.slice(m.end, Math.min(documentText.length, m.end + suffix.length));
    const prefixMatch = prefix.length === 0 || trim(before).endsWith(trim(prefix)) || before === prefix;
    const suffixMatch = suffix.length === 0 || trim(after).startsWith(trim(suffix)) || after.startsWith(suffix);
    let score = 0;
    if (prefixMatch) score += 10;
    if (suffixMatch) score += 10;
    if (positionHint != null) {
      const mid = (m.start + m.end) / 2;
      const distance = Math.abs(mid - positionHint);
      score += Math.max(0, 100 - distance);
    }
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }

  return best;
}

/**
 * Step 10 – Find exact quote in document text and return character offsets.
 * When the quote appears multiple times, uses position hint and prefix/suffix to pick the right one.
 */
export function anchorFromQuoteOnly(
  documentText: string,
  exact: string,
  options: {
    startFromOffset?: number;
    positionHint?: number;
    prefix?: string;
    suffix?: string;
  } = {}
): { start: number; end: number } | null {
  const trimmed = exact.trim();
  if (!trimmed) return null;

  const { startFromOffset = 0, positionHint, prefix, suffix } = options;

  const matches = findAllExactMatches(documentText, trimmed);
  if (matches.length === 0) {
    // Fallback: whitespace-normalized search (single match)
    const normalizedDoc = normalizeWhitespace(documentText);
    const normalizedQuote = normalizeWhitespace(trimmed);
    const nIdx = normalizedDoc.indexOf(normalizedQuote);
    if (nIdx < 0) return null;
    return normalizedToOriginalOffsets(documentText, nIdx, nIdx + normalizedQuote.length);
  }

  if (matches.length === 1) return matches[0]!;

  const best = pickBestMatch(matches, documentText, { positionHint, prefix, suffix });
  if (best) return best;

  if (positionHint == null && !prefix && !suffix && startFromOffset !== undefined) {
    const idx = documentText.indexOf(trimmed, startFromOffset);
    if (idx >= 0) return { start: idx, end: idx + trimmed.length };
  }
  return matches[0] ?? null;
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
    const quote = selector.textQuote;
    const offsets = anchorFromQuoteOnly(documentText, quote.exact, {
      positionHint: selector.textPosition?.start,
      prefix: quote.prefix,
      suffix: quote.suffix,
    });
    if (offsets) {
      const r = mapper.offsetsToRange(offsets.start, offsets.end);
      if (r) return r;
    }
  }
  return null;
}
