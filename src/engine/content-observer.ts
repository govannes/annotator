/**
 * ContentObserver — persistent listener for SPA / dynamic content loading.
 *
 * Fires the callback immediately when a mutation batch crosses the
 * significance threshold. No debounce — the consumer is responsible
 * for guarding against concurrent work (e.g. a reattach-in-progress flag).
 *
 * Significance heuristic (from real ChatGPT SPA traces):
 *   - React reconciliation noise: +1 element, +0 text  → ignore
 *   - Real content drop:          +443 elements, +8 text → significant
 *
 * Thresholds (configurable):
 *   - minElements  (default 10)  — element count that counts as real content
 *   - minTextChars (default 20)  — text char count that counts as real content
 *   Either threshold being met makes the batch significant.
 *
 * History events (pushState / popstate) are always significant.
 * Network events (fetch / XHR) are logged but don't fire the callback
 * — the DOM mutations they cause will be caught by the MutationObserver.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type ContentEventKind =
  | 'mutation'           // DOM subtree changed (significant)
  | 'mutation-noise'     // DOM subtree changed (below threshold, logged only)
  | 'history-push'       // pushState / replaceState
  | 'history-pop'        // popstate (back/forward)
  | 'fetch-complete'     // fetch() resolved
  | 'xhr-complete';      // XMLHttpRequest loaded

export interface ContentEvent {
  kind: ContentEventKind;
  url: string;
  timestamp: number;
  detail?: string;
  /** true when the event should trigger reattachment */
  significant: boolean;
}

export interface ContentObserverConfig {
  /** Element to observe for DOM mutations (default: document.body) */
  root?: Element;
  /** Min added elements in a single MutationObserver batch to be "significant" (default: 10) */
  minElements?: number;
  /** Min added text chars in a single batch to be "significant" (default: 20) */
  minTextChars?: number;
  /** CSS selectors whose mutations we should ignore (our own UI) */
  ignoreSelectors?: string[];
  /** Called immediately when significant content is detected */
  onContent?: (event: ContentEvent) => void;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_MIN_ELEMENTS = 10;
const DEFAULT_MIN_TEXT_CHARS = 20;
const TAG = '[Highlighter][ContentObserver]';

// ─── Implementation ─────────────────────────────────────────────────────────

export class ContentObserver {
  private root: Element;
  private minElements: number;
  private minTextChars: number;
  private ignoreSelectors: string[];
  private onContent: ((event: ContentEvent) => void) | null;

  private mutationObserver: MutationObserver | null = null;
  private disposed = false;

  // Keep originals so we can restore on dispose
  private origPushState: History['pushState'] | null = null;
  private origReplaceState: History['replaceState'] | null = null;
  private origFetch: typeof window.fetch | null = null;
  private origXhrOpen: typeof XMLHttpRequest.prototype.open | null = null;
  private popstateHandler: ((e: PopStateEvent) => void) | null = null;

  constructor(config: ContentObserverConfig = {}) {
    this.root = config.root ?? document.body;
    this.minElements = config.minElements ?? DEFAULT_MIN_ELEMENTS;
    this.minTextChars = config.minTextChars ?? DEFAULT_MIN_TEXT_CHARS;
    this.ignoreSelectors = config.ignoreSelectors ?? [];
    this.onContent = config.onContent ?? null;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  start(): void {
    if (this.disposed) return;
    console.log(TAG, 'starting — watching for dynamic content',
      `(thresholds: ${this.minElements} els / ${this.minTextChars} chars)`);
    this.watchMutations();
    this.watchHistory();
    this.watchNetwork();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.mutationObserver?.disconnect();
    this.mutationObserver = null;

    this.restoreHistory();
    this.restoreNetwork();

    if (this.popstateHandler) {
      window.removeEventListener('popstate', this.popstateHandler);
    }

    console.log(TAG, 'disposed');
  }

  // ── DOM Mutation Watching ───────────────────────────────────────────────

  private watchMutations(): void {
    this.mutationObserver = new MutationObserver((mutations) => {
      if (this.disposed) return;

      // Filter out our own UI mutations
      const dominated = mutations.every((m) => this.isIgnored(m));
      if (dominated) return;

      // Count meaningful additions in this batch
      let addedElements = 0;
      let addedTextChars = 0;
      for (const m of mutations) {
        if (this.isIgnored(m)) continue;
        for (const n of m.addedNodes) {
          if (n.nodeType === Node.ELEMENT_NODE) addedElements++;
          if (n.nodeType === Node.TEXT_NODE) addedTextChars += (n.textContent?.length ?? 0);
        }
      }

      const significant = addedElements >= this.minElements || addedTextChars >= this.minTextChars;
      const detail = `${mutations.length} records, +${addedElements} els, +${addedTextChars} chars`;

      if (significant) {
        console.log(TAG, '▶ significant mutation —', detail);
        this.onContent?.({
          kind: 'mutation',
          significant: true,
          url: window.location.href,
          timestamp: Date.now(),
          detail,
        });
      } else {
        console.log(TAG, '⊘ noise —', detail);
      }
    });

    this.mutationObserver.observe(this.root, {
      childList: true,
      subtree: true,
    });
  }

  private isIgnored(record: MutationRecord): boolean {
    const check = (node: Node): boolean => {
      if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.TEXT_NODE) return false;
      const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
      if (!el) return false;
      return this.ignoreSelectors.some(
        (sel) => el.matches?.(sel) || el.closest?.(sel) != null,
      );
    };

    if (check(record.target)) return true;
    for (const n of record.addedNodes) if (!check(n)) return false;
    for (const n of record.removedNodes) if (!check(n)) return false;
    return record.addedNodes.length > 0 || record.removedNodes.length > 0;
  }

  // ── History API (SPA navigation) ────────────────────────────────────────

  private watchHistory(): void {
    this.origPushState = history.pushState.bind(history);
    this.origReplaceState = history.replaceState.bind(history);

    const self = this;

    history.pushState = function (...args: Parameters<History['pushState']>) {
      self.origPushState!(...args);
      const url = window.location.href;
      console.log(TAG, 'pushState →', url);
      self.emit({ kind: 'history-push', detail: url });
    };

    history.replaceState = function (...args: Parameters<History['replaceState']>) {
      self.origReplaceState!(...args);
      const url = window.location.href;
      console.log(TAG, 'replaceState →', url);
      self.emit({ kind: 'history-push', detail: url });
    };

    this.popstateHandler = () => {
      const url = window.location.href;
      console.log(TAG, 'popstate →', url);
      this.emit({ kind: 'history-pop', detail: url });
    };
    window.addEventListener('popstate', this.popstateHandler);
  }

  private restoreHistory(): void {
    if (this.origPushState) history.pushState = this.origPushState;
    if (this.origReplaceState) history.replaceState = this.origReplaceState;
  }

  // ── Network (fetch / XHR) — log only ──────────────────────────────────

  private watchNetwork(): void {
    this.origFetch = window.fetch.bind(window);
    const self = this;

    window.fetch = function (...args: Parameters<typeof fetch>) {
      const url = typeof args[0] === 'string'
        ? args[0]
        : args[0] instanceof Request
          ? args[0].url
          : String(args[0]);

      return self.origFetch!(...args).then((response) => {
        console.log(TAG, 'fetch complete →', url, `(${response.status})`);
        return response;
      });
    };

    this.origXhrOpen = XMLHttpRequest.prototype.open;
    const origOpen = this.origXhrOpen;

    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      this.addEventListener('load', () => {
        console.log(TAG, 'XHR complete →', method, String(url), `(${this.status})`);
      });
      // @ts-expect-error — rest spread for overloaded XHR open
      return origOpen.call(this, method, url, ...rest);
    };
  }

  private restoreNetwork(): void {
    if (this.origFetch) window.fetch = this.origFetch;
    if (this.origXhrOpen) XMLHttpRequest.prototype.open = this.origXhrOpen;
  }

  // ── Emit helper ───────────────────────────────────────────────────────

  private emit(partial: { kind: ContentEventKind; detail?: string }): void {
    if (this.disposed) return;

    const event: ContentEvent = {
      ...partial,
      significant: true,
      url: window.location.href,
      timestamp: Date.now(),
    };

    console.log(TAG, '▶ navigation —', event.kind, event.detail ?? '');
    this.onContent?.(event);
  }
}
