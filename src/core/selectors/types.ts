export interface Mapper {
  rangeToOffsets(domRange: Range): { start: number; end: number };
  offsetsToRange(start: number, end: number): Range | null;
}

export interface TextMapperResult {
  text: string;
  mapper: Mapper;
}

export type XPathResolver = (root: Element, xpath: string) => Element | null;

export type OffsetResolver = (element: Element, charOffset: number) => { node: Text; offset: number } | null;
