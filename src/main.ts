/**
 * Annotator – in-browser annotation with fuzzy anchoring.
 * Works inside a browser extension (content script).
 *
 * Uses the fluent Annotation API: Annotation.annotate().done(), Annotation.load(page).into(root).
 */

import { Annotation } from './annotation';
import { getHighlightAnnotationId } from './core';
import type { AnnotationStore } from './api';

declare global {
  interface Window {
    __annotatorHighlightColor?: string;
  }
}

export interface AnnotatorConfig {
  /** Root element to annotate (e.g. document.body). */
  root: Element;
  /** Current page URL for storing/loading annotations. */
  getPageUrl: () => string;
  /** Store implementation. */
  getStore: () => Promise<AnnotationStore>;
}

let store: AnnotationStore | null = null;

/**
 * Initialize the annotator: load annotations, draw highlights, attach button handlers.
 * The page should have elements with ids: add-annotation, annotator-btn-delete, add-annotation-result.
 */
export async function init(config: AnnotatorConfig): Promise<void> {
  const { root: ROOT, getPageUrl, getStore } = config;
  console.log('Annotator init; root:', ROOT);

  Annotation.configure({ getStore, getPageUrl });
  store = await getStore();

  const pageUrl = getPageUrl();
  const loadResult = await Annotation.load(pageUrl).into(ROOT);
  const { anchored, total: totalForUi } = loadResult;
  console.log('[Annotator] Loaded:', loadResult.annotations.length, `highlights: ${anchored}/${totalForUi}`);

  const highlightColor = () => window.__annotatorHighlightColor ?? 'rgba(255, 220, 0, 0.35)';

  // --- Add annotation (highlight selection) ---
  const addBtn = document.getElementById('add-annotation');
  const addResult = document.getElementById('add-annotation-result');
  if (addBtn && addResult) {
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
          highlightColor: highlightColor(),
        }).done();
        addResult.textContent = `Saved (${annotation.id.slice(0, 8)}…).`;
        console.log('Annotation saved:', annotation);
      } catch (e) {
        addResult.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
        console.error(e);
      }
    });
  }

  // --- Click highlight to select it ---
  let selectedAnnotationId: string | null = null;
  ROOT.addEventListener('click', (e) => {
    const el = (e.target as Node) instanceof Element ? (e.target as Element) : null;
    const highlightEl = el?.closest?.('.annotator-highlight');
    if (highlightEl) {
      selectedAnnotationId = getHighlightAnnotationId(highlightEl as Element);
    }
  });

  // --- Delete selected highlight ---
  const deleteBtn = document.getElementById('annotator-btn-delete');
  if (deleteBtn && addResult) {
    deleteBtn.addEventListener('click', async () => {
      if (!selectedAnnotationId) {
        addResult.textContent = 'Click a highlight first, then delete.';
        return;
      }
      if (!store) return;
      try {
        await store.delete(selectedAnnotationId);
        selectedAnnotationId = null;
        await reattachHighlights(config);
        addResult.textContent = 'Deleted.';
      } catch (e) {
        addResult.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
        console.error(e);
      }
    });
  }
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
    console.log(`[Annotator] Re-attach: ${result.anchored}/${result.total} highlights.`);
  }
}
