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

const ANCHOR_LOG = '[Anchoring]';

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
  console.log(ANCHOR_LOG, 'Strategy 1 (Range): start', { xpath: selector.start, startOffset: selector.startOffset, endOffset: selector.endOffset, expectedQuote });
  const rootEl = getRootElement(root);
  if (!rootEl) {
    console.log(ANCHOR_LOG, 'Strategy 1 (Range): no root element');
    return null;
  }

  const startEl = nodeFromXPath(rootEl, selector.start);
  const endEl = nodeFromXPath(rootEl, selector.end);
  if (!startEl || !endEl) {
    console.log(ANCHOR_LOG, 'Strategy 1 (Range): XPath resolved to null', { startEl: !!startEl, endEl: !!endEl });
    return null;
  }

  const startPos = offsetInElementToDomPosition(startEl, selector.startOffset);
  const endPos = offsetInElementToDomPosition(endEl, selector.endOffset);
  if (!startPos || !endPos) {
    console.log(ANCHOR_LOG, 'Strategy 1 (Range): offsetToDomPosition failed', { startPos: !!startPos, endPos: !!endPos });
    return null;
  }

  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);

  const rangeText = range.toString().trim();
  if (expectedQuote != null && rangeText !== expectedQuote.trim()) {
    console.log(ANCHOR_LOG, 'Strategy 1 (Range): quote mismatch', { rangeText: JSON.stringify(rangeText), expectedQuote: JSON.stringify(expectedQuote) });
    return null;
  }
  console.log(ANCHOR_LOG, 'Strategy 1 (Range): OK', { rangeText: JSON.stringify(rangeText) });
  return range;
}

export function anchorFromTextPositionSelector(
  selector: TextPositionSelector,
  mapper: Mapper,
  _expectedQuote?: string
): Range | null {
  console.log(ANCHOR_LOG, 'Strategy 2 (Position):', { start: selector.start, end: selector.end });
  const range = mapper.offsetsToRange(selector.start, selector.end);
  if (range) {
    console.log(ANCHOR_LOG, 'Strategy 2 (Position): OK', { rangeText: JSON.stringify(range.toString().trim()) });
  } else {
    console.log(ANCHOR_LOG, 'Strategy 2 (Position): offsetsToRange returned null');
  }
  return range;
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
  console.log(ANCHOR_LOG, 'Strategy 3 (Quote-context): needle length', needle.length, 'matches', matches.length, 'hintStart', hintStart);
  if (matches.length > 0) {
    const slice = (m: { start: number; end: number }) => documentText.slice(Math.max(0, m.start - 20), m.end + 20);
    console.log(ANCHOR_LOG, 'Strategy 3 (Quote-context): match contexts', matches.map((m, i) => `[${i}] ${JSON.stringify(slice(m))}`));
  }

  if (matches.length === 0 && fuzzy) {
    const normDoc = normalizeWhitespace(documentText);
    const normNeedle = normalizeWhitespace(needle);
    const normPrefix = normalizeWhitespace(prefix);
    const normExact = normalizeWhitespace(exact);
    const nIdx = normDoc.indexOf(normNeedle);
    if (nIdx < 0) {
      console.log(ANCHOR_LOG, 'Strategy 3 (Quote-context): no matches, fuzzy failed');
      return null;
    }
    const normStart = nIdx + normPrefix.length;
    const normEnd = normStart + normExact.length;
    const out = normalizedToOriginalOffsets(documentText, normStart, normEnd);
    console.log(ANCHOR_LOG, 'Strategy 3 (Quote-context): fuzzy single match', out);
    return out;
  }

  if (matches.length === 0) return null;
  if (matches.length === 1) {
    const m = matches[0]!;
    const out = { start: m.start + prefix.length, end: m.start + prefix.length + exact.length };
    console.log(ANCHOR_LOG, 'Strategy 3 (Quote-context): single match', out);
    return out;
  }

  const best = pickBestMatch(matches, documentText, { positionHint: hintStart });
  if (!best) return null;
  const out = {
    start: best.start + prefix.length,
    end: best.start + prefix.length + exact.length,
  };
  console.log(ANCHOR_LOG, 'Strategy 3 (Quote-context): multi-match picked', out, 'positionHint', hintStart);
  return out;
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
 * When prefix/suffix are provided, we prefer (and can require) matches that have the right context.
 * If only one match, returns it. Otherwise: filter by prefix/suffix when provided, then prefer closest to positionHint.
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
  const haveContext = prefix.length > 0 || suffix.length > 0;

  const scores: { idx: number; start: number; end: number; score: number; prefixMatch: boolean; suffixMatch: boolean; before: string; after: string; context: string }[] = [];

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
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
    scores.push({
      idx: i,
      start: m.start,
      end: m.end,
      score,
      prefixMatch,
      suffixMatch,
      before: JSON.stringify(before.slice(-25)),
      after: JSON.stringify(after.slice(0, 25)),
      context: documentText.slice(Math.max(0, m.start - 15), m.end + 15),
    });
  }

  let candidates = matches;
  if (haveContext) {
    const withContext = scores.filter((s) => s.prefixMatch && s.suffixMatch);
    if (withContext.length > 0) {
      candidates = withContext.map((s) => matches[s.idx]!);
      console.log(ANCHOR_LOG, 'pickBestMatch: filtered to matches that match prefix+suffix', withContext.length, 'of', matches.length);
    } else {
      console.log(ANCHOR_LOG, 'pickBestMatch: no match has both prefix+suffix; using all matches and positionHint', scores.map((s) => ({ start: s.start, prefixMatch: s.prefixMatch, suffixMatch: s.suffixMatch, after: s.after })));
    }
  }

  let best: { start: number; end: number } | null = null;
  let bestScore = -1;
  for (let i = 0; i < candidates.length; i++) {
    const m = candidates[i]!;
    const s = scores.find((x) => x.start === m.start && x.end === m.end) ?? scores[0]!;
    const score = s.score;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  if (bestScore <= 0 && candidates.length > 0 && positionHint != null) {
    best = candidates.reduce((a, b) => {
      const da = Math.abs((a.start + a.end) / 2 - positionHint);
      const db = Math.abs((b.start + b.end) / 2 - positionHint);
      return da <= db ? a : b;
    });
  }
  if (!best && matches.length > 0) best = matches[0]!;

  console.log(ANCHOR_LOG, 'pickBestMatch:', { positionHint, prefixLen: prefix.length, suffixLen: suffix.length, scores, picked: best });
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
  let trimmed = exact.trim();
  if (/^"[^"]*"$/.test(trimmed)) trimmed = trimmed.slice(1, -1).trim();
  if (!trimmed) return null;

  const { startFromOffset = 0, positionHint, prefix, suffix } = options;

  if (positionHint != null) {
    const atHint = documentText.slice(Math.max(0, positionHint - 20), positionHint + 25);
    console.log(ANCHOR_LOG, 'Strategy 4 (Quote-only): doc length', documentText.length, 'at positionHint', positionHint, 'context', JSON.stringify(atHint));
  }
  console.log(ANCHOR_LOG, 'Strategy 4 (Quote-only):', { exact: JSON.stringify(trimmed), positionHint, prefix: prefix?.slice(0, 20), suffix: suffix?.slice(0, 20) });

  const matches = findAllExactMatches(documentText, trimmed);
  console.log(ANCHOR_LOG, 'Strategy 4 (Quote-only): exact matches', matches.length, matches.map((m, i) => `[${i}] @${m.start} ${documentText.slice(Math.max(0, m.start - 12), m.end + 12)}`));

  if (matches.length === 0) {
    const normalizedDoc = normalizeWhitespace(documentText);
    const normalizedQuote = normalizeWhitespace(trimmed);
    const nIdx = normalizedDoc.indexOf(normalizedQuote);
    if (nIdx < 0) {
      console.log(ANCHOR_LOG, 'Strategy 4 (Quote-only): no matches, fuzzy failed');
      return null;
    }
    const out = normalizedToOriginalOffsets(documentText, nIdx, nIdx + normalizedQuote.length);
    console.log(ANCHOR_LOG, 'Strategy 4 (Quote-only): fuzzy single', out);
    return out;
  }

  if (matches.length === 1) {
    console.log(ANCHOR_LOG, 'Strategy 4 (Quote-only): single match', matches[0]);
    return matches[0]!;
  }

  const best = pickBestMatch(matches, documentText, { positionHint, prefix, suffix });
  if (best) {
    console.log(ANCHOR_LOG, 'Strategy 4 (Quote-only): multi-match picked', best);
    return best;
  }

  if (positionHint == null && !prefix && !suffix && startFromOffset !== undefined) {
    const idx = documentText.indexOf(trimmed, startFromOffset);
    if (idx >= 0) return { start: idx, end: idx + trimmed.length };
  }
  const fallback = matches[0] ?? null;
  console.log(ANCHOR_LOG, 'Strategy 4 (Quote-only): fallback to first match', fallback);
  return fallback;
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
