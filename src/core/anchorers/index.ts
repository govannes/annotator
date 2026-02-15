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
