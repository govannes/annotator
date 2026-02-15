import { Annotation } from './annotation';
import { deleteAnnotation, getHighlightAnnotationId } from './core';

export interface AnnotatorConfig {
    root: Element;
    getPageUrl: () => string;
}

const HIGHLIGHT_COLOR = 'rgba(255, 220, 0, 0.35)';

let selectedAnnotationId: string | null = null;

export async function init(config: AnnotatorConfig): Promise<void> {
  const { root: ROOT, getPageUrl } = config;
  console.log('[Annotator] Init; root:', ROOT);

  Annotation.configure({ getPageUrl });

  const pageUrl = getPageUrl();
  const loadResult = await Annotation.load(pageUrl).into(ROOT);
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
      const annotation = await Annotation.annotate({
        range,
        root: ROOT,
        highlightType: 'highlight',
        highlightColor: HIGHLIGHT_COLOR,
      }).done();
      addResult.textContent = `Saved (${annotation.id.slice(0, 8)}…).`;
      console.log('[Annotator] Annotation saved:', annotation);
    } catch (e) {
      addResult.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
      console.error('[Annotator] Save error:', e);
    }
  });

  ROOT.addEventListener('click', (e) => {
    const el = (e.target as Node) instanceof Element ? (e.target as Element) : null;
    const highlightEl = el?.closest?.('.annotator-highlight');
    if (highlightEl) {
      selectedAnnotationId = getHighlightAnnotationId(highlightEl as Element);
      console.log('[Annotator] Selected highlight:', selectedAnnotationId?.slice(0, 8));
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
  Annotation.configure({ getPageUrl });
  const pageUrl = getPageUrl();
  const result = await Annotation.load(pageUrl).into(ROOT);
  if (result.total > 0) {
    console.log(`[Annotator] Re-attach: ${result.anchored}/${result.total} highlights`);
  }
}
