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

export interface LoadResult {
  annotations: Annotation[];
  anchored: number;
  total: number;
  /** Annotations that couldn't be anchored (content not in DOM yet) */
  failed: Annotation[];
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
  const TAG = '[Annotator:load]';
  const all = await loadAnnotations();
  const annotations = all.filter((a) => a.pageUrl === pageUrl);

  console.group(`${TAG} Loading ${annotations.length}/${all.length} annotations for ${pageUrl}`);

  clearHighlights(root);
  const { anchored, failed } = anchorBatch(annotations, root, TAG);

  console.log(`${TAG} Result: ${anchored}/${annotations.length} anchored, ${failed.length} pending`);
  console.groupEnd();
  return { annotations, anchored, total: annotations.length, failed };
}

/**
 * Incrementally retry previously-failed annotations without clearing
 * existing highlights. Returns the subset that still couldn't anchor.
 */
export function retryFailed(pending: Annotation[], root: Element): Annotation[] {
  const TAG = '[Annotator:retry]';
  if (pending.length === 0) return [];

  console.group(`${TAG} Retrying ${pending.length} pending annotations`);
  const { anchored, failed } = anchorBatch(pending, root, TAG);
  console.log(`${TAG} Retry result: ${anchored} newly anchored, ${failed.length} still pending`);
  console.groupEnd();
  return failed;
}

function anchorBatch(
  annotations: Annotation[],
  root: Element,
  TAG: string,
): { anchored: number; failed: Annotation[]; text: string; segments: import('./core/dom-text-mapper').Segment[] } {
  let anchored = 0;
  const failed: Annotation[] = [];
  let { text: currentText, segments: currentSegments } = build(root);
  console.log(`${TAG} Doc text length: ${currentText.length}, segments: ${currentSegments.length}`);

  for (const ann of annotations) {
    const highlighter = new AnnotationHighlighter(ann, root, currentText, currentSegments);
    const result = highlighter.resolveRange();
    if (result.ok) {
      const resolvedText = result.range.toString();
      const didHighlight = highlighter.highlightRange(result.range);
      if (didHighlight) {
        anchored++;
        console.log(
          `${TAG} ✓ ${ann.id.slice(0, 8)} anchored via [${result.strategy}]` +
          ` — resolved: "${resolvedText.slice(0, 60)}${resolvedText.length > 60 ? '…' : ''}"` +
          ` — db exact: "${ann.selector.exact?.slice(0, 60)}${(ann.selector.exact?.length ?? 0) > 60 ? '…' : ''}"`
        );
        if (resolvedText.trim() !== ann.selector.exact?.trim()) {
          console.error(
            `${TAG} ⚠ TEXT MISMATCH for ${ann.id.slice(0, 8)}!` +
            `\n  Resolved (len=${resolvedText.length}): "${resolvedText.slice(0, 120)}"` +
            `\n  DB exact (len=${ann.selector.exact?.length ?? 0}): "${ann.selector.exact?.slice(0, 120)}"` +
            `\n  Strategy: ${result.strategy}` +
            `\n  Selector: start="${ann.selector.start}" end="${ann.selector.end}" elOff=[${ann.selector.startOffset}, ${ann.selector.endOffset}] docOff=[${ann.selector.docStartOffset}, ${ann.selector.docEndOffset}]` +
            `\n  Prefix: "${ann.selector.prefix}" Suffix: "${ann.selector.suffix}"`
          );
        }
        const next = build(root);
        currentText = next.text;
        currentSegments = next.segments;
      }
    } else {
      failed.push(ann);
      console.warn(`${TAG} ✗ ${ann.id.slice(0, 8)} failed — exact: "${ann.selector.exact?.slice(0, 60)}…"`);
    }
  }

  return { anchored, failed, text: currentText, segments: currentSegments };
}
