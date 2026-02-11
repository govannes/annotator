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

// ----- Context selector (Step 3) -----

const CONTEXT_KEY = 'annotator-sidebar-context';
const CONTEXT_PROJECT_ID_KEY = 'annotator-sidebar-context-project-id';

export type SidebarContext = 'this-page' | 'this-project' | 'all-notes' | 'all-projects';

const DEFAULT_CONTEXT: SidebarContext = 'this-page';

export function getSidebarContext(): SidebarContext {
  if (typeof localStorage === 'undefined') return DEFAULT_CONTEXT;
  const raw = localStorage.getItem(CONTEXT_KEY);
  if (
    raw === 'this-page' ||
    raw === 'this-project' ||
    raw === 'all-notes' ||
    raw === 'all-projects'
  )
    return raw;
  return DEFAULT_CONTEXT;
}

export function setSidebarContext(context: SidebarContext): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(CONTEXT_KEY, context);
}

/** Selected project ID when context is "this-project". Stub until Projects tab exists. */
export function getSidebarContextProjectId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(CONTEXT_PROJECT_ID_KEY);
}

export function setSidebarContextProjectId(projectId: string | null): void {
  if (typeof localStorage === 'undefined') return;
  if (projectId === null) localStorage.removeItem(CONTEXT_PROJECT_ID_KEY);
  else localStorage.setItem(CONTEXT_PROJECT_ID_KEY, projectId);
}

// ----- Highlight / appearance (Settings tab) -----

const HIGHLIGHT_COLOR_KEY = 'annotator-highlight-color';

const DEFAULT_HIGHLIGHT_COLOR = 'rgba(255, 220, 0, 0.35)';

export function getHighlightColor(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_HIGHLIGHT_COLOR;
  const raw = localStorage.getItem(HIGHLIGHT_COLOR_KEY);
  return raw ?? DEFAULT_HIGHLIGHT_COLOR;
}

export function setHighlightColor(color: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(HIGHLIGHT_COLOR_KEY, color);
}

/** Preset highlight colors for the Settings tab. */
export const HIGHLIGHT_COLOR_PRESETS: { value: string; label: string }[] = [
  { value: 'rgba(255, 220, 0, 0.35)', label: 'Yellow' },
  { value: 'rgba(173, 216, 230, 0.6)', label: 'Light blue' },
  { value: 'rgba(144, 238, 144, 0.5)', label: 'Light green' },
  { value: 'rgba(255, 182, 193, 0.5)', label: 'Pink' },
  { value: 'rgba(221, 160, 221, 0.5)', label: 'Plum' },
];
