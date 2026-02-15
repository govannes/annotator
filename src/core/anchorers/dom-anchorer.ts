import type { Annotation, AnnotationTarget, AnchorResult, AnchoringStrategy } from '../../types';
import type { Mapper } from '../selectors/types';
import {
  DomRangeSelectorBuilder,
  DomTextPositionSelectorBuilder,
  DomTextQuoteSelectorBuilder,
} from '../selectors/dom-selector-builder';

import {
  findAllExactMatches,
  pickBestMatch,
  anchorFromQuoteContext,
  anchorFromQuoteOnly,
} from './text-search';


export class DomAnchorer  {
  private readonly rangeBuilder = new DomRangeSelectorBuilder();
  private readonly positionBuilder = new DomTextPositionSelectorBuilder();
  private readonly quoteBuilder = new DomTextQuoteSelectorBuilder();

  buildSelectors(
    range: Range,
    root: Node,
    mapper: Mapper,
    documentText: string,
  ): AnnotationTarget['selector'] {
    const rootEl = root.nodeType === Node.DOCUMENT_NODE ? (root as Document).body : (root as Element);
    if (!rootEl) throw new Error('DomAnchorer.buildSelectors: invalid root');

    const rangeSel = this.rangeBuilder.build(range, rootEl);
    const textPositionSel = this.positionBuilder.build(range, mapper);
    const textQuoteSel = this.quoteBuilder.build(
      documentText,
      textPositionSel.start,
      textPositionSel.end
    );

    return {
      range: rangeSel,
      textPosition: textPositionSel,
      textQuote: textQuoteSel,
    };
  }

  anchor(annotation: Annotation, root: Node, text: string, mapper: Mapper): AnchorResult {
    const { selector } = annotation.target;
    const expectedQuote = selector.textQuote?.exact?.trim();

    if (selector.range) {
      let range = this.rangeBuilder.resolve(selector.range, root, expectedQuote ?? undefined);
      if (range && !range.collapsed) {
        if (expectedQuote && text) {
          range = this.disambiguateQuote(range, expectedQuote, text, mapper, selector);
        }
        return { ok: true, range, strategy: 'range' as AnchoringStrategy };
      }
    }

    if (selector.textPosition) {
      let range = this.positionBuilder.resolve(selector.textPosition, mapper, expectedQuote ?? undefined);
      if (range && !range.collapsed) {
        if (expectedQuote && text) {
          range = this.disambiguateQuote(range, expectedQuote, text, mapper, selector);
        }
        return { ok: true, range, strategy: 'position' as AnchoringStrategy };
      }
    }

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
