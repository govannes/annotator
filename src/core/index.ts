/**
 * Core annotator: highlighting, selector mapping, anchoring.
 * No backend — pure DOM and selector logic.
 */

export {
  highlightRange,
  clearHighlights,
  getHighlightAnnotationId,
  isHighlightElement,
  type HighlightOptions,
} from './highlighter';

export {
  toRangeSelector,
  toTextPositionSelector,
  toTextQuoteSelector,
  nodeFromXPath,
  offsetInElementToDomPosition,
} from './selectors';

export { build, type Mapper, type DomTextMapperResult } from './dom-text-mapper';

export {
  anchorAnnotation,
  anchorFromRangeSelector,
  anchorFromTextPositionSelector,
  anchorFromQuoteContext,
  anchorFromQuoteOnly,
} from './anchoring';

export {
  getContentRoots,
  getContentUrlFromRange,
  toAbsoluteUrl,
  isContentScopedPage,
} from './content-url';

export {
  createAnnotationHighlighter,
  AnnotationHighlighter,
  type HighlighterContext,
} from './annotation-highlighter';

export {
  Anchorer,
  TEXT_QUOTE_CONTEXT_LENGTH,
  type BackendAnnotationPayload,
  type BackendAnnotationResponse,
  type AnchorContext,
  type BuildSelectorsOptions,
} from './anchorer';
