/**
 * Clear, debuggable pipeline to resolve one annotation to a Range and optionally highlight it.
 * Follows Hypothesis fuzzy anchoring: 4 strategies in order (range -> position -> quote-context -> quote-only).
 * See https://web.hypothes.is/blog/fuzzy-anchoring/
 *
 * Usage:
 *   for (const ann of annotationList) {
 *     const highlighter = createAnnotationHighlighter(ann, root, { text, mapper });
 *     const targetText = highlighter.getTargetText();   // for debugging
 *     const result = highlighter.resolveRange();       // { ok, range?, strategy? }
 *     if (result.ok) highlighter.highlightRange(result.range);
 *   }
 */

import type { Mapper } from './selectors';
import { DomAnchorer } from './anchorers';
import { highlightRange, type HighlightStyle } from './highlighters';
import type { Annotation, AnchorResult } from '../types';

export interface HighlighterContext {
  text: string;
  mapper: Mapper;
}

/**
 * Creates a highlighter for one annotation on a given root with pre-built text/mapper.
 */
export function createAnnotationHighlighter(
  annotation: Annotation,
  root: Node,
  context: HighlighterContext
): AnnotationHighlighter {
  return new AnnotationHighlighter(annotation, root, context);
}

/**
 * Per-annotation pipeline: get target text -> resolve range (4 strategies) -> highlight.
 */
export class AnnotationHighlighter {
  private readonly anchorer = new DomAnchorer();

  constructor(
    private readonly annotation: Annotation,
    private readonly root: Node,
    private readonly context: HighlighterContext
  ) {}

  /** Returns the text we're trying to anchor (from TextQuoteSelector). */
  getTargetText(): string {
    const exact = this.annotation.target.selector?.textQuote?.exact;
    return exact != null ? String(exact).trim() : '';
  }

  /** Resolve the annotation to a DOM Range using the four strategies in order. */
  resolveRange(): AnchorResult {
    return this.anchorer.anchor(this.annotation, this.root, this.context);
  }

  /** Resolve to a Range then draw the highlight. Returns true if a highlight was drawn. */
  highlight(options: HighlightStyle = {}): boolean {
    const result = this.resolveRange();
    if (!result.ok) return false;
    return highlightRange(result.range, this.annotation.id, {
      type: this.annotation.highlightType,
      color: this.annotation.highlightColor,
      ...options,
    });
  }

  /** Draw a highlight for an already-resolved range. */
  highlightRange(range: Range, options: HighlightStyle = {}): boolean {
    return highlightRange(range, this.annotation.id, {
      type: this.annotation.highlightType,
      color: this.annotation.highlightColor,
      ...options,
    });
  }
}
