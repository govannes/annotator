/**
 * Anchorer: Hypothesis-style anchoring in one place.
 *
 * 1. Build selectors from a DOM Range (for saving) and produce backend payload.
 * 2. Turn backend response into an Annotation.
 * 3. Re-attach annotations to the DOM using four strategies (fuzzy anchoring).
 *
 * Selectors (saved and sent to BE):
 * - RangeSelector: XPath start/end + character offsets in those elements.
 * - TextPositionSelector: start/end character offsets in the whole-document text.
 * - TextQuoteSelector: exact selected text + prefix (e.g. 32 chars) + suffix (e.g. 32 chars).
 *
 * Reattachment strategies (tried in order):
 * 1. From Range Selector: apply XPath + offsets; verify with TextQuote if present.
 * 2. From Position Selector: global char offsets (structure changed, text unchanged).
 * 3. Context-first Fuzzy: find prefix/suffix with fuzzy search, compare exact in between.
 * 4. Selector-only Fuzzy: fuzzy search for exact quote only (last resort).
 *
 * @see https://web.hypothes.is/blog/fuzzy-anchoring/
 */

import type { Mapper } from './dom-text-mapper';
import {
  toRangeSelector,
  toTextPositionSelector,
  toTextQuoteSelector,
} from './selectors';
import {
  anchorFromRangeSelector,
  anchorFromTextPositionSelector,
  anchorFromQuoteContext,
  anchorFromQuoteOnly,
  findAllExactMatches,
  pickBestMatch,
} from './anchoring';
import type {
  Annotation,
  AnnotationTarget,
  RangeSelector,
  TextPositionSelector,
  TextQuoteSelector,
  AnchorResult,
  AnchoringStrategy,
} from '../types';

/** Length of prefix/suffix context for TextQuoteSelector (Hypothesis uses 32). */
export const TEXT_QUOTE_CONTEXT_LENGTH = 32;

// ---------------------------------------------------------------------------
// Backend payload types (what we send and receive)
// ---------------------------------------------------------------------------

/** Payload to send to the backend (e.g. POST /annotations). */
export interface BackendAnnotationPayload {
  id?: string;
  source: string;
  pageUrl: string;
  selector: Annotation['target']['selector'];
  bodyType?: string;
  bodyValue?: string;
  highlightType?: string;
  highlightColor?: string;
  baseUrl?: string;
}

/** Response from the backend (e.g. GET /annotations or POST /annotations). */
export interface BackendAnnotationResponse {
  id: string;
  source: string;
  pageUrl: string;
  selector: Annotation['target']['selector'];
  bodyType?: string;
  bodyValue?: string;
  created?: string;
  highlightType?: string;
  highlightColor?: string;
  fullPageId?: string;
  baseUrl?: string;
  authorId?: string;
  projectId?: string;
  /** Number of notes linked to this annotation (when provided by the backend). */
  noteCount?: number;
}

/** Context required to re-attach an annotation (document text + DOM↔offset mapper). */
export interface AnchorContext {
  text: string;
  mapper: Mapper;
}

/** Options when building selectors from a range. */
export interface BuildSelectorsOptions {
  prefixLen?: number;
  suffixLen?: number;
}

// ---------------------------------------------------------------------------
// Anchorer class
// ---------------------------------------------------------------------------

export class Anchorer {
  /**
   * Build all three selectors (Range, TextPosition, TextQuote) from a DOM Range.
   * Use when creating a new annotation from a user selection so the backend can store
   * the full Hypothesis-style selector set for robust re-attachment.
   */
  static buildSelectorsFromRange(
    range: Range,
    root: Node,
    mapper: Mapper,
    documentText: string,
    options: BuildSelectorsOptions = {}
  ): AnnotationTarget['selector'] {
    const { prefixLen = TEXT_QUOTE_CONTEXT_LENGTH, suffixLen = TEXT_QUOTE_CONTEXT_LENGTH } = options;
    const rootEl = root.nodeType === Node.DOCUMENT_NODE ? (root as Document).body : (root as Element);
    if (!rootEl) throw new Error('Anchorer.buildSelectorsFromRange: invalid root');

    const rangeSel: RangeSelector = toRangeSelector(range, rootEl);
    const textPositionSel: TextPositionSelector = toTextPositionSelector(range, mapper);
    const textQuoteSel: TextQuoteSelector = toTextQuoteSelector(
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

  /**
   * Convert an Annotation to the payload shape expected by the backend (e.g. POST body).
   */
  static toBackendPayload(annotation: Annotation): BackendAnnotationPayload {
    return {
      id: annotation.id,
      source: annotation.target.source,
      pageUrl: annotation.pageUrl ?? annotation.target.source,
      selector: annotation.target.selector,
      bodyType: annotation.body?.type,
      bodyValue: annotation.body?.value,
      highlightType: annotation.highlightType,
      highlightColor: annotation.highlightColor,
      baseUrl: annotation.baseUrl,
    };
  }

  /**
   * Convert a backend response into an Annotation (for use after load or save).
   */
  static fromBackendPayload(api: BackendAnnotationResponse): Annotation {
    const target: AnnotationTarget = {
      source: api.source,
      selector: api.selector ?? {},
    };
    const ann: Annotation = {
      id: api.id,
      target,
      pageUrl: api.pageUrl,
      created: api.created,
      highlightType: api.highlightType,
      highlightColor: api.highlightColor,
      fullPageId: api.fullPageId,
      baseUrl: api.baseUrl,
      authorId: api.authorId,
      projectId: api.projectId,
    };
    if (api.bodyType != null || api.bodyValue != null) {
      ann.body = { type: api.bodyType ?? '', value: api.bodyValue ?? '' };
    }
    if (api.noteCount != null) {
      ann.noteCount = api.noteCount;
    }
    return ann;
  }

  /**
   * Re-attach an annotation to the current DOM using the four Hypothesis strategies in order:
   *
   * 1. **From Range Selector**: Apply stored XPath + offsets; verify with TextQuote if present.
   * 2. **From Position Selector**: Global character offsets (handles structure changes, same text).
   * 3. **Context-first Fuzzy**: Find prefix/suffix with fuzzy search, then compare exact text.
   * 4. **Selector-only Fuzzy**: Fuzzy search for exact quote only (last resort).
   *
   * @see https://web.hypothes.is/blog/fuzzy-anchoring/
   */
  private static readonly ANCHOR_LOG = '[Anchoring]';

  /**
   * When the same quote appears multiple times (e.g. "se" in "serverless" and "seamless"),
   * pick the range that best matches position/prefix/suffix. Returns the (possibly updated) range.
   */
  private static disambiguateQuote(
    range: Range,
    expectedQuote: string,
    text: string,
    mapper: Mapper,
    selector: Annotation['target']['selector']
  ): Range {
    const matches = findAllExactMatches(text, expectedQuote);
    if (matches.length <= 1) {
      if (matches.length === 1) {
        console.log(Anchorer.ANCHOR_LOG, 'disambiguateQuote: single match, no change');
      }
      return range;
    }

    let rangeStart: number;
    let rangeEnd: number;
    try {
      const off = mapper.rangeToOffsets(range);
      rangeStart = off.start;
      rangeEnd = off.end;
    } catch (e) {
      console.log(Anchorer.ANCHOR_LOG, 'disambiguateQuote: rangeToOffsets failed', e);
      return range;
    }

    console.log(Anchorer.ANCHOR_LOG, 'disambiguateQuote: multiple matches', {
      matchCount: matches.length,
      currentRangeOffsets: { start: rangeStart, end: rangeEnd },
      positionHint: selector.textPosition?.start,
      prefix: selector.textQuote?.prefix?.slice(0, 25),
      suffix: selector.textQuote?.suffix?.slice(0, 25),
    });

    const best = pickBestMatch(matches, text, {
      positionHint: selector.textPosition?.start,
      prefix: selector.textQuote?.prefix,
      suffix: selector.textQuote?.suffix,
    });
    if (!best || (best.start === rangeStart && best.end === rangeEnd)) {
      console.log(Anchorer.ANCHOR_LOG, 'disambiguateQuote: keeping current range', best ? 'same as best' : 'no best');
      return range;
    }

    const bestRange = mapper.offsetsToRange(best.start, best.end);
    console.log(Anchorer.ANCHOR_LOG, 'disambiguateQuote: REPLACING range', {
      from: { start: rangeStart, end: rangeEnd, text: text.slice(rangeStart, rangeEnd) },
      to: { start: best.start, end: best.end, text: text.slice(best.start, best.end) },
    });
    return bestRange ?? range;
  }

  static anchor(
    annotation: Annotation,
    root: Node,
    context: AnchorContext
  ): AnchorResult {
    const { selector } = annotation.target;
    const expectedQuote = selector.textQuote?.exact?.trim();
    const { text, mapper } = context;

    console.log(Anchorer.ANCHOR_LOG, 'anchor() start', {
      annotationId: annotation.id?.slice(0, 8),
      expectedQuote: JSON.stringify(expectedQuote),
      hasRange: !!selector.range,
      hasTextPosition: !!selector.textPosition,
      hasTextQuote: !!selector.textQuote,
      textPosition: selector.textPosition ? { start: selector.textPosition.start, end: selector.textPosition.end } : null,
      prefix: selector.textQuote?.prefix?.slice(0, 30),
      suffix: selector.textQuote?.suffix?.slice(0, 30),
    });

    // 1. From Range Selector
    if (selector.range) {
      let range = anchorFromRangeSelector(
        selector.range,
        root,
        expectedQuote ?? undefined
      );
      if (range && !range.collapsed) {
        if (expectedQuote && text) {
          range = Anchorer.disambiguateQuote(range, expectedQuote, text, mapper, selector);
        }
        console.log(Anchorer.ANCHOR_LOG, 'anchor() SUCCESS strategy=range', { rangeText: JSON.stringify(range.toString().trim()) });
        return { ok: true, range, strategy: 'range' as AnchoringStrategy };
      }
      console.log(Anchorer.ANCHOR_LOG, 'anchor() strategy 1 (range) failed or skipped');
    }

    // 2. From Position Selector
    if (selector.textPosition) {
      let range = anchorFromTextPositionSelector(
        selector.textPosition,
        mapper,
        expectedQuote ?? undefined
      );
      if (range && !range.collapsed) {
        if (expectedQuote && text) {
          range = Anchorer.disambiguateQuote(range, expectedQuote, text, mapper, selector);
        }
        console.log(Anchorer.ANCHOR_LOG, 'anchor() SUCCESS strategy=position', { rangeText: JSON.stringify(range.toString().trim()) });
        return { ok: true, range, strategy: 'position' as AnchoringStrategy };
      }
      console.log(Anchorer.ANCHOR_LOG, 'anchor() strategy 2 (position) failed or skipped');
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
          console.log(Anchorer.ANCHOR_LOG, 'anchor() SUCCESS strategy=quote-context', { offsets, rangeText: JSON.stringify(range.toString().trim()) });
          return { ok: true, range, strategy: 'quote-context' as AnchoringStrategy };
        }
      }
      console.log(Anchorer.ANCHOR_LOG, 'anchor() strategy 3 (quote-context) failed or skipped');
    }

    // 4. Selector-only Fuzzy Matching (exact text only); when multiple matches use position/prefix/suffix
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
          console.log(Anchorer.ANCHOR_LOG, 'anchor() SUCCESS strategy=quote-only', { offsets, rangeText: JSON.stringify(range.toString().trim()) });
          return { ok: true, range, strategy: 'quote-only' as AnchoringStrategy };
        }
      }
      console.log(Anchorer.ANCHOR_LOG, 'anchor() strategy 4 (quote-only) failed or skipped');
    }

    console.log(Anchorer.ANCHOR_LOG, 'anchor() FAILED all strategies');
    return {
      ok: false,
      error:
        'All four anchoring strategies failed (range, position, quote-context, quote-only)',
    };
  }
}
