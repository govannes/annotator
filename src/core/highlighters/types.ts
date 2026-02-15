/**
 * Highlighter interface: how annotations are visually rendered on a surface.
 *
 * The DOM implementation wraps text in <span> elements.
 * Future implementations (PDF, Canvas, SVG) would draw overlays differently.
 */

/** Style options for a highlight. */
export interface HighlightStyle {
  /** e.g. 'highlight', 'underline', 'sticky-note'. */
  type?: string;
  /** CSS color, e.g. '#ffff00' or 'rgba(255,220,0,0.35)'. */
  color?: string;
}

/**
 * Draws and manages visual highlights on a surface.
 *
 * Implementations are platform-specific:
 * - DomHighlighter: wraps text runs in <span> elements (standard web pages).
 * - Future: PdfHighlighter, CanvasHighlighter, etc.
 */
export interface Highlighter {
  /** Draw a highlight for the given range. Returns true if drawn successfully. */
  draw(range: Range, annotationId: string, style: HighlightStyle): boolean;

  /** Remove all highlights from the surface. */
  clear(root: Element): void;

  /** Get the annotation ID from a highlight element, or null. */
  getAnnotationId(element: Element): string | null;

  /** Check if an element is a highlight. */
  isHighlight(element: Element): boolean;
}
