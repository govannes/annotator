export function toAbsoluteUrl(href: string): string {
  if (typeof window === 'undefined') return href;
  try {
    return new URL(href, window.location.origin).href;
  } catch {
    return href;
  }
}

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

const GENERIC_IDS = new Set([
  'app', 'root', 'main', 'content', 'wrapper', 'container', 'layout',
  'page', 'body', 'header', 'footer', 'nav', 'sidebar', 'menu', 'modal',
  'dialog', 'overlay', 'panel', 'toolbar', 'editor', 'view', 'screen',
]);

const DATA_ID_ATTRS = [
  'data-id', 'data-post-id', 'data-item-id', 'data-article-id', 'data-status-id',
  'data-url', 'data-permalink', 'data-href', 'data-comment-id', 'data-tweet-id',
  'data-message-id', 'data-thread-id', 'data-slug',
];

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

function findNearestBlockAncestor(node: Node): Element | null {
  let n: Node | null = node;
  while (n) {
    if (n.nodeType === Node.ELEMENT_NODE && isBlockLike(n as Element)) return n as Element;
    n = n.parentNode;
  }
  return null;
}

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

export function isContentScopedPage(): boolean {
  return true;
}
