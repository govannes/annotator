import type { ElementSelector } from '../../types';

const TEXT_SNIPPET_LENGTH = 100;
const CAPTURED_ATTRS = ['id', 'class', 'src', 'href', 'alt', 'name', 'role', 'type', 'aria-label'];

/** Build an `ElementSelector` that uniquely identifies a DOM element for re-anchoring. */
export function buildElementSelector(element: Element, root: Element): ElementSelector {
  return {
    cssPath: buildCssPath(element, root),
    xpath: buildXPath(element, root),
    tagName: element.tagName,
    attributes: captureAttributes(element),
    textSnippet: (element.textContent ?? '').trim().slice(0, TEXT_SNIPPET_LENGTH) || undefined,
  };
}

/** Resolve an `ElementSelector` back to a live DOM element, trying multiple strategies. */
export function resolveElementSelector(sel: ElementSelector, root: Element): Element | null {
  return resolveByCssPath(sel, root)
    ?? resolveByXPath(sel, root)
    ?? resolveByAttributes(sel, root);
}

// ─── CSS path ────────────────────────────────────────────────────────────────

function buildCssPath(el: Element, root: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current !== root) {
    parts.unshift(cssSelectorSegment(current));
    current = current.parentElement;
  }
  return parts.join(' > ');
}

function cssSelectorSegment(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${CSS.escape(el.id)}`;

  const parent = el.parentElement;
  if (!parent) return tag;

  const siblings = Array.from(parent.children).filter(
    (s) => s.tagName === el.tagName,
  );
  if (siblings.length === 1) return tag;

  const idx = siblings.indexOf(el) + 1;
  return `${tag}:nth-of-type(${idx})`;
}

// ─── XPath ───────────────────────────────────────────────────────────────────

function buildXPath(el: Element, root: Element): string {
  const segs: string[] = [];
  let current: Element | null = el;
  while (current && current !== root) {
    const tag = current.tagName.toLowerCase();
    const parentNode: ParentNode | null = current.parentNode;
    if (!parentNode) break;
    const children = Array.from(parentNode.childNodes);
    const sameTag: Element[] = children.filter(
      (n): n is Element => n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName.toLowerCase() === tag,
    );
    segs.unshift(`${tag}[${sameTag.indexOf(current) + 1}]`);
    current = parentNode.nodeType === Node.ELEMENT_NODE ? (parentNode as Element) : null;
  }
  return segs.join('/');
}

// ─── Attribute capture ───────────────────────────────────────────────────────

function captureAttributes(el: Element): Record<string, string> | undefined {
  const attrs: Record<string, string> = {};
  for (const name of CAPTURED_ATTRS) {
    const v = el.getAttribute(name);
    if (v != null && v !== '') attrs[name] = v;
  }
  return Object.keys(attrs).length > 0 ? attrs : undefined;
}

// ─── Resolve strategies ──────────────────────────────────────────────────────

function resolveByCssPath(sel: ElementSelector, root: Element): Element | null {
  try {
    const el = root.querySelector(sel.cssPath);
    if (el && el.tagName === sel.tagName) return el;
  } catch { /* invalid selector — fall through */ }
  return null;
}

function resolveByXPath(sel: ElementSelector, root: Element): Element | null {
  const segments = sel.xpath.split('/').filter(Boolean);
  let current: Element | null = root;
  for (const seg of segments) {
    if (!current) return null;
    const match = seg.match(/^([a-zA-Z][a-zA-Z0-9-]*)\[(\d+)\]$/);
    if (!match) return null;
    const tag = match[1]!.toLowerCase();
    const idx = parseInt(match[2]!, 10);
    if (idx < 1) return null;
    const children = Array.from(current.childNodes);
    const sameTag: Element[] = children.filter(
      (n): n is Element => n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName.toLowerCase() === tag,
    );
    current = sameTag[idx - 1] ?? null;
  }
  return current && current.tagName === sel.tagName ? current : null;
}

function resolveByAttributes(sel: ElementSelector, root: Element): Element | null {
  if (!sel.attributes) return null;

  if (sel.attributes['id']) {
    const el = root.querySelector(`#${CSS.escape(sel.attributes['id'])}`);
    if (el && el.tagName === sel.tagName) return el;
  }

  if (sel.attributes['src']) {
    const el = root.querySelector(`${sel.tagName.toLowerCase()}[src="${CSS.escape(sel.attributes['src'])}"]`);
    if (el) return el;
  }

  const candidates = root.querySelectorAll(sel.tagName.toLowerCase());
  for (const el of candidates) {
    if (matchesAttributes(el, sel.attributes)) return el;
  }
  return null;
}

function matchesAttributes(el: Element, attrs: Record<string, string>): boolean {
  let matches = 0;
  let total = 0;
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') continue;
    total++;
    if (el.getAttribute(k) === v) matches++;
  }
  return total > 0 && matches === total;
}
