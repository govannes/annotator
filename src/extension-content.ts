import { init, reattachHighlights } from './main';
import { PANEL_ID, DB_OVERLAY_ID, injectToolbar, setupShowDbButton } from './panel';

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
  const didInject = injectToolbar();
  if (didInject) {
    setupShowDbButton();
  }
  return didInject;
}

const extensionConfig = {
  get root() {
    return document.body;
  },
  getPageUrl: () => window.location.href,
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

let annotatingComplete = false;
let dynamicReattachTimeout: ReturnType<typeof setTimeout> | null = null;
let dynamicContentObserver: MutationObserver | null = null;
let dynamicContentObserveTarget: Element | null = null;

function scheduleDynamicReattach(reason: string): void {
  if (annotatingComplete) {
    reattachLog('skip schedule: annotating complete');
    return;
  }
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
  const body = document.body;
  dynamicContentObserveTarget = body;
  dynamicContentObserver = new MutationObserver(dynamicContentCallback);
  dynamicContentObserver.observe(body, {
    childList: true,
    subtree: true,
  });
  reattachLog('MutationObserver active on document.body');
}

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
