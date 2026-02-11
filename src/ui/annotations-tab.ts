/**
 * Annotations tab: current page only. Load from backend, render cards, "Go to source".
 */

import type { AnnotationStore } from '../api';
import { renderAnnotationCard } from './annotation-card';

export interface AnnotationsTabDeps {
  getStore: () => Promise<AnnotationStore>;
  getPageUrl: () => string;
  onGoToSource: (annotationId: string) => void;
}

/**
 * Renders the Annotations tab (highlights on the current page only).
 */
export async function renderAnnotationsTab(
  container: HTMLElement,
  _context: 'this-page',
  deps: AnnotationsTabDeps
): Promise<void> {
  const { getStore, getPageUrl, onGoToSource } = deps;
  container.innerHTML = '';
  container.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    color: #374151;
    font-size: 14px;
  `;

  const loading = document.createElement('div');
  loading.style.cssText = 'color: #6b7280; font-size: 13px;';
  loading.textContent = 'Loading…';
  container.appendChild(loading);

  try {
    const store = await getStore();
    const list = await store.load({ pageUrl: getPageUrl() });
    loading.remove();

    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'text-align: center; padding: 24px 16px; color: #6b7280;';
      empty.innerHTML = `
        <p style="margin: 0 0 8px; font-size: 14px;">No highlights on this page</p>
        <p style="margin: 0; font-size: 13px;">Select text to highlight</p>
      `;
      container.appendChild(empty);
      return;
    }

    const listEl = document.createElement('div');
    listEl.style.cssText = 'display: flex; flex-direction: column;';
    for (const ann of list) {
      const card = renderAnnotationCard(ann, {
        notesCount: 0,
        onGoToSource,
      });
      listEl.appendChild(card);
    }
    container.appendChild(listEl);
  } catch (err) {
    loading.remove();
    const errEl = document.createElement('div');
    errEl.style.cssText = 'color: #b91c1c; font-size: 13px; padding: 16px;';
    errEl.textContent = err instanceof Error ? err.message : 'Failed to load annotations';
    container.appendChild(errEl);
  }
}
