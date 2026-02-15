import type { Mapper } from './selectors';
import { DomAnchorer } from './anchorers';
import { highlightRange, type HighlightStyle } from './highlighters';
import type { Annotation, AnchorResult } from '../types';

export interface HighlighterContext {
  text: string;
  mapper: Mapper;
}

export function createAnnotationHighlighter(
  annotation: Annotation,
  root: Node,
  context: HighlighterContext
): AnnotationHighlighter {
  return new AnnotationHighlighter(annotation, root, context);
}

export class AnnotationHighlighter {
  private readonly anchorer = new DomAnchorer();

  constructor(
    private readonly annotation: Annotation,
    private readonly root: Node,
    private readonly context: HighlighterContext
  ) {}

    getTargetText(): string {
    const exact = this.annotation.target.selector?.textQuote?.exact;
    return exact != null ? String(exact).trim() : '';
  }

    resolveRange(): AnchorResult {
    return this.anchorer.anchor(this.annotation, this.root, this.context);
  }

    highlight(options: HighlightStyle = {}): boolean {
    const result = this.resolveRange();
    if (!result.ok) return false;
    return highlightRange(result.range, this.annotation.id, {
      type: this.annotation.highlightType,
      color: this.annotation.highlightColor,
      ...options,
    });
  }

    highlightRange(range: Range, options: HighlightStyle = {}): boolean {
    return highlightRange(range, this.annotation.id, {
      type: this.annotation.highlightType,
      color: this.annotation.highlightColor,
      ...options,
    });
  }
}
