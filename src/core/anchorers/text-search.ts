import type { Selector } from '../../types';

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

  const scores: { idx: number; start: number; end: number; score: number; prefixMatch: boolean; suffixMatch: boolean }[] = [];

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
    scores.push({ idx: i, start: m.start, end: m.end, score, prefixMatch, suffixMatch });
  }

  let candidates = matches;
  if (haveContext) {
    const withContext = scores.filter((s) => s.prefixMatch && s.suffixMatch);
    if (withContext.length > 0) {
      candidates = withContext.map((s) => matches[s.idx]!);
    }
  }

  let best: { start: number; end: number } | null = null;
  let bestScore = -1;
  for (let i = 0; i < candidates.length; i++) {
    const m = candidates[i]!;
    const s = scores.find((x) => x.start === m.start && x.end === m.end) ?? scores[0]!;
    if (s.score > bestScore) {
      bestScore = s.score;
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

  return best;
}

/**
 * Find quote in document using prefix + exact + suffix context.
 * Falls back to whitespace-normalized matching when fuzzy is true.
 */
export function anchorFromQuoteContext(
  documentText: string,
  quote: Pick<Selector, 'exact' | 'prefix' | 'suffix'>,
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
 * Find exact quote in document text and return character offsets.
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

  const matches = findAllExactMatches(documentText, trimmed);

  if (matches.length === 0) {
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

function findAllNeedleMatches(documentText: string, needle: string): { start: number; end: number }[] {
  const matches: { start: number; end: number }[] = [];
  let idx = documentText.indexOf(needle, 0);
  while (idx >= 0) {
    matches.push({ start: idx, end: idx + needle.length });
    idx = documentText.indexOf(needle, idx + 1);
  }
  return matches;
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
