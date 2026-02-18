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
    const TAG = '[Anchorer]';
    const selector = annotation.selector;
    const annId = annotation.id?.slice(0, 8) ?? '?';

    if (!selector) {
      return { ok: false, error: 'Annotation has no selector' };
    }
    const expectedQuote = selector.exact?.trim() || undefined;

    // Log full DB state for this annotation
    console.group(`${TAG} Anchoring ${annId}…`);
    console.log(`${TAG}   DB exact : "${selector.exact?.slice(0, 80)}${(selector.exact?.length ?? 0) > 80 ? '…' : ''}"`);
    console.log(`${TAG}   DB prefix: "${selector.prefix}"`);
    console.log(`${TAG}   DB suffix: "${selector.suffix}"`);
    console.log(`${TAG}   DB range : start="${selector.start}" end="${selector.end}" startOff=${selector.startOffset} endOff=${selector.endOffset}`);
    console.log(`${TAG}   Doc text length: ${text?.length ?? 0}, segments: ${segments?.length ?? 0}`);

    // Strategy 1: Range selector (XPath + offsets)
    if (selector.start && selector.end) {
      let range = resolveFromRange(selector, root, expectedQuote);
      if (range && !range.collapsed) {
        const resolvedText = range.toString();
        console.log(`${TAG}   [Strategy 1: range/XPath] RESOLVED → "${resolvedText.slice(0, 80)}${resolvedText.length > 80 ? '…' : ''}" (len=${resolvedText.length})`);
        if (expectedQuote && resolvedText.trim() !== expectedQuote) {
          console.warn(`${TAG}   [Strategy 1] MISMATCH — resolved text differs from DB exact!`);
        }
        if (expectedQuote && text) {
          range = this.disambiguateQuote(range, expectedQuote, text, segments, selector);
          const afterDisambig = range.toString();
          if (afterDisambig !== resolvedText) {
            console.log(`${TAG}   [Strategy 1] After disambig → "${afterDisambig.slice(0, 80)}${afterDisambig.length > 80 ? '…' : ''}"`);
          }
        }
        console.groupEnd();
        return { ok: true, range, strategy: 'range' as AnchoringStrategy };
      } else {
        console.log(`${TAG}   [Strategy 1: range/XPath] failed (${range ? 'collapsed' : 'null'})`);
      }
    } else {
      console.log(`${TAG}   [Strategy 1: range/XPath] skipped (no start/end XPath)`);
    }

    // Strategy 2: Text position selector (character offsets)
    if (selector.startOffset != null && selector.endOffset != null) {
      let range = resolveFromTextPosition(selector, segments, expectedQuote);
      if (range && !range.collapsed) {
        const resolvedText = range.toString();
        console.log(`${TAG}   [Strategy 2: position] RESOLVED → "${resolvedText.slice(0, 80)}${resolvedText.length > 80 ? '…' : ''}" (len=${resolvedText.length})`);
        if (expectedQuote && resolvedText.trim() !== expectedQuote) {
          console.warn(`${TAG}   [Strategy 2] MISMATCH — resolved text "${resolvedText.slice(0, 60)}…" differs from DB exact "${expectedQuote.slice(0, 60)}…"`);
        }
        if (expectedQuote && text) {
          range = this.disambiguateQuote(range, expectedQuote, text, segments, selector);
          const afterDisambig = range.toString();
          if (afterDisambig !== resolvedText) {
            console.log(`${TAG}   [Strategy 2] After disambig → "${afterDisambig.slice(0, 80)}${afterDisambig.length > 80 ? '…' : ''}"`);
          }
        }
        console.groupEnd();
        return { ok: true, range, strategy: 'position' as AnchoringStrategy };
      } else {
        console.log(`${TAG}   [Strategy 2: position] failed (${range ? 'collapsed' : 'null'}) offsets=[${selector.startOffset}, ${selector.endOffset}]`);
      }
    } else {
      console.log(`${TAG}   [Strategy 2: position] skipped (no offsets)`);
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
          const resolvedText = range.toString();
          console.log(`${TAG}   [Strategy 3: quote-context] RESOLVED → "${resolvedText.slice(0, 80)}${resolvedText.length > 80 ? '…' : ''}" at [${offsets.start}, ${offsets.end}]`);
          console.groupEnd();
          return { ok: true, range, strategy: 'quote-context' as AnchoringStrategy };
        } else {
          console.log(`${TAG}   [Strategy 3: quote-context] offsets found [${offsets.start}, ${offsets.end}] but range failed`);
        }
      } else {
        console.log(`${TAG}   [Strategy 3: quote-context] no offsets found`);
      }
    } else {
      console.log(`${TAG}   [Strategy 3: quote-context] skipped (no text or no exact)`);
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
          const resolvedText = range.toString();
          console.log(`${TAG}   [Strategy 4: quote-only] RESOLVED → "${resolvedText.slice(0, 80)}${resolvedText.length > 80 ? '…' : ''}" at [${offsets.start}, ${offsets.end}]`);
          console.groupEnd();
          return { ok: true, range, strategy: 'quote-only' as AnchoringStrategy };
        } else {
          console.log(`${TAG}   [Strategy 4: quote-only] offsets found [${offsets.start}, ${offsets.end}] but range failed`);
        }
      } else {
        console.log(`${TAG}   [Strategy 4: quote-only] no match in doc text`);
      }
    } else {
      console.log(`${TAG}   [Strategy 4: quote-only] skipped`);
    }

    console.warn(`${TAG}   ALL STRATEGIES FAILED for ${annId}`);
    console.groupEnd();
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
