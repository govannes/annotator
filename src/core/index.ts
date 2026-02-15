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

export type { Highlighter, HighlightStyle } from './highlighters';

export {
  DomHighlighter,
  highlightRange,
  clearHighlights,
  getHighlightAnnotationId,
  isHighlightElement,
} from './highlighters';

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

export { build, type DomTextMapperResult } from './dom-text-mapper';

export { isContentScopedPage } from './content-url';

export {
  createAnnotationHighlighter,
  AnnotationHighlighter,
  type HighlighterContext,
} from './annotation-highlighter';
