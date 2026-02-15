/**
 * Anchorer interface: resolve stored annotations back to live DOM positions.
 *
 * An Anchorer takes stored selectors and finds the corresponding Range in the
 * current DOM. It also builds selectors from a user selection for storage.
 *
 * The four-strategy approach (Hypothesis-style fuzzy anchoring) is the default,
 * but platform-specific implementations can override or extend it.
 *
 * @see https://web.hypothes.is/blog/fuzzy-anchoring/
 */

import type { Annotation, AnnotationTarget, AnchorResult } from '../../types';
import type { Mapper } from '../selectors';

/** Context required to anchor an annotation (document text + DOM↔offset mapper). */
export interface AnchorContext {
  text: string;
  mapper: Mapper;
}

/** Options when building selectors from a range. */
export interface BuildSelectorsOptions {
  prefixLen?: number;
  suffixLen?: number;
}

/**
 * Anchorer: builds selectors and resolves annotations to DOM Ranges.
 *
 * Implementations:
 * - DomAnchorer: four-strategy fuzzy anchoring for standard web pages.
 * - Future: PdfAnchorer, TwitterAnchorer, etc.
 */
export interface AnchorerInterface {
  /** Build all selectors from a DOM Range (for saving a new annotation). */
  buildSelectors(
    range: Range,
    root: Node,
    mapper: Mapper,
    documentText: string,
    options?: BuildSelectorsOptions
  ): AnnotationTarget['selector'];

  /** Resolve an annotation to a DOM Range using stored selectors. */
  anchor(annotation: Annotation, root: Node, context: AnchorContext): AnchorResult;
}
