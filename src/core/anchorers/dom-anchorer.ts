/**
 * DOM Anchorer: four-strategy Hypothesis-style fuzzy anchoring.
 *
 * Strategies (tried in order):
 * 1. RangeSelector  — XPath + offsets (exact DOM match)
 * 2. TextPosition   — global char offsets (structure changed, text same)
 * 3. Quote+context  — prefix + exact + suffix fuzzy search
 * 4. Quote-only     — exact text search, disambiguated by position/context
 *
 * @see https://web.hypothes.is/blog/fuzzy-anchoring/
 */

import type { Annotation, AnnotationTarget, AnchorResult, AnchoringStrategy } from '../../types';
import type { Mapper } from '../selectors';
import {
  DomRangeSelectorBuilder,
  DomTextPositionSelectorBuilder,
  DomTextQuoteSelectorBuilder,
} from '../selectors';
import type { AnchorerInterface, AnchorContext, BuildSelectorsOptions } from './types';
import {
  findAllExactMatches,
  pickBestMatch,
  anchorFromQuoteContext,
  anchorFromQuoteOnly,
} from './text-search';

/** Length of prefix/suffix context for TextQuoteSelector (Hypothesis uses 32). */
export const TEXT_QUOTE_CONTEXT_LENGTH = 32;

// ---------------------------------------------------------------------------
// DomAnchorer
// ---------------------------------------------------------------------------

export class DomAnchorer implements AnchorerInterface {
  private readonly rangeBuilder = new DomRangeSelectorBuilder();
  private readonly positionBuilder = new DomTextPositionSelectorBuilder();
  private readonly quoteBuilder = new DomTextQuoteSelectorBuilder();

  buildSelectors(
    range: Range,
    root: Node,
    mapper: Mapper,
    documentText: string,
    options: BuildSelectorsOptions = {}
  ): AnnotationTarget['selector'] {
    const { prefixLen = TEXT_QUOTE_CONTEXT_LENGTH, suffixLen = TEXT_QUOTE_CONTEXT_LENGTH } = options;
    const rootEl = root.nodeType === Node.DOCUMENT_NODE ? (root as Document).body : (root as Element);
    if (!rootEl) throw new Error('DomAnchorer.buildSelectors: invalid root');

    const rangeSel = this.rangeBuilder.build(range, rootEl);
    const textPositionSel = this.positionBuilder.build(range, mapper);
    const textQuoteSel = this.quoteBuilder.build(
      documentText,
      textPositionSel.start,
      textPositionSel.end,
      prefixLen,
      suffixLen
    );

    return {
      range: rangeSel,
      textPosition: textPositionSel,
      textQuote: textQuoteSel,
    };
  }

  anchor(annotation: Annotation, root: Node, context: AnchorContext): AnchorResult {
    const { selector } = annotation.target;
    const expectedQuote = selector.textQuote?.exact?.trim();
    const { text, mapper } = context;

    // 1. From Range Selector
    if (selector.range) {
      let range = this.rangeBuilder.resolve(selector.range, root, expectedQuote ?? undefined);
      if (range && !range.collapsed) {
        if (expectedQuote && text) {
          range = this.disambiguateQuote(range, expectedQuote, text, mapper, selector);
        }
        return { ok: true, range, strategy: 'range' as AnchoringStrategy };
      }
    }

    // 2. From Position Selector
    if (selector.textPosition) {
      let range = this.positionBuilder.resolve(selector.textPosition, mapper, expectedQuote ?? undefined);
      if (range && !range.collapsed) {
        if (expectedQuote && text) {
          range = this.disambiguateQuote(range, expectedQuote, text, mapper, selector);
        }
        return { ok: true, range, strategy: 'position' as AnchoringStrategy };
      }
    }

    // 3. Context-first Fuzzy Matching (prefix + exact + suffix)
    if (text && selector.textQuote) {
      const offsets = anchorFromQuoteContext(
        text,
        selector.textQuote,
        selector.textPosition?.start,
        true
      );
      if (offsets) {
        const range = mapper.offsetsToRange(offsets.start, offsets.end);
        if (range && !range.collapsed) {
          return { ok: true, range, strategy: 'quote-context' as AnchoringStrategy };
        }
      }
    }

    // 4. Selector-only Fuzzy Matching (exact text only)
    if (text && selector.textQuote?.exact) {
      const quote = selector.textQuote;
      const offsets = anchorFromQuoteOnly(text, quote.exact, {
        positionHint: selector.textPosition?.start,
        prefix: quote.prefix,
        suffix: quote.suffix,
      });
      if (offsets) {
        const range = mapper.offsetsToRange(offsets.start, offsets.end);
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

  /**
   * When the same quote appears multiple times, pick the range that best
   * matches position/prefix/suffix.
   */
  private disambiguateQuote(
    range: Range,
    expectedQuote: string,
    text: string,
    mapper: Mapper,
    selector: Annotation['target']['selector']
  ): Range {
    const matches = findAllExactMatches(text, expectedQuote);
    if (matches.length <= 1) return range;

    let rangeStart: number;
    let rangeEnd: number;
    try {
      const off = mapper.rangeToOffsets(range);
      rangeStart = off.start;
      rangeEnd = off.end;
    } catch {
      return range;
    }

    const best = pickBestMatch(matches, text, {
      positionHint: selector.textPosition?.start,
      prefix: selector.textQuote?.prefix,
      suffix: selector.textQuote?.suffix,
    });
    if (!best || (best.start === rangeStart && best.end === rangeEnd)) return range;

    return mapper.offsetsToRange(best.start, best.end) ?? range;
  }
}
