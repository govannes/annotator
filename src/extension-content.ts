/**
 * Browser extension content script: injects a floating 3-button toolbar and
 * runs the annotator on the page using localStorage for persistence.
 *
 * Buttons: Anchor (highlight selection), Show DB (view stored annotations), Delete (remove selected highlight).
 * Built separately and loaded via manifest.json as the content_script.
 */

import { createLocalStore, type AnnotationStore } from './api';
import { isContentScopedPage } from './core';
import { init, reattachHighlights } from './main';

// ---------------------------------------------------------------------------
// Store (localStorage)
// ---------------------------------------------------------------------------

let storeInstance: AnnotationStore | null = null;
function getStore(): Promise<AnnotationStore> {
  if (!storeInstance) storeInstance = createLocalStore();
  return Promise.resolve(storeInstance);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PANEL_ID = 'annotator-extension-panel';
const TOOLBAR_ID = 'annotator-extension-toolbar';
const TOOLBAR_DRAG_HANDLE_ID = 'annotator-toolbar-drag-handle';
const TOOLBAR_OFFSET_STORAGE_KEY = 'annotatorToolbarOffsetX';
const DB_OVERLAY_ID = 'annotator-db-overlay';
const RETRY_DELAY_MS = 2500;
const REINJECT_DEBOUNCE_MS = 500;
const DYNAMIC_REATTACH_DEBOUNCE_MS = 800;

const DEBUG_REATTACH = true;
function reattachLog(msg: string, ...args: unknown[]): void {
  if (DEBUG_REATTACH && typeof console !== 'undefined' && console.log) {
    console.log('[Annotator reattach]', msg, ...args);
  }
}

// ---------------------------------------------------------------------------
// Icons (Material 24px outline as inline SVG)
// ---------------------------------------------------------------------------

const ICONS = {
  moreHoriz:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>',
  highlight:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 14l3 3v4h6v-4l3-3V9H6v5zm2-3h8v2.17l-2.59 2.58L12 16l-1.41-1.41L8 13.17V11zM2 2v2h2v14h14v2h2v-2h2V4h2V2H2z"/></svg>',
  database:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><ellipse cx="12" cy="5.5" rx="8" ry="3.5"/><path d="M4 5.5v4c0 1.93 3.58 3.5 8 3.5s8-1.57 8-3.5v-4c0 1.93-3.58 3.5-8 3.5S4 7.43 4 5.5z"/><path d="M4 9.5v4c0 1.93 3.58 3.5 8 3.5s8-1.57 8-3.5v-4c0 1.93-3.58 3.5-8 3.5S4 11.43 4 9.5z"/><path d="M4 13.5v4c0 1.93 3.58 3.5 8 3.5s8-1.57 8-3.5v-4c0 1.93-3.58 3.5-8 3.5S4 15.43 4 13.5z"/></svg>',
  delete:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
};

// ---------------------------------------------------------------------------
// Inject floating toolbar
// ---------------------------------------------------------------------------

function injectPanel(): boolean {
  if (document.getElementById(PANEL_ID)) return false;

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = `
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
  document.body.appendChild(panel);
  setupToolbarDrag();
  setupShowDbButton();
  return true;
}

// ---------------------------------------------------------------------------
// Show DB overlay
// ---------------------------------------------------------------------------

function setupShowDbButton(): void {
  const btn = document.getElementById('annotator-btn-showdb');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    // Toggle: if overlay exists, close it
    const existing = document.getElementById(DB_OVERLAY_ID);
    if (existing) {
      existing.remove();
      return;
    }

    const store = await getStore();
    const all = await store.load();
    const pageUrl = window.location.href;
    const pageAnnotations = all.filter(
      (a) => a.pageUrl === pageUrl || a.target?.source === pageUrl
    );

    const overlay = document.createElement('div');
    overlay.id = DB_OVERLAY_ID;
    overlay.style.cssText = `
      position: fixed;
      bottom: 70px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      background: #1e1e1e;
      color: #d4d4d4;
      border: 1px solid #333;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      font-family: 'SF Mono', Monaco, Consolas, monospace;
      font-size: 12px;
      max-width: 600px;
      width: 90vw;
      max-height: 50vh;
      overflow-y: auto;
      padding: 16px;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #333;
    `;
    header.innerHTML = `
      <span style="font-family: system-ui, sans-serif; font-size: 13px; font-weight: 600; color: #eee;">
        Annotations DB (${pageAnnotations.length} on this page, ${all.length} total)
      </span>
      <button id="annotator-db-close" style="
        background: none; border: none; color: #888; cursor: pointer;
        font-size: 18px; line-height: 1; padding: 4px 8px; border-radius: 4px;
      ">&times;</button>
    `;
    overlay.appendChild(header);

    if (pageAnnotations.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'text-align: center; padding: 20px; color: #666; font-family: system-ui, sans-serif;';
      empty.textContent = 'No annotations for this page.';
      overlay.appendChild(empty);
    } else {
      for (const ann of pageAnnotations) {
        const card = document.createElement('div');
        card.style.cssText = `
          background: #2a2a2a;
          border: 1px solid #3a3a3a;
          border-radius: 8px;
          padding: 10px 12px;
          margin-bottom: 8px;
        `;
        const quote = ann.target?.selector?.textQuote?.exact ?? '(no quote)';
        const truncated = quote.length > 80 ? quote.slice(0, 80) + '...' : quote;
        const created = ann.created ? new Date(ann.created).toLocaleString() : 'unknown';
        card.innerHTML = `
          <div style="color: #e0e0e0; margin-bottom: 4px; font-family: system-ui, sans-serif; font-size: 13px;">"${escapeHtml(truncated)}"</div>
          <div style="color: #888; font-size: 11px;">
            <span>id: ${escapeHtml(ann.id.slice(0, 8))}...</span>
            <span style="margin-left: 8px;">created: ${escapeHtml(created)}</span>
            ${ann.highlightColor ? `<span style="margin-left: 8px; display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${ann.highlightColor}; vertical-align: middle;"></span>` : ''}
          </div>
        `;
        overlay.appendChild(card);
      }
    }

    document.body.appendChild(overlay);

    // Close button
    const closeBtn = document.getElementById('annotator-db-close');
    closeBtn?.addEventListener('click', () => overlay.remove());

    // Close on click outside
    function onClickOutside(e: MouseEvent): void {
      if (!overlay.contains(e.target as Node) && (e.target as Element)?.id !== 'annotator-btn-showdb') {
        overlay.remove();
        document.removeEventListener('click', onClickOutside, true);
      }
    }
    setTimeout(() => document.addEventListener('click', onClickOutside, true), 0);
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Toolbar drag
// ---------------------------------------------------------------------------

function setupToolbarDrag(): void {
  const toolbar = document.getElementById(TOOLBAR_ID);
  const handle = document.getElementById(TOOLBAR_DRAG_HANDLE_ID);
  if (!toolbar || !handle) return;

  const toolbarEl = toolbar;
  const storageKey = TOOLBAR_OFFSET_STORAGE_KEY;
  const pageKey = `${storageKey}_${window.location.hostname}`;

  function getStoredOffset(): number {
    try {
      const v = localStorage.getItem(pageKey);
      if (v != null) return parseInt(v, 10) || 0;
    } catch (_) {}
    return 0;
  }

  function setOffsetPx(px: number): void {
    toolbarEl.style.setProperty('--annotator-toolbar-offset-x', `${px}px`);
    try {
      localStorage.setItem(pageKey, String(px));
    } catch (_) {}
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
// Extension config
// ---------------------------------------------------------------------------

const extensionConfig = {
  get root() {
    return document.body;
  },
  getPageUrl: () => window.location.href,
  getStore,
};

// ---------------------------------------------------------------------------
// Re-inject if panel is removed (SPA navigation)
// ---------------------------------------------------------------------------

let reinjectTimeout: ReturnType<typeof setTimeout> | null = null;

function scheduleReinject(): void {
  if (reinjectTimeout) return;
  reinjectTimeout = setTimeout(() => {
    reinjectTimeout = null;
    if (document.getElementById(PANEL_ID)) return;
    run();
  }, REINJECT_DEBOUNCE_MS);
}

function watchForPanelRemoval(): void {
  const observer = new MutationObserver(() => {
    if (!document.getElementById(PANEL_ID)) scheduleReinject();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

// ---------------------------------------------------------------------------
// Dynamic content reattach (for SPAs that load content after initial render)
// ---------------------------------------------------------------------------

let annotatingComplete = false;
let dynamicReattachTimeout: ReturnType<typeof setTimeout> | null = null;
let dynamicContentObserver: MutationObserver | null = null;
let dynamicContentObserveTarget: Element | null = null;

function scheduleDynamicReattach(reason: string): void {
  if (annotatingComplete) {
    reattachLog('skip schedule: annotating complete');
    return;
  }
  if (!isContentScopedPage()) return;
  if (dynamicReattachTimeout) clearTimeout(dynamicReattachTimeout);
  reattachLog('scheduling reattach in', DYNAMIC_REATTACH_DEBOUNCE_MS, 'ms —', reason);
  dynamicReattachTimeout = setTimeout(() => {
    dynamicReattachTimeout = null;
    runReattach('mutation');
  }, DYNAMIC_REATTACH_DEBOUNCE_MS);
}

async function runReattach(trigger: string): Promise<void> {
  reattachLog('running reattach now (trigger:', trigger + ')');
  if (dynamicContentObserver && dynamicContentObserveTarget) {
    dynamicContentObserver.disconnect();
    dynamicContentObserver = null;
    reattachLog('observer disconnected for reattach');
  }
  try {
    await reattachHighlights(extensionConfig);
  } finally {
    annotatingComplete = true;
    if (dynamicReattachTimeout) {
      clearTimeout(dynamicReattachTimeout);
      dynamicReattachTimeout = null;
    }
    dynamicContentObserveTarget = null;
    reattachLog('annotating complete — observer not reconnected');
  }
}

function watchForDynamicContent(): void {
  if (!isContentScopedPage()) return;
  const body = document.body;
  dynamicContentObserveTarget = body;
  dynamicContentObserver = new MutationObserver(dynamicContentCallback);
  dynamicContentObserver.observe(body, {
    childList: true,
    subtree: true,
  });
  reattachLog('MutationObserver active on document.body');
}

/** True if node is or is inside our panel or one of our highlight spans. */
function isOurMutation(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.TEXT_NODE) return false;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  if (!el) return false;
  return (
    el.id === PANEL_ID ||
    el.closest?.('#' + PANEL_ID) != null ||
    el.id === DB_OVERLAY_ID ||
    el.closest?.('#' + DB_OVERLAY_ID) != null ||
    el.classList?.contains?.('annotator-highlight') ||
    el.closest?.('.annotator-highlight') != null
  );
}

function dynamicContentCallback(mutations: MutationRecord[]): void {
  const fromUs = mutations.every((m) => {
    if (isOurMutation(m.target)) return true;
    for (const n of m.addedNodes) if (isOurMutation(n)) return true;
    for (const n of m.removedNodes) if (isOurMutation(n)) return true;
    return false;
  });
  if (fromUs) {
    reattachLog('skip reattach: all', mutations.length, 'mutation(s) are from our panel/highlights');
    return;
  }
  scheduleDynamicReattach(`saw ${mutations.length} mutation(s) from page`);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function run(): void {
  const didInject = injectPanel();
  if (!didInject) return;
  annotatingComplete = false;
  init(extensionConfig);
  reattachLog('initial retry scheduled in', RETRY_DELAY_MS, 'ms');
  setTimeout(() => runReattach('initial retry'), RETRY_DELAY_MS);
  watchForDynamicContent();
}

run();
watchForPanelRemoval();
