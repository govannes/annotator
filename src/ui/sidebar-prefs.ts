/**
 * Sidebar preferences (position, width), persisted in localStorage.
 * All UI lives under src/ui for clear separation from core/api.
 */

const POSITION_KEY = 'annotator-sidebar-position';
const WIDTH_KEY = 'annotator-sidebar-width';

export type SidebarPosition = 'left' | 'right';

/** Width presets in px: Small, Medium (default), Large. */
export const SIDEBAR_WIDTH_SMALL = 320;
export const SIDEBAR_WIDTH_MEDIUM = 420;
export const SIDEBAR_WIDTH_LARGE = 560;

const DEFAULT_POSITION: SidebarPosition = 'right';
const MIN_WIDTH = 280;
const MAX_WIDTH = 600;

export function getSidebarPosition(): SidebarPosition {
  if (typeof localStorage === 'undefined') return DEFAULT_POSITION;
  const raw = localStorage.getItem(POSITION_KEY);
  if (raw === 'left' || raw === 'right') return raw;
  return DEFAULT_POSITION;
}

export function setSidebarPosition(position: SidebarPosition): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(POSITION_KEY, position);
}

/** Current sidebar width in pixels. Clamped to [MIN_WIDTH, MAX_WIDTH]. */
export function getSidebarWidth(): number {
  if (typeof localStorage === 'undefined') return SIDEBAR_WIDTH_MEDIUM;
  const raw = localStorage.getItem(WIDTH_KEY);
  if (raw !== null) {
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
  }
  return SIDEBAR_WIDTH_MEDIUM;
}

export function setSidebarWidth(px: number): void {
  if (typeof localStorage === 'undefined') return;
  const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(px)));
  localStorage.setItem(WIDTH_KEY, String(clamped));
}

export function getSidebarWidthMin(): number {
  return MIN_WIDTH;
}

export function getSidebarWidthMax(): number {
  return MAX_WIDTH;
}
