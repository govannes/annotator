import type { AnchorResult, Annotation, Selector } from '../../types';
import { mapperOffsetsToRange, mapperRangeToOffsets, Segment } from '../dom-text-mapper';
import {
    buildFromRange,
    buildFromTextPosition,
    buildFromTextQuote,
    resolveFromRange,
    resolveFromTextPosition,
} from '../selectors/dom-selector-builder';

import {
    anchorFromQuoteContext,
    anchorFromQuoteOnly,
    findAllExactMatches,
    pickBestMatch,
} from './text-search';


export class DomAnchorer  {

  buildSelectors(
    range: Range,
    root: Node,
    segments: Segment[],
    documentText: string,
  ): Selector {
    const rootEl = root.nodeType === Node.DOCUMENT_NODE ? (root as Document).body : (root as Element);
    if (!rootEl) throw new Error('DomAnchorer.buildSelectors: invalid root');

    const rangeParts = buildFromRange(range, rootEl);
    const positionParts = buildFromTextPosition(range, segments);
    const quoteParts = buildFromTextQuote(
      documentText,
      positionParts.startOffset!,
      positionParts.endOffset!,
    );

    return {
      start: rangeParts.start ?? '',
      end: rangeParts.end ?? '',
      startOffset: rangeParts.startOffset ?? 0,
      endOffset: rangeParts.endOffset ?? 0,
      docStartOffset: positionParts.startOffset,
      docEndOffset: positionParts.endOffset,
      exact: quoteParts.exact ?? '',
      prefix: quoteParts.prefix ?? '',
      suffix: quoteParts.suffix ?? '',
    };
  }

  /**
   * Try to resolve an annotation back to a live DOM Range.
   *
   * Strategy order is quote-first (robust to reordering / infinite scroll)
   * then structural (fast when DOM hasn't changed):
   *
   *   1. quote-context  — exact text + prefix/suffix context search
   *   2. quote-only     — exact text search, disambiguated by hints
   *   3. range (XPath)  — structural path + element-level offsets
   *   4. position       — document-level character offsets
   */
  anchor(annotation: Annotation, root: Node, text: string, segments: Segment[]): AnchorResult {
    const TAG = '[Highlighter][Anchorer]';
    const selector = annotation.selector;
    const annId = annotation.id?.slice(0, 8) ?? '?';

    if (!selector) {
      return { ok: false, error: 'Annotation has no selector' };
    }
    const expectedQuote = selector.exact?.trim() || undefined;
    const docHint = selector.docStartOffset ?? selector.startOffset;

    console.group(`${TAG} Anchoring ${annId}…`);
    console.log(`${TAG}   DB exact : "${selector.exact?.slice(0, 80)}${(selector.exact?.length ?? 0) > 80 ? '…' : ''}"`);
    console.log(`${TAG}   DB prefix: "${selector.prefix}"`);
    console.log(`${TAG}   DB suffix: "${selector.suffix}"`);
    console.log(`${TAG}   DB xpath : start="${selector.start}" end="${selector.end}" elOff=[${selector.startOffset}, ${selector.endOffset}]`);
    console.log(`${TAG}   DB docOff: [${selector.docStartOffset ?? 'n/a'}, ${selector.docEndOffset ?? 'n/a'}]`);
    console.log(`${TAG}   Doc text length: ${text?.length ?? 0}, segments: ${segments?.length ?? 0}`);

    // ── Strategy 1: Quote with context (prefix + exact + suffix) ────────
    if (text && selector.exact) {
      const offsets = anchorFromQuoteContext(text, selector, docHint, true);
      if (offsets) {
        const range = mapperOffsetsToRange(offsets.start, offsets.end, segments);
        if (range && !range.collapsed) {
          const resolved = range.toString();
          console.log(`${TAG}   [S1 quote-context] ✓ "${resolved.slice(0, 80)}${resolved.length > 80 ? '…' : ''}" at [${offsets.start}, ${offsets.end}]`);
          console.groupEnd();
          return { ok: true, range, strategy: 'quote-context' };
        }
        console.log(`${TAG}   [S1 quote-context] offsets [${offsets.start}, ${offsets.end}] → range failed`);
      } else {
        console.log(`${TAG}   [S1 quote-context] no match`);
      }
    } else {
      console.log(`${TAG}   [S1 quote-context] skipped (no text or exact)`);
    }

    // ── Strategy 2: Quote only (exact text search) ──────────────────────
    if (text && selector.exact) {
      const offsets = anchorFromQuoteOnly(text, selector.exact, {
        positionHint: docHint,
        prefix: selector.prefix,
        suffix: selector.suffix,
      });
      if (offsets) {
        const range = mapperOffsetsToRange(offsets.start, offsets.end, segments);
        if (range && !range.collapsed) {
          const resolved = range.toString();
          console.log(`${TAG}   [S2 quote-only] ✓ "${resolved.slice(0, 80)}${resolved.length > 80 ? '…' : ''}" at [${offsets.start}, ${offsets.end}]`);
          console.groupEnd();
          return { ok: true, range, strategy: 'quote-only' };
        }
        console.log(`${TAG}   [S2 quote-only] offsets [${offsets.start}, ${offsets.end}] → range failed`);
      } else {
        console.log(`${TAG}   [S2 quote-only] no match in doc text`);
      }
    } else {
      console.log(`${TAG}   [S2 quote-only] skipped`);
    }

    // ── Strategy 3: Range selector (XPath + element-level offsets) ──────
    if (selector.start && selector.end) {
      let range = resolveFromRange(selector, root, expectedQuote);
      if (range && !range.collapsed) {
        const resolved = range.toString();
        console.log(`${TAG}   [S3 range/XPath] ✓ "${resolved.slice(0, 80)}${resolved.length > 80 ? '…' : ''}" (len=${resolved.length})`);
        if (expectedQuote && resolved.trim() !== expectedQuote) {
          console.warn(`${TAG}   [S3 range/XPath] MISMATCH vs DB exact!`);
        }
        if (expectedQuote && text) {
          range = this.disambiguateQuote(range, expectedQuote, text, segments, selector);
        }
        console.groupEnd();
        return { ok: true, range, strategy: 'range' };
      }
      console.log(`${TAG}   [S3 range/XPath] failed (${range ? 'collapsed' : 'null'})`);
    } else {
      console.log(`${TAG}   [S3 range/XPath] skipped (no xpath)`);
    }

    // ── Strategy 4: Document-level position offsets ─────────────────────
    const dStart = selector.docStartOffset;
    const dEnd = selector.docEndOffset;
    if (dStart != null && dEnd != null) {
      const posSelector = { ...selector, startOffset: dStart, endOffset: dEnd };
      let range = resolveFromTextPosition(posSelector, segments, expectedQuote);
      if (range && !range.collapsed) {
        const resolved = range.toString();
        console.log(`${TAG}   [S4 position] ✓ "${resolved.slice(0, 80)}${resolved.length > 80 ? '…' : ''}" at docOff=[${dStart}, ${dEnd}]`);
        if (expectedQuote && text) {
          range = this.disambiguateQuote(range, expectedQuote, text, segments, selector);
        }
        console.groupEnd();
        return { ok: true, range, strategy: 'position' };
      }
      console.log(`${TAG}   [S4 position] failed (${range ? 'collapsed' : 'null'}) docOff=[${dStart}, ${dEnd}]`);
    } else {
      console.log(`${TAG}   [S4 position] skipped (no docStartOffset/docEndOffset)`);
    }

    console.warn(`${TAG}   ALL STRATEGIES FAILED for ${annId}`);
    console.groupEnd();
    return {
      ok: false,
      error: 'All four anchoring strategies failed (quote-context, quote-only, range, position)',
    };
  }

  private disambiguateQuote(
    range: Range,
    expectedQuote: string,
    text: string,
    segments: Segment[],
    selector: Selector
  ): Range {
    const matches = findAllExactMatches(text, expectedQuote);
    if (matches.length <= 1) return range;

    let rangeStart: number;
    let rangeEnd: number;
    try {
      const off = mapperRangeToOffsets(range, segments);
      rangeStart = off.start;
      rangeEnd = off.end;
    } catch {
      return range;
    }

    const best = pickBestMatch(matches, text, {
      positionHint: selector.docStartOffset ?? selector.startOffset,
      prefix: selector.prefix,
      suffix: selector.suffix,
    });
    if (!best || (best.start === rangeStart && best.end === rangeEnd)) return range;

    return mapperOffsetsToRange(best.start, best.end, segments) ?? range;
  }
}
