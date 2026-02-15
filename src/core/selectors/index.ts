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
