/**
 * Sidebar shell: current-page only. Tabs: Annotations, Notes; Settings via gear.
 * No context selector; "Go to portal" link for full dashboard.
 */

import {
  getSidebarPosition,
  getSidebarWidth,
  setSidebarWidth,
  getSidebarWidthMin,
  getSidebarWidthMax,
} from './sidebar-prefs';

export const SIDEBAR_POSITION_CHANGED_EVENT = 'annotator-sidebar-position-changed';

const SIDEBAR_ID = 'annotator-sidebar';

/** Sidebar is always "this page"; payload still has context for compatibility. */
export type SidebarContext = 'this-page';

/** Optional API on the sidebar element. */
export interface SidebarShellApi {
  __renderContent?: (payload: { tabId: TabId; context: SidebarContext }) => void;
  __getMainContent?: () => HTMLElement;
  __getActiveTab?: () => TabId;
  __refresh?: () => void;
}

const TAB_IDS = ['annotations', 'notes', 'settings'] as const;
type TabId = (typeof TAB_IDS)[number];

/** Tab IDs that get a tab button in the strip; settings is opened via gear only. */
const TAB_IDS_STRIP: TabId[] = ['annotations', 'notes'];

const TAB_LABELS: Record<TabId, string> = {
  annotations: 'Annotations',
  notes: 'Notes',
  settings: 'Settings',
};

export interface SidebarShellOptions {
  onClose: () => void;
  /** Current page URL (for domain/title in top bar). If omitted, shows generic label. */
  getPageUrl?: () => string;
  /** Portal URL for "Go to portal" (full dashboard). Sync or async; empty = link hidden. */
  getPortalUrl?: () => string | Promise<string>;
}

export function createSidebarShell(options: SidebarShellOptions): HTMLElement {
  const { onClose, getPortalUrl } = options;
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

  // ----- Top bar: left (logo), right (settings, collapse) -----
  const topBar = document.createElement('header');
  topBar.setAttribute('role', 'banner');
  topBar.style.cssText = `
    flex-shrink: 0;
    padding: 10px 14px;
    background: #fafafa;
    border-bottom: 1px solid #e8e8e8;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 10px;
    min-height: 48px;
  `;

  const logo = document.createElement('div');
  logo.setAttribute('aria-hidden', 'true');
  logo.style.cssText = `
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: #e5e7eb;
    color: #6b7280;
    font-size: 14px;
    font-weight: 600;
  `;
  logo.textContent = 'A';
  topBar.appendChild(logo);

  const right = document.createElement('div');
  right.style.cssText = `display: flex; align-items: center; gap: 6px; justify-self: end; flex-wrap: wrap;`;
  const portalLink = document.createElement('a');
  portalLink.target = '_blank';
  portalLink.rel = 'noopener noreferrer';
  portalLink.textContent = 'Go to portal';
  portalLink.style.cssText = `
    font-size: 12px;
    color: #2563eb;
    text-decoration: none;
    padding: 4px 8px;
    border-radius: 6px;
    display: none;
  `;
  portalLink.addEventListener('mouseenter', () => { portalLink.style.background = '#eff6ff'; });
  portalLink.addEventListener('mouseleave', () => { portalLink.style.background = 'none'; });
  right.appendChild(portalLink);
  const rawPortal = getPortalUrl?.();
  if (rawPortal != null) {
    Promise.resolve(rawPortal).then((url) => {
      if (url && typeof url === 'string') {
        portalLink.href = url;
        portalLink.style.display = '';
      }
    });
  }
  const settingsBtn = document.createElement('button');
  settingsBtn.type = 'button';
  settingsBtn.setAttribute('aria-label', 'Settings');
  settingsBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
  settingsBtn.style.cssText = `
    background: none;
    border: none;
    padding: 6px;
    cursor: pointer;
    color: #6b7280;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  settingsBtn.addEventListener('mouseenter', () => { settingsBtn.style.color = '#374151'; settingsBtn.style.background = '#eee'; });
  settingsBtn.addEventListener('mouseleave', () => { settingsBtn.style.color = '#6b7280'; settingsBtn.style.background = 'none'; });
  const collapseBtn = document.createElement('button');
  collapseBtn.type = 'button';
  collapseBtn.id = 'annotator-sidebar-close';
  collapseBtn.setAttribute('aria-label', 'Close sidebar');
  collapseBtn.innerHTML = '×';
  collapseBtn.style.cssText = `
    background: none;
    border: none;
    padding: 6px 8px;
    cursor: pointer;
    color: #6b7280;
    border-radius: 6px;
    font-size: 20px;
    line-height: 1;
  `;
  collapseBtn.addEventListener('mouseenter', () => { collapseBtn.style.color = '#111'; collapseBtn.style.background = '#eee'; });
  collapseBtn.addEventListener('mouseleave', () => { collapseBtn.style.color = '#6b7280'; collapseBtn.style.background = 'none'; });
  collapseBtn.addEventListener('click', onClose);
  right.appendChild(settingsBtn);
  right.appendChild(collapseBtn);
  topBar.appendChild(right);

  sidebar.appendChild(topBar);

  // ----- Tab strip (Annotations | Notes); Settings via gear only -----
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

  const CONTEXT_THIS_PAGE: SidebarContext = 'this-page';

  function refreshContent(): void {
    const payload = { tabId: activeTab, context: CONTEXT_THIS_PAGE };
    const customRender = (sidebar as unknown as { __renderContent?: (p: { tabId: TabId; context: SidebarContext }) => void })
      .__renderContent;
    if (customRender) {
      customRender(payload);
      return;
    }
    mainContent.textContent = TAB_LABELS[activeTab];
  }

  function setTab(tabId: TabId): void {
    activeTab = tabId;
    tabStrip.querySelectorAll('[role="tab"]').forEach((el) => {
      const isSelected = (el as HTMLElement).dataset.tabId === activeTab;
      el.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      (el as HTMLElement).style.background = isSelected ? '#fff' : 'transparent';
      (el as HTMLElement).style.borderBottomColor = isSelected ? 'transparent' : 'transparent';
      (el as HTMLElement).style.fontWeight = isSelected ? '600' : '400';
    });
    refreshContent();
  }

  settingsBtn.addEventListener('click', () => setTab('settings'));

  TAB_IDS_STRIP.forEach((tabId) => {
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

  (sidebar as unknown as SidebarShellApi).__getMainContent = () => mainContent;
  (sidebar as unknown as SidebarShellApi).__getActiveTab = () => activeTab;
  (sidebar as unknown as SidebarShellApi).__refresh = () => refreshContent();

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
