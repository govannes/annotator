import { annotate, load } from './annotation';
import { deleteAnnotation } from './core';

export interface AnnotatorConfig {
  root: Element;
  getPageUrl: () => string;
}

let selectedAnnotationId: string | null = null;

export async function init(config: AnnotatorConfig): Promise<void> {
  const { root: ROOT, getPageUrl } = config;
  console.log('[Annotator] Init; root:', ROOT);

  const pageUrl = getPageUrl();
  const loadResult = await load(pageUrl, ROOT);
  const { anchored, total } = loadResult;
  console.log(`[Annotator] Loaded: ${loadResult.annotations.length} annotations, highlights: ${anchored}/${total}`);

  wireButtons(ROOT, config);
}

function wireButtons(ROOT: Element, config: AnnotatorConfig): void {
  const addBtn = document.getElementById('add-annotation');
  const deleteBtn = document.getElementById('annotator-btn-delete');
  const addResult = document.getElementById('add-annotation-result');

  if (!addBtn || !deleteBtn || !addResult) {
    console.warn('[Annotator] Missing button elements (add-annotation, annotator-btn-delete, add-annotation-result)');
    return;
  }

  if ((addBtn as unknown as { __annotatorWired?: boolean }).__annotatorWired) return;
  (addBtn as unknown as { __annotatorWired?: boolean }).__annotatorWired = true;

  addBtn.addEventListener('click', async () => {
    addResult.textContent = '';
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      addResult.textContent = 'Select text first.';
      return;
    }
    const range = sel.getRangeAt(0).cloneRange();
    if (!ROOT.contains(range.commonAncestorContainer)) {
      addResult.textContent = 'Selection outside annotatable area.';
      return;
    }
    try {
      const annotation = await annotate({
        range,
        root: ROOT,
        pageUrl: config.getPageUrl(),
      });
      addResult.textContent = `Saved (${annotation.id.slice(0, 8)}…).`;
      console.log('[Annotator] Annotation saved:', annotation);
    } catch (e) {
      addResult.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
      console.error('[Annotator] Save error:', e);
    }
  });

  deleteBtn.addEventListener('click', async () => {
    if (!selectedAnnotationId) {
      addResult.textContent = 'Click a highlight first, then delete.';
      return;
    }
    try {
      await deleteAnnotation(selectedAnnotationId);
      console.log('[Annotator] Deleted:', selectedAnnotationId.slice(0, 8));
      selectedAnnotationId = null;
      await reattachHighlights(config);
      addResult.textContent = 'Deleted.';
    } catch (e) {
      addResult.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
      console.error('[Annotator] Delete error:', e);
    }
  });
}

export async function reattachHighlights(config: AnnotatorConfig): Promise<void> {
  const { root: ROOT, getPageUrl } = config;
  const pageUrl = getPageUrl();
  const result = await load(pageUrl, ROOT);
  if (result.total > 0) {
    console.log(`[Annotator] Re-attach: ${result.anchored}/${result.total} highlights`);
  }
}
