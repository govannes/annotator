/**
 * Fluent Annotation API: core + optional persistence.
 *
 * Pattern:
 *   Annotation.annotate(payload).done()
 *   Annotation.load(pageUrl).into(root)
 *
 * Configure once (e.g. in extension init):
 *   Annotation.configure({ getStore, getPageUrl })
 */

import {
  DomAnchorer,
  build,
  clearHighlights,
  createAnnotationHighlighter,
  highlightRange,
} from './core';
import type { AnnotationStore } from './api';
import type { Annotation as AnnotationType } from './types';

/** Payload to create an annotation from a selection. */
export interface AnnotatePayload {
  /** The selected range. */
  range: Range;
  /** Root element (e.g. document body or #annotatable). */
  root: Element;
  /** Page URL (default from config or window.location.href). */
  pageUrl?: string;
  /** Source URL for target (content block or page); derived from range if omitted. */
  source?: string;
  /** Highlight style: 'highlight', 'underline', 'sticky-note', etc. */
  highlightType?: string;
  /** CSS color for the highlight. */
  highlightColor?: string;
  /** Optional body (e.g. note text). */
  body?: { type: string; value: string };
}

/** Options for loading annotations onto a page. */
export interface LoadOptions {
  /** Page URL to filter annotations (e.g. current page). */
  pageUrl: string;
  /** Root element to draw highlights on. */
  root: Element;
  /** Store to load from (uses configured store if not provided). */
  store?: AnnotationStore;
}

/** Result of load(): annotations + draw stats. */
export interface LoadResult {
  /** Annotations that were loaded (for this page + content blocks). */
  annotations: AnnotationType[];
  /** Number of highlights successfully drawn. */
  anchored: number;
  /** Total annotations considered for this page. */
  total: number;
}

/** Builder from load(pageUrl); call .into(root) to load and draw. */
export interface LoadBuilder {
  into(root: Element, store?: AnnotationStore): Promise<LoadResult>;
}

let configuredStore: (() => Promise<AnnotationStore>) | null = null;
let configuredGetPageUrl: (() => string) | null = null;

/**
 * Configure the default store and page URL (e.g. once at app/extension init).
 * Used by .done() and .load() when no store is passed explicitly.
 */
export function configure(config: {
  getStore: () => Promise<AnnotationStore>;
  getPageUrl: () => string;
}): void {
  configuredStore = config.getStore;
  configuredGetPageUrl = config.getPageUrl;
}

/**
 * Start building an annotation from a selection.
 * Chain: .done() to persist and draw.
 */
export function annotate(payload: AnnotatePayload): AnnotationBuilder {
  return new AnnotationBuilder(payload);
}

/**
 * Load annotations for a page.
 * - load(pageUrl) → call .into(root) to load and draw.
 * - load({ pageUrl, root, store? }) → load and draw immediately, returns Promise<LoadResult>.
 */
export function load(pageUrl: string): LoadBuilder;
export function load(options: LoadOptions): Promise<LoadResult>;
export function load(
  pageUrlOrOptions: string | LoadOptions
): LoadBuilder | Promise<LoadResult> {
  if (typeof pageUrlOrOptions === 'string') {
    const pageUrl = pageUrlOrOptions;
    return {
      async into(root: Element, store?: AnnotationStore): Promise<LoadResult> {
        return runLoad({ pageUrl, root, store });
      },
    };
  }
  return runLoad(pageUrlOrOptions);
}

async function runLoad(options: LoadOptions): Promise<LoadResult> {
  const store = options.store ?? (configuredStore ? await configuredStore() : null);
  if (!store) {
    throw new Error('Annotation.load: no store. Pass store in options or call Annotation.configure() first.');
  }

  const all = await store.load();
  const pageUrl = options.pageUrl;
  const root = options.root;

  // Barebone: page-level only (no content-block scoping)
  const annotations = all.filter((a) => a.target.source === pageUrl);

  clearHighlights(root);
  let anchored = 0;
  let { text: currentText, mapper: currentMapper } = build(root);

  // Anchor each annotation and rebuild mapper after each highlight (keeps DOM in sync)
  for (const ann of annotations) {
    const highlighter = createAnnotationHighlighter(ann, root, {
      text: currentText,
      mapper: currentMapper,
    });
    const result = highlighter.resolveRange();
    if (result.ok) {
      const didHighlight = highlighter.highlightRange(result.range);
      if (didHighlight) {
        anchored++;
        const next = build(root);
        currentText = next.text;
        currentMapper = next.mapper;
      }
    }
  }

  return { annotations, anchored, total: annotations.length };
}

/** Fluent builder returned by annotate(payload). */
export class AnnotationBuilder {
  constructor(private readonly payload: AnnotatePayload) {}

  /**
   * Build the annotation, save to store, and draw the highlight.
   * Uses configured store if no store passed.
   */
  async done(store?: AnnotationStore): Promise<AnnotationType> {
    const { range, root, pageUrl: payloadPageUrl, source: payloadSource, highlightType, highlightColor, body } = this.payload;
    const pageUrl = payloadPageUrl ?? (configuredGetPageUrl?.() ?? (typeof window !== 'undefined' ? window.location.href : ''));
    // Barebone: source is always pageUrl (no content-block scoping)
    const source = payloadSource ?? pageUrl;

    const anchorer = new DomAnchorer();
    const { text: docText, mapper } = build(root);
    const selector = anchorer.buildSelectors(range, root, mapper, docText);

    const annotation: AnnotationType = {
      id: crypto.randomUUID(),
      target: {
        source,
        selector,
      },
      pageUrl,
      created: new Date().toISOString(),
      highlightType: highlightType ?? 'highlight',
      highlightColor: highlightColor ?? 'rgba(255, 220, 0, 0.35)',
      body,
    };

    const storeToUse = store ?? (configuredStore ? await configuredStore() : null);
    if (storeToUse) {
      await storeToUse.save(annotation);
      highlightRange(range, annotation.id, {
        type: annotation.highlightType,
        color: annotation.highlightColor,
      });
      return annotation;
    }

    highlightRange(range, annotation.id, {
      type: annotation.highlightType,
      color: annotation.highlightColor,
    });
    return annotation;
  }
}

/** Public API namespace. */
export const Annotation = {
  configure,
  annotate,
  load,
  createHighlighter: createAnnotationHighlighter,
};
