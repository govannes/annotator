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
const RETRY_DELAY_MS = 2500;
const REINJECT_DEBOUNCE_MS = 500;
const DYNAMIC_REATTACH_DEBOUNCE_MS = 800;

const DEBUG_REATTACH = true;
function reattachLog(msg: string, ...args: unknown[]): void {
  if (DEBUG_REATTACH && typeof console !== 'undefined' && console.log) {
    console.log('[Annotator reattach]', msg, ...args);
  }
}

function injectPanel(): boolean {
  if (document.getElementById(PANEL_ID)) return false;

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div id="annotator-extension-toolbar" style="
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 2147483647;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      background: #1a1a1a;
      color: #eee;
      padding: 10px 12px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      max-width: 320px;
    ">
      <div style="font-weight: 600; margin-bottom: 8px;">Annotator</div>
      <div style="margin-bottom: 6px;">
        <button type="button" id="add-annotation" style="
          padding: 6px 12px;
          margin-right: 6px;
          background: #2d7d46;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        ">Add annotation</button>
        <button type="button" id="test-reattach" style="
          padding: 6px 12px;
          margin-right: 6px;
          background: #333;
          color: #eee;
          border: 1px solid #555;
          border-radius: 6px;
          cursor: pointer;
        ">Re-attach</button>
        <button type="button" id="show-db" style="
          padding: 6px 12px;
          background: #444;
          color: #ccc;
          border: 1px solid #555;
          border-radius: 6px;
          cursor: pointer;
        ">Show DB</button>
      </div>
      <div id="add-annotation-result" style="margin-left: 4px; color: #8f8;"></div>
      <div id="test-reattach-result" style="margin-left: 4px; color: #8f8;"></div>
      <div id="annotator-status" style="margin-top: 6px; color: #999; font-size: 12px;">Loading…</div>
      <pre id="annotator-db-output" style="
        margin-top: 8px;
        padding: 8px;
        background: #222;
        color: #8f8;
        font-size: 11px;
        max-height: 200px;
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-all;
        border-radius: 4px;
        display: none;
      "></pre>
    </div>
  `;
  document.body.appendChild(panel);
  return true;
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
