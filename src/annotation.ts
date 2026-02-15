import {
  DomAnchorer,
  build,
  clearHighlights,
  createAnnotationHighlighter,
  highlightRange,
} from './core';
import type { AnnotationStore } from './api';
import type { Annotation as AnnotationType } from './types';

export interface AnnotatePayload {
    range: Range;
    root: Element;
    pageUrl?: string;
    source?: string;
    highlightType?: string;
    highlightColor?: string;
    body?: { type: string; value: string };
}

export interface LoadOptions {
    pageUrl: string;
    root: Element;
    store?: AnnotationStore;
}

export interface LoadResult {
    annotations: AnnotationType[];
    anchored: number;
    total: number;
}

export interface LoadBuilder {
  into(root: Element, store?: AnnotationStore): Promise<LoadResult>;
}

let configuredStore: (() => Promise<AnnotationStore>) | null = null;
let configuredGetPageUrl: (() => string) | null = null;

export function configure(config: {
  getStore: () => Promise<AnnotationStore>;
  getPageUrl: () => string;
}): void {
  configuredStore = config.getStore;
  configuredGetPageUrl = config.getPageUrl;
}

export function annotate(payload: AnnotatePayload): AnnotationBuilder {
  return new AnnotationBuilder(payload);
}

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

  const annotations = all.filter((a) => a.target.source === pageUrl);

  clearHighlights(root);
  let anchored = 0;
  let { text: currentText, mapper: currentMapper } = build(root);

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

export class AnnotationBuilder {
  constructor(private readonly payload: AnnotatePayload) {}

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

export const Annotation = {
  configure,
  annotate,
  load,
  createHighlighter: createAnnotationHighlighter,
};
