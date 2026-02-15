/**
 * Highlighters: visual rendering of annotation highlights.
 *
 * Interface in types.ts; DOM implementation in dom-highlighter.ts.
 * Add platform-specific implementations here (e.g. PdfHighlighter).
 */

export type { Highlighter, HighlightStyle } from './types';

export {
  DomHighlighter,
  highlightRange,
  clearHighlights,
  getHighlightAnnotationId,
  isHighlightElement,
} from './dom-highlighter';
