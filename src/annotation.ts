import {
  DomAnchorer,
  build,
  clearHighlights,
  highlightRange,
  loadAnnotations,
  saveAnnotation,
} from './core';
import { AnnotationHighlighter } from './core/annotation-highlighter';
import type { Annotation } from './types';

interface LoadResult {
  annotations: Annotation[];
  anchored: number;
  total: number;
}

export async function annotate(range: Range, root: Element, pageUrl: string, body?: { type: string; value: string }): Promise<Annotation> {

  const { text: docText, segments } = build(root);
  const selector = new DomAnchorer().buildSelectors(range, root, segments, docText);

  const annotation: Annotation = {
    id: crypto.randomUUID(),
    selector,
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
  const annotations = all.filter((a) => a.pageUrl === pageUrl);

  clearHighlights(root);
  let anchored = 0;
  let { text: currentText, segments: currentSegments } = build(root);

  for (const ann of annotations) {
    const highlighter = new AnnotationHighlighter(ann, root, currentText, currentSegments);
    const result = highlighter.resolveRange();
    if (result.ok) {
      const didHighlight = highlighter.highlightRange(result.range);
      if (didHighlight) {
        anchored++;
        const next = build(root);
        currentText = next.text;
        currentSegments = next.segments;
      }
    }
  }

  return { annotations, anchored, total: annotations.length };
}
