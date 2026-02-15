/**
 * Annotator initialization: load annotations, draw highlights, wire button handlers.
 * Barebone version: localStorage only, 3 buttons, page-level annotations.
 */

import { Annotation } from './annotation';
import { getHighlightAnnotationId } from './core';
import type { AnnotationStore } from './api';

export interface AnnotatorConfig {
  /** Root element to annotate (e.g. document.body). */
  root: Element;
  /** Current page URL for storing/loading annotations. */
  getPageUrl: () => string;
  /** Store implementation. */
  getStore: () => Promise<AnnotationStore>;
}

/** Hardcoded highlight color (no UI picker in barebone version). */
const HIGHLIGHT_COLOR = 'rgba(255, 220, 0, 0.35)';

let store: AnnotationStore | null = null;
let selectedAnnotationId: string | null = null;

/**
 * Initialize the annotator: load annotations, draw highlights, attach button handlers.
 * Requires elements with ids: add-annotation, annotator-btn-delete, add-annotation-result.
 */
export async function init(config: AnnotatorConfig): Promise<void> {
  const { root: ROOT, getPageUrl, getStore } = config;
  console.log('[Annotator] Init; root:', ROOT);

  Annotation.configure({ getStore, getPageUrl });
  store = await getStore();

  const pageUrl = getPageUrl();
  const loadResult = await Annotation.load(pageUrl).into(ROOT);
  const { anchored, total } = loadResult;
  console.log(`[Annotator] Loaded: ${loadResult.annotations.length} annotations, highlights: ${anchored}/${total}`);

  wireButtons(ROOT, config);
}

/**
 * Wire button event handlers (Anchor, Delete).
 * Separate function so we only wire once, even if init() is called multiple times.
 */
function wireButtons(ROOT: Element, config: AnnotatorConfig): void {
  const addBtn = document.getElementById('add-annotation');
  const deleteBtn = document.getElementById('annotator-btn-delete');
  const addResult = document.getElementById('add-annotation-result');

  if (!addBtn || !deleteBtn || !addResult) {
    console.warn('[Annotator] Missing button elements (add-annotation, annotator-btn-delete, add-annotation-result)');
    return;
  }

  // Already wired? Skip (guard against double-init)
  if ((addBtn as unknown as { __annotatorWired?: boolean }).__annotatorWired) return;
  (addBtn as unknown as { __annotatorWired?: boolean }).__annotatorWired = true;

  // --- Anchor button: highlight selection ---
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

  // --- Click highlight to select it ---
  ROOT.addEventListener('click', (e) => {
    const el = (e.target as Node) instanceof Element ? (e.target as Element) : null;
    const highlightEl = el?.closest?.('.annotator-highlight');
    if (highlightEl) {
      selectedAnnotationId = getHighlightAnnotationId(highlightEl as Element);
      console.log('[Annotator] Selected highlight:', selectedAnnotationId?.slice(0, 8));
    }
  });

  // --- Delete button: remove selected highlight ---
  deleteBtn.addEventListener('click', async () => {
    if (!selectedAnnotationId) {
      addResult.textContent = 'Click a highlight first, then delete.';
      return;
    }
    if (!store) return;
    try {
      await store.delete(selectedAnnotationId);
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

/**
 * Re-run load-and-draw only (no button handlers). Clears existing highlights first.
 * Use from the extension after a delay or on DOM mutations so dynamic content gets highlighted.
 */
export async function reattachHighlights(config: AnnotatorConfig): Promise<void> {
  const { root: ROOT, getPageUrl, getStore } = config;
  Annotation.configure({ getStore, getPageUrl });
  const pageUrl = getPageUrl();
  const result = await Annotation.load(pageUrl).into(ROOT);
  if (result.total > 0) {
    console.log(`[Annotator] Re-attach: ${result.anchored}/${result.total} highlights`);
  }
}
