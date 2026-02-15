import type { Annotation, Selector, AnchorResult, AnchoringStrategy } from '../../types';
import { mapperOffsetsToRange, mapperRangeToOffsets, Segment } from '../dom-text-mapper';
import {
  buildFromRange,
  resolveFromRange,
  buildFromTextPosition,
  resolveFromTextPosition,
  buildFromTextQuote,
} from '../selectors/dom-selector-builder';

import {
  findAllExactMatches,
  pickBestMatch,
  anchorFromQuoteContext,
  anchorFromQuoteOnly,
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
      exact: quoteParts.exact ?? '',
      prefix: quoteParts.prefix ?? '',
      suffix: quoteParts.suffix ?? '',
    };
  }

  anchor(annotation: Annotation, root: Node, text: string, segments: Segment[]): AnchorResult {
    const selector = annotation.selector;
    if (!selector) {
      return { ok: false, error: 'Annotation has no selector' };
    }
    const expectedQuote = selector.exact?.trim() || undefined;

    // Strategy 1: Range selector (XPath + offsets)
    if (selector.start && selector.end) {
      let range = resolveFromRange(selector, root, expectedQuote);
      if (range && !range.collapsed) {
        if (expectedQuote && text) {
          range = this.disambiguateQuote(range, expectedQuote, text, segments, selector);
        }
        return { ok: true, range, strategy: 'range' as AnchoringStrategy };
      }
    }

    // Strategy 2: Text position selector (character offsets)
    if (selector.startOffset != null && selector.endOffset != null) {
      let range = resolveFromTextPosition(selector, segments, expectedQuote);
      if (range && !range.collapsed) {
        if (expectedQuote && text) {
          range = this.disambiguateQuote(range, expectedQuote, text, segments, selector);
        }
        return { ok: true, range, strategy: 'position' as AnchoringStrategy };
      }
    }

    // Strategy 3: Quote with context (prefix + exact + suffix)
    if (text && selector.exact) {
      const offsets = anchorFromQuoteContext(
        text,
        selector,
        selector.startOffset,
        true
      );
      if (offsets) {
        const range = mapperOffsetsToRange(offsets.start, offsets.end, segments);
        if (range && !range.collapsed) {
          return { ok: true, range, strategy: 'quote-context' as AnchoringStrategy };
        }
      }
    }

    // Strategy 4: Quote only (exact text search)
    if (text && selector.exact) {
      const offsets = anchorFromQuoteOnly(text, selector.exact, {
        positionHint: selector.startOffset,
        prefix: selector.prefix,
        suffix: selector.suffix,
      });
      if (offsets) {
        const range = mapperOffsetsToRange(offsets.start, offsets.end, segments);
        if (range && !range.collapsed) {
          return { ok: true, range, strategy: 'quote-only' as AnchoringStrategy };
        }
      }
    }

    return {
      ok: false,
      error: 'All four anchoring strategies failed (range, position, quote-context, quote-only)',
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
      positionHint: selector.startOffset,
      prefix: selector.prefix,
      suffix: selector.suffix,
    });
    if (!best || (best.start === rangeStart && best.end === rangeEnd)) return range;

    return mapperOffsetsToRange(best.start, best.end, segments) ?? range;
  }
}
