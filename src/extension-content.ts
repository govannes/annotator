/**
 * Browser extension content script: injects the annotator UI and runs the annotator on the page.
 * Built separately and loaded via manifest.json as the content_script.
 */

import { createBackendStore, createNotesApi, type AnnotationStore } from './api';
import { isContentScopedPage } from './core';
import { init, reattachHighlights } from './main';
import { mountAnnotatorUI } from './ui';

const DEFAULT_API_URL = 'http://localhost:3000';

async function getApiBaseUrl(): Promise<string> {
  if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
    const out = await chrome.storage.local.get('annotatorApiUrl');
    if (out.annotatorApiUrl && typeof out.annotatorApiUrl === 'string') return out.annotatorApiUrl;
  }
  return DEFAULT_API_URL;
}

let backendStorePromise: Promise<AnnotationStore> | null = null;
function getStore(): Promise<AnnotationStore> {
  if (!backendStorePromise) {
    backendStorePromise = getApiBaseUrl().then((baseUrl) => createBackendStore({ baseUrl }));
  }
  return backendStorePromise;
}

function getNotesApi() {
  return getApiBaseUrl().then((baseUrl) => createNotesApi(baseUrl));
}

/** Portal URL for "Go to portal" (full dashboard). Default '' = link hidden. Can be set in chrome.storage.local.annotatorPortalUrl. */
async function getPortalUrl(): Promise<string> {
  if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
    const out = await chrome.storage.local.get('annotatorPortalUrl');
    if (out.annotatorPortalUrl && typeof out.annotatorPortalUrl === 'string') return out.annotatorPortalUrl;
  }
  return '';
}

const PANEL_ID = 'annotator-extension-panel';
const TOOLBAR_ID = 'annotator-extension-toolbar';
const TOOLBAR_DRAG_HANDLE_ID = 'annotator-toolbar-drag-handle';
const TOOLBAR_OFFSET_STORAGE_KEY = 'annotatorToolbarOffsetX';
const RETRY_DELAY_MS = 2500;
const REINJECT_DEBOUNCE_MS = 500;
const DYNAMIC_REATTACH_DEBOUNCE_MS = 800;

const DEBUG_REATTACH = true;
function reattachLog(msg: string, ...args: unknown[]): void {
  if (DEBUG_REATTACH && typeof console !== 'undefined' && console.log) {
    console.log('[Annotator reattach]', msg, ...args);
  }
}

/** Material Icons (24px outline style) as inline SVG. */
const ICONS = {
  moreHoriz:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>',
  palette:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>',
  noteAdd:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 14H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
  highlight:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 14l3 3v4h6v-4l3-3V9H6v5zm2-3h8v2.17l-2.59 2.58L12 16l-1.41-1.41L8 13.17V11zM2 2v2h2v14h14v2h2v-2h2V4h2V2H2z"/></svg>',
  delete:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
};

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
        <button type="button" id="annotator-btn-color" class="annotator-toolbar-btn" title="Pick highlight color">${ICONS.palette}</button>
        <button type="button" id="add-annotation" class="annotator-toolbar-btn annotator-toolbar-btn-highlight" title="Highlight selection">${ICONS.highlight}</button>
        <button type="button" id="annotator-btn-note" class="annotator-toolbar-btn" title="Add note">${ICONS.noteAdd}</button>
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
    <div id="test-reattach-result" style="position:fixed;left:-9999px;pointer-events:none;" aria-hidden="true"></div>
    <div id="annotator-status" style="position:fixed;bottom:60px;left:50%;transform:translateX(-50%);color:#999;font-size:12px;z-index:2147483646;pointer-events:none;"></div>
  `;
  document.body.appendChild(panel);
  setupToolbarDrag();
  setupToolbarColorPicker();
  return true;
}

function setupToolbarColorPicker(): void {
  const btn = document.getElementById('annotator-btn-color');
  if (!btn) return;

  const STORAGE_KEY = 'annotatorHighlightColor';
  const DEFAULT = 'rgba(255, 220, 0, 0.35)';

  function loadStored(): string {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v) return v;
    } catch (_) {}
    return DEFAULT;
  }

  function saveColor(c: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch (_) {}
    if (typeof window !== 'undefined') {
      (window as unknown as { __annotatorHighlightColor?: string }).__annotatorHighlightColor = c;
    }
  }

  saveColor(loadStored());

  btn.addEventListener('click', () => {
    if (typeof (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper !== 'undefined') {
      const EyeDropper = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
      const dropper = new EyeDropper();
      dropper.open()
        .then((result: { sRGBHex: string }) => {
          const hex = result.sRGBHex;
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          saveColor(`rgba(${r},${g},${b},0.35)`);
        })
        .catch(() => {
          openFallbackColorPicker(saveColor);
        });
    } else {
      openFallbackColorPicker(saveColor);
    }
  });
}

function openFallbackColorPicker(saveColor: (c: string) => void): void {
  const input = document.createElement('input');
  input.type = 'color';
  input.value = '#ffdc00';
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  input.style.top = '0';
  document.body.appendChild(input);
  input.click();
  input.addEventListener('change', () => {
    const hex = input.value;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    saveColor(`rgba(${r},${g},${b},0.35)`);
    document.body.removeChild(input);
  });
  input.addEventListener('blur', () => {
    if (input.parentNode) document.body.removeChild(input);
  }, { once: true });
}

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

const extensionConfig = {
  get root() {
    return document.body;
  },
  getPageUrl: () => window.location.href,
  getStore,
};

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

/** Once true, we don't schedule reattach from mutations and we kill the observer (runs only once). */
let annotatingComplete = false;

let dynamicReattachTimeout: ReturnType<typeof setTimeout> | null = null;
let dynamicContentObserver: MutationObserver | null = null;
let dynamicContentObserveTarget: Element | null = null;

function describeNode(node: Node): string {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    const tag = el.tagName?.toLowerCase() ?? '?';
    const id = el.id ? `#${el.id}` : '';
    const cls = el.className && typeof el.className === 'string' ? `.${el.className.split(/\s+/)[0]}` : '';
    return `${tag}${id}${cls}`;
  }
  if (node.nodeType === Node.TEXT_NODE) return `#text(…${(node.textContent ?? '').slice(0, 20)})`;
  return `node(${node.nodeType})`;
}

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

/**
 * Run reattach with the dynamic-content observer disconnected so our own DOM
 * changes (clear + redraw highlights) don't trigger another reattach.
 * After the first run we set annotatingComplete and never reconnect the observer.
 */
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
    reattachLog('annotating complete — observer not reconnected (saves memory)');
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

/** True if node is or is inside our panel, UI (sidebar/trigger), or one of our highlight spans. */
function isOurMutation(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.TEXT_NODE) return false;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  if (!el) return false;
  return (
    el.id === PANEL_ID ||
    el.closest?.('#' + PANEL_ID) != null ||
    el.id === UI_CONTAINER_ID ||
    el.closest?.('#' + UI_CONTAINER_ID) != null ||
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
  const first = mutations[0];
  const targetDesc = first ? describeNode(first.target) : '?';
  const added = first?.addedNodes?.length ?? 0;
  const removed = first?.removedNodes?.length ?? 0;
  scheduleDynamicReattach(
    `saw ${mutations.length} mutation(s) from page (e.g. target=${targetDesc}, +${added}/-${removed} nodes)`
  );
}

const UI_CONTAINER_ID = 'annotator-ui-root';

function run(): void {
  const didInject = injectPanel();
  if (!didInject) return;
  annotatingComplete = false;
  init(extensionConfig);
  function injectAnnotatorUI(): void {
    const root = document.getElementById(UI_CONTAINER_ID);
    if (root) root.remove();
    mountAnnotatorUI({
      getStore: extensionConfig.getStore,
      getPageUrl: extensionConfig.getPageUrl,
      getNotesApi,
      getPortalUrl: () => getPortalUrl(),
      root: document.body,
    });
  }
  injectAnnotatorUI();
  reattachLog('initial retry scheduled in', RETRY_DELAY_MS, 'ms');
  setTimeout(() => runReattach('initial retry'), RETRY_DELAY_MS);
  watchForDynamicContent();
}

run();
// On SPAs (e.g. ChatGPT), the app often replaces document.body; re-inject the panel when it disappears
watchForPanelRemoval();
