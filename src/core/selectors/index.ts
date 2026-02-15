/**
 * Selectors: build and resolve annotation position descriptors.
 *
 * Interface in types.ts; DOM implementation in dom-selector-builder.ts.
 * Add platform-specific implementations here (e.g. PdfSelectorBuilder).
 */

export type {
  Mapper,
  TextMapperResult,
  RangeSelectorBuilder,
  TextPositionSelectorBuilder,
  TextQuoteSelectorBuilder,
  XPathResolver,
  OffsetResolver,
} from './types';

export {
  DomRangeSelectorBuilder,
  DomTextPositionSelectorBuilder,
  DomTextQuoteSelectorBuilder,
  nodeFromXPath,
  offsetInElementToDomPosition,
} from './dom-selector-builder';
