import { ContentEvent, ContentObserver } from './engine/content-observer';
import { hasPending, init, reattachHighlights, retryPending } from './main';
import { DB_OVERLAY_ID, injectToolbar, PANEL_ID, setupShowDbButton } from './panel';
import './style.css';

const REINJECT_DEBOUNCE_MS = 500;

const TAG = '[Highlighter][Annotator]';

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

// ─── Panel re-injection (unchanged) ─────────────────────────────────────────

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

// ─── Reattach scheduler (idle-aware, cooldown-paced) ────────────────────────
//
// Like a game loop: we never run reattach during busy frames. We wait for
// idle time, enforce a cooldown between runs, and coalesce events that
// arrive during the cooldown into a single follow-up.

const REATTACH_COOLDOWN_MS = 1500;

let reattaching = false;
let cooldownUntil = 0;       // timestamp — no reattach before this
let pendingReattach = false;  // something significant happened during cooldown
let pendingIsNav = false;     // queued event includes a navigation (needs full reload)
let cooldownTimer: ReturnType<typeof setTimeout> | null = null;

const isNavigation = (kind: string) => kind === 'history-push' || kind === 'history-pop';

function handleContentEvent(event: ContentEvent): void {
  console.log(
    TAG,
    `content event: ${event.kind}`,
    event.significant ? '(significant)' : '(noise)',
    event.detail ?? '',
    `→ ${event.url}`,
  );

  if (!event.significant) return;

  // Navigation always triggers a full reattach
  // DOM mutations only trigger work if we have pending (unanchored) annotations
  if (!isNavigation(event.kind) && !hasPending()) {
    console.log(TAG, 'mutation but no pending annotations — skipping');
    return;
  }

  if (reattaching) {
    console.log(TAG, 'reattach in progress — queued for after');
    pendingReattach = true;
    pendingIsNav = pendingIsNav || isNavigation(event.kind);
    return;
  }

  const now = Date.now();
  if (now < cooldownUntil) {
    if (!pendingReattach) {
      console.log(TAG, `cooldown active (${cooldownUntil - now}ms left) — queued`);
      pendingReattach = true;
      pendingIsNav = pendingIsNav || isNavigation(event.kind);
      scheduleCooldownFlush();
    }
    return;
  }

  scheduleIdleReattach(event.kind);
}

/** Wait for browser idle time, then run reattach. */
function scheduleIdleReattach(trigger: string): void {
  const schedule = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 0));
  schedule(() => {
    if (reattaching) {
      pendingReattach = true;
      return;
    }
    runReattach(trigger);
  });
}

/** If something was queued during cooldown, flush it when cooldown expires. */
function scheduleCooldownFlush(): void {
  if (cooldownTimer) return;
  const delay = Math.max(0, cooldownUntil - Date.now());
  cooldownTimer = setTimeout(() => {
    cooldownTimer = null;
    if (pendingReattach && !reattaching) {
      pendingReattach = false;
      scheduleIdleReattach('cooldown-flush');
    }
  }, delay);
}

async function runReattach(trigger: string): Promise<void> {
  reattaching = true;
  const fullReload = isNavigation(trigger);

  if (fullReload) {
    console.log(TAG, `full reattach (trigger: ${trigger})`);
  } else {
    console.log(TAG, `incremental retry (trigger: ${trigger})`);
  }

  try {
    if (fullReload) {
      await reattachHighlights(extensionConfig);
    } else {
      retryPending(extensionConfig);
    }
  } catch (e) {
    console.error(TAG, 'reattach failed:', e);
  } finally {
    reattaching = false;
    cooldownUntil = Date.now() + REATTACH_COOLDOWN_MS;

    if (pendingReattach) {
      const wasNav = pendingIsNav;
      pendingReattach = false;
      pendingIsNav = false;
      if (wasNav) {
        scheduleIdleReattach('history-push');
      } else {
        scheduleCooldownFlush();
      }
    }
  }
}

// ─── Content Observer (persistent, SPA-aware) ──────────────────────────────

let contentObserver: ContentObserver | null = null;

function startContentObserver(): void {
  contentObserver?.dispose();

  contentObserver = new ContentObserver({
    root: document.body,
    minElements: 10,
    minTextChars: 20,
    ignoreSelectors: [
      `#${PANEL_ID}`,
      `#${DB_OVERLAY_ID}`,
      '.annotator-highlight',
    ],
    onContent: handleContentEvent,
  });

  contentObserver.start();
}

// ─── Bootstrap ──────────────────────────────────────────────────────────────

function run(): void {
  const didInject = injectPanel();
  if (!didInject) return;

  init(extensionConfig);
  startContentObserver();
}

run();
watchForPanelRemoval();
