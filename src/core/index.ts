/**
 * Core annotator: selectors, highlighters, anchorers, text mapping.
 * No backend — pure DOM and selector logic.
 */

// --- Selectors ---
export type {
  Mapper,
  TextMapperResult,
  RangeSelectorBuilder,
  TextPositionSelectorBuilder,
  TextQuoteSelectorBuilder,
} from './selectors';

export {
  DomRangeSelectorBuilder,
  DomTextPositionSelectorBuilder,
  DomTextQuoteSelectorBuilder,
  nodeFromXPath,
  offsetInElementToDomPosition,
} from './selectors';

// --- Highlighters ---
export type { Highlighter, HighlightStyle } from './highlighters';

export {
  DomHighlighter,
  highlightRange,
  clearHighlights,
  getHighlightAnnotationId,
  isHighlightElement,
} from './highlighters';

// --- Anchorers ---
export type {
  AnchorerInterface,
  AnchorContext,
  BuildSelectorsOptions,
} from './anchorers';

export {
  DomAnchorer,
  TEXT_QUOTE_CONTEXT_LENGTH,
  findAllExactMatches,
  pickBestMatch,
  anchorFromQuoteContext,
  anchorFromQuoteOnly,
} from './anchorers';

// --- Text mapper ---
export { build, type DomTextMapperResult } from './dom-text-mapper';

// --- Content URL ---
export {
  getContentRoots,
  getContentUrlFromRange,
  toAbsoluteUrl,
  isContentScopedPage,
} from './content-url';

// --- Annotation highlighter pipeline ---
export {
  createAnnotationHighlighter,
  AnnotationHighlighter,
  type HighlighterContext,
} from './annotation-highlighter';
