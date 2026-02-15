/**
 * Selector interfaces: how annotations describe a position in a document.
 *
 * Each SelectorBuilder knows how to:
 * - Build a selector from a user selection (for saving).
 * - Resolve a stored selector back to a position (for re-attachment).
 *
 * The types (RangeSelector, TextPositionSelector, TextQuoteSelector) live in
 * src/types.ts so they're available everywhere. This file defines the builder
 * contracts that platform-specific implementations fulfill.
 */

import type {
  RangeSelector,
  TextPositionSelector,
  TextQuoteSelector,
} from '../../types';

// ---------------------------------------------------------------------------
// Mapper: bidirectional DOM ↔ character offset mapping
// ---------------------------------------------------------------------------

/** Bidirectional mapping between DOM Ranges and character offsets in document text. */
export interface Mapper {
  rangeToOffsets(domRange: Range): { start: number; end: number };
  offsetsToRange(start: number, end: number): Range | null;
}

/** Result of building a text mapper for a given root. */
export interface TextMapperResult {
  text: string;
  mapper: Mapper;
}

// ---------------------------------------------------------------------------
// Selector builders
// ---------------------------------------------------------------------------

/** Builds a RangeSelector (XPath + offsets) from a DOM Range. */
export interface RangeSelectorBuilder {
  build(range: Range, root: Node): RangeSelector;
  resolve(selector: RangeSelector, root: Node, expectedQuote?: string): Range | null;
}

/** Builds a TextPositionSelector (global char offsets) from a DOM Range. */
export interface TextPositionSelectorBuilder {
  build(range: Range, mapper: Mapper): TextPositionSelector;
  resolve(selector: TextPositionSelector, mapper: Mapper, expectedQuote?: string): Range | null;
}

/** Builds a TextQuoteSelector (exact + prefix + suffix) from document text. */
export interface TextQuoteSelectorBuilder {
  build(documentText: string, start: number, end: number, prefixLen?: number, suffixLen?: number): TextQuoteSelector;
}

// ---------------------------------------------------------------------------
// XPath utilities (used by RangeSelector implementations)
// ---------------------------------------------------------------------------

/** Resolve an XPath string to a DOM element under root. */
export type XPathResolver = (root: Element, xpath: string) => Element | null;

/** Map a character offset in an element's text to a (TextNode, offset) position. */
export type OffsetResolver = (element: Element, charOffset: number) => { node: Text; offset: number } | null;
