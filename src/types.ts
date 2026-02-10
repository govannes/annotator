/**
 * Annotation data shapes (START.md §2).
 * Frontend creates/updates selector; backend only stores/returns these.
 */

export interface RangeSelector {
  start: string;       // XPath to element containing start of selection
  end: string;
  startOffset: number; // character offset within that element's text
  endOffset: number;
}

export interface TextPositionSelector {
  start: number;       // character offset in "whole document" text
  end: number;
}

export interface TextQuoteSelector {
  exact: string;       // selected text
  prefix: string;      // e.g. 32 chars before
  suffix: string;      // e.g. 32 chars after
}

export interface AnnotationTarget {
  source: string;      // URL of the document (which page)
  selector: {
    range?: RangeSelector;
    textPosition?: TextPositionSelector;
    textQuote?: TextQuoteSelector;
  };
}

export interface Annotation {
  id: string;
  target: AnnotationTarget;
  /** Page URL where the annotation was created (always stored). */
  pageUrl?: string;
  /** Link to full_page table (snapshot of page HTML when annotation was created). */
  fullPageId?: string;
  /** Base URL (origin) of the page, for filtering. */
  baseUrl?: string;
  body?: { type: string; value: string };
  created?: string;
  /** Highlight style: e.g. 'highlight', 'underline', 'sticky-note'. */
  highlightType?: string;
  /** CSS color for the highlight, e.g. '#ffff00' or 'rgba(255,220,0,0.35)'. */
  highlightColor?: string;
}

/** Snapshot of a full page stored for anchoring/debugging. */
export interface FullPage {
  id: string;
  html: string;
  baseUrl: string;
  fullPath: string;
  created: string;
  updated: string;
}

/**
 * Which anchoring strategy succeeded (Hypothesis-style order).
 * See https://web.hypothes.is/blog/fuzzy-anchoring/
 */
export type AnchoringStrategy =
  | 'range'         // 1. RangeSelector (XPath + offsets) – exact DOM
  | 'position'      // 2. TextPositionSelector – global char offsets
  | 'quote-context' // 3. TextQuoteSelector prefix+exact+suffix (fuzzy)
  | 'quote-only';   // 4. TextQuoteSelector exact only (fuzzy)

/** Result of resolving an annotation to a DOM Range. Reproducible and debuggable. */
export type AnchorResult =
  | { ok: true; range: Range; strategy: AnchoringStrategy }
  | { ok: false; error: string };
