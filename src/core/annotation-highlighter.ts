import { DomAnchorer } from './anchorers/dom-anchorer';
import { highlightRange } from './highlighters/dom-highlighter';
import type { Annotation, AnchorResult } from '../types';
import { Segment } from './dom-text-mapper';

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
    return highlightRange(range, this.annotation.id);
  }
}
