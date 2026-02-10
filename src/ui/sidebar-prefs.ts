/**
 * Sidebar position preference (left | right), persisted in localStorage.
 * All UI lives under src/ui for clear separation from core/api.
 */

const STORAGE_KEY = 'annotator-sidebar-position';

export type SidebarPosition = 'left' | 'right';

const DEFAULT_POSITION: SidebarPosition = 'right';

export function getSidebarPosition(): SidebarPosition {
  if (typeof localStorage === 'undefined') return DEFAULT_POSITION;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === 'left' || raw === 'right') return raw;
  return DEFAULT_POSITION;
}

export function setSidebarPosition(position: SidebarPosition): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, position);
}
