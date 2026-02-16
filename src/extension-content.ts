import './style.css';
import { init, reattachHighlights } from './main';
import { PANEL_ID, DB_OVERLAY_ID, injectToolbar, setupShowDbButton } from './panel';
import { ContentObserver, ContentEvent } from './engine/content-observer';

const REINJECT_DEBOUNCE_MS = 500;

const TAG = '[Annotator]';

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

// ─── Reattach (observer-driven, repeatable) ─────────────────────────────────

let reattaching = false;

async function handleContentEvent(event: ContentEvent): Promise<void> {
  console.log(
    TAG,
    `content event: ${event.kind}`,
    event.significant ? '(significant)' : '(noise)',
    event.detail ?? '',
    `→ ${event.url}`,
  );

  if (!event.significant) return;

  if (reattaching) {
    console.log(TAG, 'reattach already in progress — skipping');
    return;
  }

  reattaching = true;
  try {
    console.log(TAG, `reattach triggered by ${event.kind}`);
    await reattachHighlights(extensionConfig);
  } catch (e) {
    console.error(TAG, 'reattach failed:', e);
  } finally {
    reattaching = false;
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
