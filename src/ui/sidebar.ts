/**
 * Full-height sidebar that lists all annotations for the current page.
 * White card style per annotation; position (left/right) from prefs.
 */

import type { AnnotationStore } from '../api';
import { getSidebarPosition, setSidebarPosition, type SidebarPosition } from './sidebar-prefs';
import { renderAnnotationCard } from './annotation-card';

export const SIDEBAR_POSITION_CHANGED_EVENT = 'annotator-sidebar-position-changed';

const SIDEBAR_ID = 'annotator-sidebar';
const SIDEBAR_WIDTH = 360;

export interface SidebarOptions {
  getStore: () => Promise<AnnotationStore>;
  getPageUrl: () => string;
  onClose: () => void;
}

export function createSidebar(options: SidebarOptions): HTMLElement {
  const { getStore, getPageUrl, onClose } = options;
  const position = getSidebarPosition();
  const isLeft = position === 'left';

  const sidebar = document.createElement('div');
  sidebar.id = SIDEBAR_ID;
  sidebar.setAttribute('role', 'complementary');
  sidebar.setAttribute('aria-label', 'Annotations');
  sidebar.style.cssText = `
    position: fixed;
    top: 0;
    ${isLeft ? 'left: 0' : 'right: 0'};
    width: ${SIDEBAR_WIDTH}px;
    max-width: 90vw;
    height: 100vh;
    background: #f3f4f6;
    box-shadow: ${isLeft ? '4px' : '-4px'} 0 20px rgba(0,0,0,0.1);
    z-index: 2147483645;
    display: flex;
    flex-direction: column;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  const header = document.createElement('header');
  header.style.cssText = `
    flex-shrink: 0;
    padding: 14px 16px;
    background: #fff;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
  `;
  const currentPos = getSidebarPosition();
  header.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
      <h2 id="annotator-sidebar-title" style="margin: 0; font-size: 16px; font-weight: 600; color: #111;">Annotations</h2>
      <span style="color: #9ca3af; font-size: 12px;">|</span>
      <div style="display: flex; gap: 4px;">
        <button type="button" data-pos="left" aria-label="Sidebar on left" style="
          background: ${currentPos === 'left' ? '#e5e7eb' : 'transparent'};
          border: 1px solid #d1d5db;
          padding: 4px 8px;
          cursor: pointer;
          color: #374151;
          border-radius: 4px;
          font-size: 12px;
        ">Left</button>
        <button type="button" data-pos="right" aria-label="Sidebar on right" style="
          background: ${currentPos === 'right' ? '#e5e7eb' : 'transparent'};
          border: 1px solid #d1d5db;
          padding: 4px 8px;
          cursor: pointer;
          color: #374151;
          border-radius: 4px;
          font-size: 12px;
        ">Right</button>
      </div>
    </div>
    <button type="button" id="annotator-sidebar-close" aria-label="Close sidebar" style="
      background: none;
      border: none;
      padding: 6px;
      cursor: pointer;
      color: #6b7280;
      border-radius: 6px;
      font-size: 18px;
      line-height: 1;
    ">×</button>
  `;
  sidebar.appendChild(header);

  header.querySelectorAll('button[data-pos]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pos = (btn as HTMLButtonElement).dataset.pos as SidebarPosition;
      if (pos && pos !== getSidebarPosition()) {
        setSidebarPosition(pos);
        window.dispatchEvent(new CustomEvent(SIDEBAR_POSITION_CHANGED_EVENT));
      }
    });
  });

  const listContainer = document.createElement('div');
  listContainer.id = 'annotator-sidebar-list';
  listContainer.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  `;
  sidebar.appendChild(listContainer);

  const closeBtn = header.querySelector('#annotator-sidebar-close') as HTMLButtonElement;
  if (closeBtn) closeBtn.addEventListener('click', onClose);

  async function loadAnnotations(): Promise<void> {
    const titleEl = sidebar.querySelector('#annotator-sidebar-title') as HTMLElement;
    listContainer.innerHTML = '<div style="color: #6b7280; padding: 12px;">Loading…</div>';
    try {
      const store = await getStore();
      const pageUrl = getPageUrl();
      const all = await store.load();
      const forPage = all.filter(
        (a) => a.target?.source === pageUrl || a.pageUrl === pageUrl
      );
      if (titleEl) titleEl.textContent = `Annotations ${forPage.length > 0 ? `(${forPage.length})` : ''}`;
      listContainer.innerHTML = '';
      if (forPage.length === 0) {
        const empty = document.createElement('p');
        empty.style.cssText = 'color: #6b7280; padding: 12px; margin: 0;';
        empty.textContent = 'No annotations on this page yet.';
        listContainer.appendChild(empty);
      } else {
        for (const ann of forPage) {
          listContainer.appendChild(renderAnnotationCard(ann));
        }
      }
    } catch (e) {
      listContainer.innerHTML = `<div style="color: #dc2626; padding: 12px;">Failed to load: ${e instanceof Error ? e.message : String(e)}</div>`;
      if (titleEl) titleEl.textContent = 'Annotations';
    }
  }

  sidebar.addEventListener('open', () => loadAnnotations());
  (sidebar as unknown as { loadAnnotations: () => Promise<void> }).loadAnnotations = loadAnnotations;

  return sidebar;
}

export function getSidebarRootId(): string {
  return SIDEBAR_ID;
}
