/**
 * UI entry: sidebar is current-page only (Annotations, Notes, Settings).
 * "Go to portal" for full dashboard; Settings for highlight color, position, width.
 */

import type { AnnotationStore, NotesApi } from '../api';
import type { Note } from '../types';
import { renderAnnotationsTab } from './annotations-tab';
import { renderNotesTab } from './notes-tab';
import { renderSettingsTab } from './settings-tab';
import type { SidebarContext } from './sidebar-shell';
import { createSidebarShell, SIDEBAR_POSITION_CHANGED_EVENT, type SidebarShellApi } from './sidebar-shell';
import { getSidebarPosition, type SidebarPosition } from './sidebar-prefs';
import { createTrigger, type TriggerApi } from './trigger';

export { SIDEBAR_POSITION_CHANGED_EVENT };

const CONTAINER_ID = 'annotator-ui-root';

let keydownRegistered = false;

function registerSidebarShortcut(): void {
  if (keydownRegistered) return;
  keydownRegistered = true;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'h' && e.key !== 'H') return;
    if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return;
    const root = document.getElementById(CONTAINER_ID) as (HTMLElement & { __annotatorUIHandle?: AnnotatorUIHandle }) | null;
    const handle = root?.__annotatorUIHandle;
    if (handle) {
      e.preventDefault();
      handle.toggle();
    }
  });
}

export interface MountAnnotatorUIOptions {
  getStore: () => Promise<AnnotationStore>;
  getPageUrl: () => string;
  /** Notes API for the Notes tab (required for Notes tab to load data). */
  getNotesApi: () => Promise<NotesApi>;
  /** Portal URL for "Go to portal" (full dashboard). Sync or async; empty = hidden. */
  getPortalUrl?: () => string | Promise<string>;
  /** Optional: element to mount into (default: document.body). */
  root?: Element;
}

export interface AnnotatorUIHandle {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: () => boolean;
}

export function mountAnnotatorUI(options: MountAnnotatorUIOptions): AnnotatorUIHandle {
  const { getStore: _getStore, getPageUrl: _getPageUrl, getNotesApi: _getNotesApi, getPortalUrl: _getPortalUrl, root = document.body } = options;

  const existing = document.getElementById(CONTAINER_ID) as (HTMLElement & { __annotatorUIHandle?: AnnotatorUIHandle }) | null;
  if (existing?.__annotatorUIHandle) return existing.__annotatorUIHandle;

  registerSidebarShortcut();

  // Fixed viewport overlay so sidebar/trigger stay on the side regardless of page layout.
  // Without this, appending to body can put the UI at the bottom on flex/grid pages.
  const container = document.createElement('div');
  container.id = CONTAINER_ID;
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2147483647;
  `;

  let side: SidebarPosition = getSidebarPosition();
  const getSide = (): SidebarPosition => side;

  const sidebar = createSidebarShell({
    onClose: () => setOpen(false),
    getSide,
    getPageUrl: _getPageUrl,
    getPortalUrl: _getPortalUrl,
  });
  sidebar.style.display = 'none';
  sidebar.style.pointerEvents = 'auto';
  container.appendChild(sidebar);

  function goToSource(annotationId: string): void {
    const first = document.querySelector(`[data-annotation-id="${annotationId}"]`);
    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const all = document.querySelectorAll(`[data-annotation-id="${annotationId}"]`);
      const pulse = 'annotator-highlight-pulse';
      all.forEach((el) => el.classList.add(pulse));
      setTimeout(() => all.forEach((el) => el.classList.remove(pulse)), 1500);
    }
  }

  function goToSourceFromNote(note: Note): void {
    if (note.annotationId) {
      goToSource(note.annotationId);
    }
    // If only fullPageId: would need GET /full-page/:id for URL; leave for later
  }

  const api = sidebar as unknown as SidebarShellApi;
  api.__renderContent = (payload: { tabId: string; context: SidebarContext }) => {
    const main = api.__getMainContent?.();
    if (!main) return;
    if (payload.tabId === 'annotations') {
      renderAnnotationsTab(main, payload.context, {
        getStore: _getStore,
        getPageUrl: _getPageUrl,
        onGoToSource: goToSource,
      });
    } else if (payload.tabId === 'notes') {
      renderNotesTab(main, payload.context, {
        getStore: _getStore,
        getPageUrl: _getPageUrl,
        getNotesApi: _getNotesApi,
        onGoToSource: goToSourceFromNote,
        onRefresh: () => api.__refresh?.(),
      });
    } else if (payload.tabId === 'settings') {
      main.innerHTML = '';
      main.style.padding = '16px';
      main.style.color = '#6b7280';
      main.textContent = 'Loading…';
      Promise.resolve(_getPortalUrl?.()).then((url) => {
        renderSettingsTab(main, {
          portalUrl: url ?? '',
          onSidebarPrefsChanged: () => {
            window.dispatchEvent(new Event(SIDEBAR_POSITION_CHANGED_EVENT));
          },
        });
      });
    } else {
      main.innerHTML = '';
      main.style.padding = '16px';
      main.style.color = '#6b7280';
      main.style.fontSize = '14px';
      main.textContent = 'Coming soon';
    }
  };
  api.__refresh?.();

  let open = false;
  function setOpen(value: boolean): void {
    open = value;
    sidebar.style.display = value ? 'flex' : 'none';
    trigger.style.display = value ? 'none' : 'flex';
    if (value) api.__applyPosition?.();
  }


  const trigger = createTrigger({
    onOpen: () => setOpen(true),
    onClose: () => setOpen(false),
    getSide,
  });
  trigger.style.pointerEvents = 'auto';
  container.appendChild(trigger);

  window.addEventListener(SIDEBAR_POSITION_CHANGED_EVENT, () => {
    side = getSidebarPosition();
    (trigger as TriggerApi).__applyPosition?.();
    api.__applyPosition?.();
  });

  const pulseStyle = document.createElement('style');
  pulseStyle.textContent = `
    @keyframes annotator-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); }
      50% { box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.2); }
    }
    .annotator-highlight-pulse { animation: annotator-pulse 0.4s ease-out 2; }
  `;
  if (!document.getElementById('annotator-pulse-style')) {
    pulseStyle.id = 'annotator-pulse-style';
    document.head.appendChild(pulseStyle);
  }

  root.appendChild(container);

  const handle: AnnotatorUIHandle = {
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!open),
    isOpen: () => open,
  };
  (container as unknown as (HTMLElement & { __annotatorUIHandle: AnnotatorUIHandle })).__annotatorUIHandle = handle;
  return handle;
}
