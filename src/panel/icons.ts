/**
 * SVG icon markup shared across panels.
 * Stroke-based, 24×24 viewBox, matching the Feather/Lucide style used in the toolbar.
 */

const STROKE_ATTRS = 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';

export const ICONS = {
  dragIndicator:
    `<svg viewBox="0 0 24 24" width="14" height="14" ${STROKE_ATTRS}><circle cx="9" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1" fill="currentColor" stroke="none"/></svg>`,
  check:
    `<svg viewBox="0 0 24 24" width="14" height="14" ${STROKE_ATTRS}><polyline points="20 6 9 17 4 12"/></svg>`,
  trash:
    `<svg viewBox="0 0 24 24" width="14" height="14" ${STROKE_ATTRS}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
} as const;
