/**
 * Anchorers: resolve stored annotations to live DOM positions.
 *
 * Interface in types.ts; DOM implementation in dom-anchorer.ts.
 * Text search utilities (shared by all strategies) in text-search.ts.
 * Add platform-specific implementations here (e.g. PdfAnchorer).
 */

export type {
  AnchorerInterface,
  AnchorContext,
  BuildSelectorsOptions,
} from './types';

export {
  DomAnchorer,
  TEXT_QUOTE_CONTEXT_LENGTH,
} from './dom-anchorer';

export {
  findAllExactMatches,
  pickBestMatch,
  anchorFromQuoteContext,
  anchorFromQuoteOnly,
  type PickBestMatchOptions,
} from './text-search';
