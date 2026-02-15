/**
 * Toolbar injection, CSS, and drag-to-reposition behaviour.
 *
 * `injectToolbar()` creates the floating toolbar DOM and wires up the drag
 * handle. It returns `true` the first time it injects (i.e. the panel didn't
 * already exist), `false` otherwise.
 */

import {
  PANEL_ID,
  TOOLBAR_ID,
  TOOLBAR_DRAG_HANDLE_ID,
  TOOLBAR_OFFSET_STORAGE_KEY,
} from './constants';
import { ICONS } from './icons';

// ---------------------------------------------------------------------------
// Toolbar HTML + CSS
// ---------------------------------------------------------------------------

function buildToolbarHTML(): string {
  return `
    <div id="${TOOLBAR_ID}" style="
      position: fixed;
      left: 50%;
      bottom: 16px;
      z-index: 2147483647;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      transform: translateX(calc(-50% + var(--annotator-toolbar-offset-x, 0px)));
      display: flex;
      align-items: center;
      gap: 0;
      background: #1a1a1a;
      color: #eee;
      padding: 6px 4px 6px 2px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    ">
      <div id="${TOOLBAR_DRAG_HANDLE_ID}" style="
        cursor: grab;
        padding: 8px 6px;
        margin-right: 2px;
        border-radius: 8px;
        color: #888;
        display: flex;
        align-items: center;
        justify-content: center;
        user-select: none;
      " title="Drag to move toolbar">${ICONS.moreHoriz}</div>
      <div style="
        display: flex;
        align-items: center;
        gap: 2px;
        padding-left: 4px;
        border-left: 1px solid #333;
      ">
        <button type="button" id="add-annotation" class="annotator-toolbar-btn annotator-toolbar-btn-highlight" title="Highlight selection">${ICONS.highlight}</button>
        <button type="button" id="annotator-btn-showdb" class="annotator-toolbar-btn" title="Show annotations DB">${ICONS.database}</button>
        <button type="button" id="annotator-btn-delete" class="annotator-toolbar-btn" title="Delete selected highlight">${ICONS.delete}</button>
      </div>
    </div>
    <style>
      .annotator-toolbar-btn {
        width: 36px;
        height: 36px;
        padding: 0;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: #ccc;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .annotator-toolbar-btn:hover { background: #333; color: #eee; }
      .annotator-toolbar-btn:active { background: #444; }
      .annotator-toolbar-btn svg { width: 20px; height: 20px; }
      .annotator-toolbar-btn-highlight { color: #8bc34a; }
      .annotator-toolbar-btn-highlight:hover { background: #2d4a1a; color: #a5d6a7; }
    </style>
    <div id="add-annotation-result" style="position:fixed;left:-9999px;pointer-events:none;" aria-hidden="true"></div>
  `;
}

// ---------------------------------------------------------------------------
// Drag-to-reposition
// ---------------------------------------------------------------------------

function setupToolbarDrag(): void {
  const toolbar = document.getElementById(TOOLBAR_ID);
  const handle = document.getElementById(TOOLBAR_DRAG_HANDLE_ID);
  if (!toolbar || !handle) return;

  const pageKey = `${TOOLBAR_OFFSET_STORAGE_KEY}_${window.location.hostname}`;

  function getStoredOffset(): number {
    try {
      const v = localStorage.getItem(pageKey);
      if (v != null) return parseInt(v, 10) || 0;
    } catch (_) { /* ignore */ }
    return 0;
  }

  function setOffsetPx(px: number): void {
    toolbar!.style.setProperty('--annotator-toolbar-offset-x', `${px}px`);
    try {
      localStorage.setItem(pageKey, String(px));
    } catch (_) { /* ignore */ }
  }

  setOffsetPx(getStoredOffset());

  let startX = 0;
  let startOffset = 0;

  handle.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    startX = e.clientX;
    startOffset = getStoredOffset();
    handle.style.cursor = 'grabbing';

    const onMove = (e2: MouseEvent) => {
      const dx = e2.clientX - startX;
      setOffsetPx(startOffset + dx);
    };
    const onUp = () => {
      handle.style.cursor = 'grab';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Inject the annotator toolbar into the page.
 * Returns `true` if a fresh toolbar was injected, `false` if one already exists.
 */
export function injectToolbar(): boolean {
  if (document.getElementById(PANEL_ID)) return false;

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = buildToolbarHTML();
  document.body.appendChild(panel);

  setupToolbarDrag();
  return true;
}
