/**
 * Sidebar shell: container with position, width presets, resizable drag,
 * placeholder top bar, context selector, tab strip, and main content area.
 * Step 1: layout only; tab content is placeholder text.
 */

import {
  getSidebarPosition,
  setSidebarPosition,
  getSidebarWidth,
  setSidebarWidth,
  getSidebarWidthMin,
  getSidebarWidthMax,
  SIDEBAR_WIDTH_SMALL,
  SIDEBAR_WIDTH_MEDIUM,
  SIDEBAR_WIDTH_LARGE,
  type SidebarPosition,
} from './sidebar-prefs';

export const SIDEBAR_POSITION_CHANGED_EVENT = 'annotator-sidebar-position-changed';

const SIDEBAR_ID = 'annotator-sidebar';

const TAB_IDS = ['annotations', 'notes', 'projects', 'authors', 'chat'] as const;
type TabId = (typeof TAB_IDS)[number];

const TAB_LABELS: Record<TabId, string> = {
  annotations: 'Annotations',
  notes: 'Notes',
  projects: 'Projects',
  authors: 'Authors',
  chat: 'Chat',
};

export interface SidebarShellOptions {
  onClose: () => void;
}

export function createSidebarShell(options: SidebarShellOptions): HTMLElement {
  const { onClose } = options;
  const position = getSidebarPosition();
  const isLeft = position === 'left';
  let currentWidth = getSidebarWidth();

  const sidebar = document.createElement('div');
  sidebar.id = SIDEBAR_ID;
  sidebar.setAttribute('role', 'complementary');
  sidebar.setAttribute('aria-label', 'Highlighter');
  sidebar.style.cssText = `
    position: fixed;
    top: 0;
    ${isLeft ? 'left: 0' : 'right: 0'};
    width: ${currentWidth}px;
    max-width: 90vw;
    height: 100vh;
    background: #f3f4f6;
    box-shadow: ${isLeft ? '4px' : '-4px'} 0 20px rgba(0,0,0,0.1);
    z-index: 2147483645;
    display: flex;
    flex-direction: column;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  function applyWidth(w: number): void {
    currentWidth = w;
    setSidebarWidth(w);
    sidebar.style.width = `${w}px`;
  }

  // ----- Placeholder top bar -----
  const topBar = document.createElement('header');
  topBar.setAttribute('role', 'banner');
  topBar.style.cssText = `
    flex-shrink: 0;
    padding: 12px 16px;
    background: #fff;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  `;
  const pos = getSidebarPosition();
  topBar.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
      <span style="font-size: 16px; font-weight: 600; color: #111;">Highlighter</span>
      <span style="color: #9ca3af; font-size: 12px;">|</span>
      <div style="display: flex; gap: 4px;">
        <button type="button" data-pos="left" aria-label="Sidebar on left" style="
          background: ${pos === 'left' ? '#e5e7eb' : 'transparent'};
          border: 1px solid #d1d5db;
          padding: 4px 8px;
          cursor: pointer;
          color: #374151;
          border-radius: 4px;
          font-size: 12px;
        ">Left</button>
        <button type="button" data-pos="right" aria-label="Sidebar on right" style="
          background: ${pos === 'right' ? '#e5e7eb' : 'transparent'};
          border: 1px solid #d1d5db;
          padding: 4px 8px;
          cursor: pointer;
          color: #374151;
          border-radius: 4px;
          font-size: 12px;
        ">Right</button>
      </div>
      <span style="color: #9ca3af; font-size: 12px;">|</span>
      <div style="display: flex; gap: 2px;">
        <button type="button" data-width="${SIDEBAR_WIDTH_SMALL}" aria-label="Small width" style="
          background: ${currentWidth === SIDEBAR_WIDTH_SMALL ? '#e5e7eb' : 'transparent'};
          border: 1px solid #d1d5db;
          padding: 4px 6px;
          cursor: pointer;
          color: #374151;
          border-radius: 4px;
          font-size: 11px;
        ">S</button>
        <button type="button" data-width="${SIDEBAR_WIDTH_MEDIUM}" aria-label="Medium width" style="
          background: ${currentWidth === SIDEBAR_WIDTH_MEDIUM ? '#e5e7eb' : 'transparent'};
          border: 1px solid #d1d5db;
          padding: 4px 6px;
          cursor: pointer;
          color: #374151;
          border-radius: 4px;
          font-size: 11px;
        ">M</button>
        <button type="button" data-width="${SIDEBAR_WIDTH_LARGE}" aria-label="Large width" style="
          background: ${currentWidth === SIDEBAR_WIDTH_LARGE ? '#e5e7eb' : 'transparent'};
          border: 1px solid #d1d5db;
          padding: 4px 6px;
          cursor: pointer;
          color: #374151;
          border-radius: 4px;
          font-size: 11px;
        ">L</button>
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

  topBar.querySelectorAll('button[data-pos]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = (btn as HTMLButtonElement).dataset.pos as SidebarPosition;
      if (p && p !== getSidebarPosition()) {
        setSidebarPosition(p);
        window.dispatchEvent(new CustomEvent(SIDEBAR_POSITION_CHANGED_EVENT));
      }
    });
  });
  topBar.querySelectorAll('button[data-width]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const w = parseInt((btn as HTMLButtonElement).dataset.width ?? '420', 10);
      applyWidth(w);
      (btn as HTMLButtonElement).style.background = '#e5e7eb';
      topBar.querySelectorAll('button[data-width]').forEach((b) => {
        if (b !== btn) (b as HTMLButtonElement).style.background = 'transparent';
      });
    });
  });
  const closeBtn = topBar.querySelector('#annotator-sidebar-close') as HTMLButtonElement;
  if (closeBtn) closeBtn.addEventListener('click', onClose);

  sidebar.appendChild(topBar);

  // ----- Placeholder context selector -----
  const contextBar = document.createElement('div');
  contextBar.style.cssText = `
    flex-shrink: 0;
    padding: 8px 16px;
    background: #fff;
    border-bottom: 1px solid #e5e7eb;
  `;
  contextBar.innerHTML = `
    <select id="annotator-context-selector" aria-label="Context" style="
      width: 100%;
      padding: 6px 10px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 13px;
      color: #374151;
      background: #fff;
    ">
      <option value="this-page">This Page</option>
      <option value="this-project">This Project</option>
      <option value="all-notes">All Notes</option>
      <option value="all-projects">All Projects</option>
    </select>
  `;
  sidebar.appendChild(contextBar);

  // ----- Tab strip -----
  let activeTab: TabId = 'annotations';
  const tabStrip = document.createElement('nav');
  tabStrip.setAttribute('aria-label', 'Tabs');
  tabStrip.style.cssText = `
    flex-shrink: 0;
    display: flex;
    gap: 0;
    padding: 0 12px;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    overflow-x: auto;
  `;
  const mainContent = document.createElement('div');
  mainContent.id = 'annotator-sidebar-main';
  mainContent.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    color: #374151;
    font-size: 14px;
  `;

  function setTab(tabId: TabId): void {
    activeTab = tabId;
    mainContent.textContent = TAB_LABELS[tabId];
    tabStrip.querySelectorAll('[role="tab"]').forEach((el) => {
      const isSelected = (el as HTMLElement).dataset.tabId === activeTab;
      el.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      (el as HTMLElement).style.background = isSelected ? '#fff' : 'transparent';
      (el as HTMLElement).style.borderBottomColor = isSelected ? 'transparent' : 'transparent';
      (el as HTMLElement).style.fontWeight = isSelected ? '600' : '400';
    });
  }

  TAB_IDS.forEach((tabId) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', tabId === 'annotations' ? 'true' : 'false');
    tab.dataset.tabId = tabId;
    tab.textContent = TAB_LABELS[tabId];
    tab.style.cssText = `
      padding: 10px 12px;
      border: none;
      border-bottom: 2px solid transparent;
      background: ${tabId === 'annotations' ? '#fff' : 'transparent'};
      color: #374151;
      font-size: 13px;
      font-weight: ${tabId === 'annotations' ? '600' : '400'};
      cursor: pointer;
      white-space: nowrap;
    `;
    tab.addEventListener('click', () => setTab(tabId));
    tabStrip.appendChild(tab);
  });

  sidebar.appendChild(tabStrip);
  sidebar.appendChild(mainContent);
  setTab('annotations');

  // ----- Resize handle (inner edge) -----
  const resizeHandle = document.createElement('div');
  resizeHandle.setAttribute('aria-label', 'Resize sidebar');
  resizeHandle.style.cssText = `
    position: absolute;
    top: 0;
    ${isLeft ? 'right: -4px' : 'left: -4px'};
    width: 8px;
    height: 100%;
    cursor: col-resize;
    z-index: 1;
  `;
  resizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const minW = getSidebarWidthMin();
    const maxW = getSidebarWidthMax();
    function onMove(ev: MouseEvent): void {
      const delta = isLeft ? ev.movementX : -ev.movementX;
      const next = Math.max(minW, Math.min(maxW, currentWidth + delta));
      applyWidth(next);
    }
    function onUp(): void {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
  sidebar.style.position = 'relative';
  sidebar.appendChild(resizeHandle);

  return sidebar;
}

export function getSidebarRootId(): string {
  return SIDEBAR_ID;
}
