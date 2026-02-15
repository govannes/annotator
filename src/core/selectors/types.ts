import type {
  RangeSelector,
  TextPositionSelector,
  TextQuoteSelector,
} from '../../types';

export interface Mapper {
  rangeToOffsets(domRange: Range): { start: number; end: number };
  offsetsToRange(start: number, end: number): Range | null;
}

export interface TextMapperResult {
  text: string;
  mapper: Mapper;
}

export interface RangeSelectorBuilder {
  build(range: Range, root: Node): RangeSelector;
  resolve(selector: RangeSelector, root: Node, expectedQuote?: string): Range | null;
}

export interface TextPositionSelectorBuilder {
  build(range: Range, mapper: Mapper): TextPositionSelector;
  resolve(selector: TextPositionSelector, mapper: Mapper, expectedQuote?: string): Range | null;
}

export interface TextQuoteSelectorBuilder {
  build(documentText: string, start: number, end: number, prefixLen?: number, suffixLen?: number): TextQuoteSelector;
}

export type XPathResolver = (root: Element, xpath: string) => Element | null;

export type OffsetResolver = (element: Element, charOffset: number) => { node: Text; offset: number } | null;
