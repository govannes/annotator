import type { Mapper } from './selectors/types';
import { DomAnchorer } from './anchorers/dom-anchorer';
import { highlightRange } from './highlighters/dom-highlighter';
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
    const exact = this.annotation.selector?.exact;
    return exact != null ? String(exact).trim() : '';
  }

    resolveRange(): AnchorResult {
    return this.anchorer.anchor(this.annotation, this.root, this.context.text, this.context.mapper);
  }

    highlightRange(range: Range): boolean {
    return highlightRange(range, this.annotation.id);
  }
}
