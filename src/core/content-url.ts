/**
 * Derive a stable content URL from the DOM so annotations can be tied to a
 * specific block (tweet, post, article, etc.) on any dynamic page. We walk up
 * from the selection and look for: permalink-style links, element id, or
 * data-* attributes that identify the content block.
 */

/**
 * Resolve a possibly relative URL to an absolute URL using the current origin.
 */
export function toAbsoluteUrl(href: string): string {
  if (typeof window === 'undefined') return href;
  try {
    return new URL(href, window.location.origin).href;
  } catch {
    return href;
  }
}

/** Path segments that often indicate a content permalink (post, article, thread, etc.). */
const PERMALINK_PATH_PATTERNS = [
  '/status/',
  '/post/',
  '/posts/',
  '/p/',
  '/article/',
  '/articles/',
  '/a/',
  '/questions/',
  '/item',
  '/comments/',
  '/comment/',
  '/t/',
  '/r/',
  '/thread/',
  '/message/',
  '/m/',
  '/story/',
  '/note/',
  '/notes/',
  '/statuses/',
  '/tweet/',
  '/reply/',
  '/replies/',
  '/discussion/',
  '/topic/',
  '/topics/',
];

function isPermalinkStyleHref(href: string): boolean {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) {
    return false;
  }
  try {
    const url = new URL(href, typeof window !== 'undefined' ? window.location.origin : undefined);
    const path = url.pathname;
    return PERMALINK_PATH_PATTERNS.some((p) => path.includes(p)) || path.split('/').filter(Boolean).length >= 2;
  } catch {
    return false;
  }
}

/** Generic ids we don't use as content keys (layout/app shells). */
const GENERIC_IDS = new Set([
  'app', 'root', 'main', 'content', 'wrapper', 'container', 'layout',
  'page', 'body', 'header', 'footer', 'nav', 'sidebar', 'menu', 'modal',
  'dialog', 'overlay', 'panel', 'toolbar', 'editor', 'view', 'screen',
]);

/** data-* attribute names that often hold a content or item identifier. */
const DATA_ID_ATTRS = [
  'data-id', 'data-post-id', 'data-item-id', 'data-article-id', 'data-status-id',
  'data-url', 'data-permalink', 'data-href', 'data-comment-id', 'data-tweet-id',
  'data-message-id', 'data-thread-id', 'data-slug',
];

/**
 * Get a stable content URL/key for an element by looking at:
 * 1) A permalink-style link inside (or on) the element
 * 2) The element's id (if not generic)
 * 3) data-* attributes that look like an id or URL
 */
/**
 * Get a stable content URL for an element: permalink-style link (in or on the element),
 * element id, or data-* attributes. When preferPageUrl is true (for a block), prefer a link
 * that matches the current page so we identify the block we're on, not a link inside it.
 */
function getContentUrlForElement(
  el: Element,
  options?: { preferPageUrl?: boolean }
): string | null {
  if (el.nodeType !== Node.ELEMENT_NODE) return null;

  const base = typeof window !== 'undefined' ? window.location.href.split('#')[0]! : '';

  if (options?.preferPageUrl && typeof window !== 'undefined') {
    const links = el.querySelectorAll('a[href]');
    for (const link of links) {
      const href = link.getAttribute('href');
      if (href && isPermalinkStyleHref(href)) {
        const abs = toAbsoluteUrl(href);
        if (abs === base || abs.startsWith(base + '?')) return abs;
      }
    }
    return null;
  }

  const link = el.tagName === 'A' ? (el as HTMLAnchorElement) : el.querySelector('a[href]');
  const href = link?.getAttribute?.('href');
  if (href && isPermalinkStyleHref(href)) return toAbsoluteUrl(href);

  const id = el.getAttribute?.('id');
  if (id && !GENERIC_IDS.has(id.toLowerCase())) return `${base}#${id}`;

  for (const attr of DATA_ID_ATTRS) {
    const val = el.getAttribute?.(attr);
    if (val == null || val === '') continue;
    if (attr === 'data-url' || attr === 'data-permalink' || attr === 'data-href') {
      return toAbsoluteUrl(val);
    }
    return `${base}#${attr}=${val}`;
  }

  return null;
}

/** Walk up from a node and return the nearest block (article, tweet, etc.) ancestor, or null. */
function findNearestBlockAncestor(node: Node): Element | null {
  let n: Node | null = node;
  while (n) {
    if (n.nodeType === Node.ELEMENT_NODE && isBlockLike(n as Element)) return n as Element;
    n = n.parentNode;
  }
  return null;
}

/**
 * Walk up from the selection and return a URL that identifies the content block.
 * - If the selection is inside a block (article, tweet, etc.), we use that block's URL and
 *   prefer a link that matches the current page (so we get the tweet we're on, not a link in the text).
 * - Otherwise we return the first ancestor with an id or permalink-style link.
 * Returns null if none found (caller uses page URL for source).
 */
export function getContentUrlFromRange(range: Range, _root: Element): string | null {
  const block = findNearestBlockAncestor(range.startContainer);
  if (block) {
    const url = getContentUrlForElement(block, { preferPageUrl: true });
    if (url) return url;
    return null;
  }

  let node: Node | null = range.startContainer;
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const url = getContentUrlForElement(node as Element);
      if (url) return url;
    }
    node = node.parentNode;
  }
  return null;
}

/**
 * Heuristic: is this element a reasonable "block root" for content (e.g. article, post card)?
 */
function isBlockLike(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'article') return true;
  const role = el.getAttribute?.('role');
  if (role === 'article') return true;
  const testId = el.getAttribute?.('data-testid') ?? '';
  if (/tweet|post|article|card|item|comment|message|thread/.test(testId)) return true;
  return false;
}

/**
 * From a permalink link, walk up to find the nearest "block" ancestor to use as root.
 */
function getBlockRootForLink(link: Element): Element {
  let el: Element | null = link;
  let best: Element = link;
  while (el) {
    if (isBlockLike(el)) best = el;
    const parent: Element | null = el.parentElement;
    if (!parent || parent.tagName === 'BODY') return best;
    el = parent;
  }
  return best;
}

/**
 * Discover all visible content blocks and their content URL.
 * - Finds permalink-style links, then uses their block ancestor as root.
 * - Finds elements with a non-generic id and uses pageUrl#id.
 */
export function getContentRoots(root: Element): { contentUrl: string; blockRoot: Element }[] {
  const seen = new Map<string, Element>();
  const base = typeof window !== 'undefined' ? window.location.href.split('#')[0]! : '';

  const links = root.querySelectorAll('a[href]');
  for (const link of links) {
    const href = link.getAttribute('href');
    if (!href || !isPermalinkStyleHref(href)) continue;
    const contentUrl = toAbsoluteUrl(href);
    const blockRoot = getBlockRootForLink(link);
    const existing = seen.get(contentUrl);
    if (!existing) {
      seen.set(contentUrl, blockRoot);
    } else if (existing.contains(blockRoot)) {
      seen.set(contentUrl, blockRoot);
    }
  }

  const withId = root.querySelectorAll('[id]');
  for (const el of withId) {
    const id = el.getAttribute('id');
    if (!id || GENERIC_IDS.has(id.toLowerCase())) continue;
    const contentUrl = `${base}#${id}`;
    if (!seen.has(contentUrl)) seen.set(contentUrl, el);
  }

  return Array.from(seen.entries(), ([contentUrl, blockRoot]) => ({ contentUrl, blockRoot }));
}

/**
 * Whether to use content-scoped behavior (find content URLs, re-attach per block).
 * We always try on any page so dynamic sites work without a hardcoded list.
 */
export function isContentScopedPage(): boolean {
  return true;
}
