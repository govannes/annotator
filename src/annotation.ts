import {
  DomAnchorer,
  build,
  clearHighlights,
  createAnnotationHighlighter,
  highlightRange,
  loadAnnotations,
  saveAnnotation,
} from './core';
import type { Annotation } from './types';

export interface AnnotatePayload {
  range: Range;
  root: Element;
  pageUrl: string;
  source?: string;
  body?: { type: string; value: string };
}

export interface LoadResult {
  annotations: Annotation[];
  anchored: number;
  total: number;
}

export async function annotate(payload: AnnotatePayload): Promise<Annotation> {
  const { range, root, pageUrl, body } = payload;
  const source = payload.source ?? pageUrl;

  const anchorer = new DomAnchorer();
  const { text: docText, mapper } = build(root);
  const selector = anchorer.buildSelectors(range, root, mapper, docText);

  const annotation: Annotation = {
    id: crypto.randomUUID(),
    target: { source, selector },
    pageUrl,
    created: new Date().toISOString(),
    body,
  };

  await saveAnnotation(annotation);

  highlightRange(range, annotation.id);

  return annotation;
}

export async function load(pageUrl: string, root: Element): Promise<LoadResult> {
  const all = await loadAnnotations();
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
