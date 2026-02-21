import type { AnchorResult, Annotation } from '../types';
import { DomAnchorer } from './anchorers/dom-anchorer';
import { Segment } from './dom-text-mapper';
import { highlightRange } from './highlighters/dom-highlighter';

export class AnnotationHighlighter {
  private readonly anchorer = new DomAnchorer();

  constructor(
    private readonly annotation: Annotation,
    private readonly root: Node,
    private readonly text: string,
    private readonly segments: Segment[],
  ) {}

  resolveRange(): AnchorResult {
    return this.anchorer.anchor(this.annotation, this.root, this.text, this.segments);
  }

  highlightRange(range: Range): boolean {
    return highlightRange(range, this.annotation.id, this.annotation.color);
  }
}
