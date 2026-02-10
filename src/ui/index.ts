/**
 * UI entry: mount floating trigger + sidebar shell.
 * Sidebar position and width from sidebar-prefs; Cmd/Ctrl+Shift+H toggles sidebar.
 */

import type { AnnotationStore } from '../api';
import { createSidebarShell, SIDEBAR_POSITION_CHANGED_EVENT } from './sidebar-shell';
import { createTrigger } from './trigger';

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
  const { getStore: _getStore, getPageUrl: _getPageUrl, root = document.body } = options;

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

  const sidebar = createSidebarShell({
    onClose: () => setOpen(false),
  });
  sidebar.style.display = 'none';
  sidebar.style.pointerEvents = 'auto';
  container.appendChild(sidebar);

  let open = false;
  function setOpen(value: boolean): void {
    open = value;
    sidebar.style.display = value ? 'flex' : 'none';
  }

  const trigger = createTrigger(() => setOpen(!open));
  trigger.style.pointerEvents = 'auto';
  container.appendChild(trigger);

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
