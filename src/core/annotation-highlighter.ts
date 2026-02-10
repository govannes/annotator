/**
 * Clear, debuggable pipeline to resolve one annotation to a Range and optionally highlight it.
 * Follows Hypothesis fuzzy anchoring: 4 strategies in order (range → position → quote-context → quote-only).
 * See https://web.hypothes.is/blog/fuzzy-anchoring/
 *
 * Usage:
 *   for (const ann of annotationList) {
 *     const highlighter = createAnnotationHighlighter(ann, root, { text, mapper });
 *     const targetText = highlighter.getTargetText();   // for debugging
 *     const result = highlighter.resolveRange();       // { ok, range?, strategy? }
 *     if (result.ok) highlighter.highlight(result.range, options);
 *   }
 */

import type { Mapper } from './dom-text-mapper';
import { Anchorer } from './anchorer';
import { highlightRange, type HighlightOptions } from './highlighter';
import type { Annotation, AnchorResult } from '../types';

export interface HighlighterContext {
  text: string;
  mapper: Mapper;
}

/**
 * Creates a highlighter for one annotation on a given root with pre-built text/mapper.
 * Use the same (root, text, mapper) for the scope you're anchoring in (page or content block).
 */
export function createAnnotationHighlighter(
  annotation: Annotation,
  root: Node,
  context: HighlighterContext
): AnnotationHighlighter {
  return new AnnotationHighlighter(annotation, root, context);
}

/**
 * Per-annotation pipeline: get target text → resolve range (4 strategies) → highlight.
 * A) Debuggable: getTargetText() and resolveRange() expose what we're matching and which strategy won.
 * B) Reproducible: strategy order is fixed; same annotation + same DOM → same result.
 * C) Robust: four fallbacks (Hypothesis-style) for ~99% re-attachment.
 */
export class AnnotationHighlighter {
  constructor(
    private readonly annotation: Annotation,
    private readonly root: Node,
    private readonly context: HighlighterContext
  ) {}

  /**
   * Returns the text we're trying to anchor (from TextQuoteSelector).
   * Use for debugging and logging (e.g. "looking for: …").
   */
  getTargetText(): string {
    const exact = this.annotation.target.selector?.textQuote?.exact;
    return exact != null ? String(exact).trim() : '';
  }

  /**
   * Resolve the annotation to a DOM Range using the four strategies in order.
   * Returns which strategy succeeded so you can log or reproduce.
   */
  resolveRange(): AnchorResult {
    return Anchorer.anchor(this.annotation, this.root, this.context);
  }

  /**
   * Resolve to a Range then draw the highlight. Returns true if a highlight was drawn.
   */
  highlight(options: HighlightOptions = {}): boolean {
    const result = this.resolveRange();
    if (!result.ok) return false;
    return highlightRange(result.range, this.annotation.id, {
      type: this.annotation.highlightType,
      color: this.annotation.highlightColor,
      ...options,
    });
  }

  /**
   * Draw a highlight for an already-resolved range (e.g. from resolveRange()).
   * Use when you want to inspect or log the result before drawing.
   */
  highlightRange(range: Range, options: HighlightOptions = {}): boolean {
    return highlightRange(range, this.annotation.id, {
      type: this.annotation.highlightType,
      color: this.annotation.highlightColor,
      ...options,
    });
  }
}
