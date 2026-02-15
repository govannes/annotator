import type { Annotation, AnnotationTarget, AnchorResult } from '../../types';
import type { Mapper } from '../selectors';

export interface AnchorContext {
  text: string;
  mapper: Mapper;
}

export interface BuildSelectorsOptions {
  prefixLen?: number;
  suffixLen?: number;
}

export interface AnchorerInterface {
    buildSelectors(
    range: Range,
    root: Node,
    mapper: Mapper,
    documentText: string,
    options?: BuildSelectorsOptions
  ): AnnotationTarget['selector'];

    anchor(annotation: Annotation, root: Node, context: AnchorContext): AnchorResult;
}
