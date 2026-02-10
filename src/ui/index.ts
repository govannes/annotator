/**
 * UI entry: mount floating trigger + full-height sidebar.
 * All annotator UI lives under src/ui. Sidebar position (left/right) from localStorage.
 */

import type { AnnotationStore } from '../api';
import { createTrigger } from './trigger';
import { createSidebar, SIDEBAR_POSITION_CHANGED_EVENT } from './sidebar';

export { SIDEBAR_POSITION_CHANGED_EVENT };

const CONTAINER_ID = 'annotator-ui-root';

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
  const { getStore, getPageUrl, root = document.body } = options;

  const existing = document.getElementById(CONTAINER_ID) as (HTMLElement & { __annotatorUIHandle?: AnnotatorUIHandle }) | null;
  if (existing?.__annotatorUIHandle) return existing.__annotatorUIHandle;

  const container = document.createElement('div');
  container.id = CONTAINER_ID;
  container.style.cssText = 'position: relative; pointer-events: none;';
  (container as HTMLElement).style.pointerEvents = 'none';

  const sidebar = createSidebar({
    getStore,
    getPageUrl,
    onClose: () => setOpen(false),
  });
  sidebar.style.display = 'none';
  sidebar.style.pointerEvents = 'auto';
  container.appendChild(sidebar);

  let open = false;
  function setOpen(value: boolean): void {
    open = value;
    sidebar.style.display = value ? 'flex' : 'none';
    if (value) (sidebar as unknown as { loadAnnotations?: () => Promise<void> }).loadAnnotations?.();
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
