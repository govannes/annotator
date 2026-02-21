import { annotate, load, retryFailed } from './annotation';
import { deleteAnnotation } from './core';
import { applyHighlightVisibility } from './panel';
import type { Annotation } from './types';

export interface AnnotatorConfig {
  root: Element;
  getPageUrl: () => string;
}

let selectedAnnotationId: string | null = null;
let pendingAnnotations: Annotation[] = [];
let currentConfig: AnnotatorConfig | null = null;

export async function init(config: AnnotatorConfig): Promise<void> {
  currentConfig = config;
  const { root: ROOT, getPageUrl } = config;
  console.log('[Highlighter][Annotator] Init; root:', ROOT);

  const pageUrl = getPageUrl();
  const loadResult = await load(pageUrl, ROOT);
  const { anchored, total, failed } = loadResult;
  pendingAnnotations = failed;
  console.log(`[Highlighter][Annotator] Loaded: ${loadResult.annotations.length} annotations, highlights: ${anchored}/${total}, pending: ${failed.length}`);

  applyHighlightVisibility();
  wireButtons(ROOT, config);
}

/**
 * Called by the selection toolbar when the user clicks "Highlight".
 * Validates the range and creates the annotation with the chosen color.
 */
export async function performAnnotation(range: Range, color: string): Promise<void> {
  if (!currentConfig) return;
  const { root: ROOT, getPageUrl } = currentConfig;
  const addResult = document.getElementById('add-annotation-result');

  if (!ROOT.contains(range.commonAncestorContainer)) {
    if (addResult) addResult.textContent = 'Selection outside annotatable area.';
    return;
  }

  try {
    const annotation = await annotate(range, ROOT, getPageUrl(), undefined, color);
    if (addResult) addResult.textContent = `Saved (${annotation.id.slice(0, 8)}…).`;
    console.log('[Highlighter][Annotator] Annotation saved:', annotation);
  } catch (e) {
    if (addResult) addResult.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
    console.error('[Highlighter][Annotator] Save error:', e);
  }
}

function wireButtons(_root: Element, config: AnnotatorConfig): void {
  const deleteBtn = document.getElementById('annotator-btn-delete');
  const addResult = document.getElementById('add-annotation-result');

  if (!deleteBtn || !addResult) {
    console.warn('[Highlighter][Annotator] Missing button elements');
    return;
  }

  if ((deleteBtn as unknown as { __annotatorWired?: boolean }).__annotatorWired) return;
  (deleteBtn as unknown as { __annotatorWired?: boolean }).__annotatorWired = true;

  deleteBtn.addEventListener('click', async () => {
    if (!selectedAnnotationId) {
      addResult.textContent = 'Click a highlight first, then delete.';
      return;
    }
    try {
      await deleteAnnotation(selectedAnnotationId);
      console.log('[Highlighter][Annotator] Deleted:', selectedAnnotationId.slice(0, 8));
      selectedAnnotationId = null;
      await reattachHighlights(config);
      addResult.textContent = 'Deleted.';
    } catch (e) {
      addResult.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
      console.error('[Highlighter][Annotator] Delete error:', e);
    }
  });
}

export async function reattachHighlights(config: AnnotatorConfig): Promise<void> {
  const { root: ROOT, getPageUrl } = config;
  const pageUrl = getPageUrl();
  const result = await load(pageUrl, ROOT);
  pendingAnnotations = result.failed;
  if (result.total > 0) {
    console.log(`[Highlighter][Annotator] Re-attach: ${result.anchored}/${result.total} highlights, pending: ${result.failed.length}`);
  }
  applyHighlightVisibility();
}

/**
 * Incrementally retry only previously-failed annotations.
 * Doesn't clear existing highlights — just tries to anchor the missing ones
 * into newly-loaded DOM content (infinite scroll, lazy rendering, etc.).
 */
export function retryPending(config: AnnotatorConfig): void {
  if (pendingAnnotations.length === 0) return;
  const stillFailed = retryFailed(pendingAnnotations, config.root);
  pendingAnnotations = stillFailed;
  applyHighlightVisibility();
}

export function hasPending(): boolean {
  return pendingAnnotations.length > 0;
}
