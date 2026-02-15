import { DomAnchorer } from './anchorers/dom-anchorer';
import { highlightRange } from './highlighters/dom-highlighter';
import type { Annotation, AnchorResult } from '../types';
import { Segment } from './dom-text-mapper';

export function createAnnotationHighlighter(
  annotation: Annotation,
  root: Node,
  context: { text: string; segments: Segment[] }
): AnnotationHighlighter {
  return new AnnotationHighlighter(annotation, root, context);
}

class AnnotationHighlighter {
  private readonly anchorer = new DomAnchorer();

  constructor(
    private readonly annotation: Annotation,
    private readonly root: Node,
    private readonly context: { text: string; segments: Segment[] }
  ) {}

    getTargetText(): string {
    const exact = this.annotation.selector?.exact;
    return exact != null ? String(exact).trim() : '';
  }

    resolveRange(): AnchorResult {
    return this.anchorer.anchor(this.annotation, this.root, this.context.text, this.context.segments);
  }

    highlightRange(range: Range): boolean {
    return highlightRange(range, this.annotation.id);
  }
}
