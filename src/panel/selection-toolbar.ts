import {
  ACTIVE_HIGHLIGHT_COLOR_KEY,
  SELECTION_TOOLBAR_ID,
  type HighlightColorEntry,
} from './constants';
import { getHighlightColors } from './palette-panel';
import { getShadowRoot } from './shadow-host';
import { getActiveMode, isHighlightDisabled } from './toolbar';
import { hideTooltip, showTooltip } from './ui-utils';

export type OnHighlightCallback = (range: Range, color: string) => void;

let onHighlight: OnHighlightCallback | null = null;
let activeColorId: string | null = null;
let toolbarEl: HTMLElement | null = null;
let savedRange: Range | null = null;

let boundMouseUp: ((e: MouseEvent) => void) | null = null;
let boundKeyUp: ((e: KeyboardEvent) => void) | null = null;
let boundMouseDown: ((e: MouseEvent) => void) | null = null;
let boundScroll: (() => void) | null = null;

function loadActiveColorId(): string {
  try {
    const stored = localStorage.getItem(ACTIVE_HIGHLIGHT_COLOR_KEY);
    if (stored) return stored;
  } catch { /* ignore */ }
  const colors = getHighlightColors();
  return colors[0]?.id ?? 'default';
}

function saveActiveColorId(id: string): void {
  activeColorId = id;
  try {
    localStorage.setItem(ACTIVE_HIGHLIGHT_COLOR_KEY, id);
  } catch { /* ignore */ }
}

function getActiveColor(colors: HighlightColorEntry[]): HighlightColorEntry {
  const id = loadActiveColorId();
  activeColorId = id;
  return colors.find((c) => c.id === id) ?? colors[0]!;
}

// ─── Toolbar positioning ────────────────────────────────────────────────────

function positionToolbar(el: HTMLElement, rect: DOMRect): void {
  const gap = 8;
  const elWidth = el.offsetWidth;
  const elHeight = el.offsetHeight;

  let left = rect.left + rect.width / 2 - elWidth / 2;
  left = Math.max(4, Math.min(left, window.innerWidth - elWidth - 4));

  let top = rect.top - elHeight - gap + window.scrollY;
  if (rect.top - elHeight - gap < 0) {
    top = rect.bottom + gap + window.scrollY;
  }

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function buildToolbar(): HTMLElement {
  const colors = getHighlightColors();
  const active = getActiveColor(colors);

  const container = document.createElement('div');
  container.id = SELECTION_TOOLBAR_ID;
  container.className =
    'an:fixed an:z-[2147483647] an:flex an:items-center an:gap-2 an:py-2 an:px-3 ' +
    'an:rounded-lg an:shadow-[0_4px_16px_rgba(0,0,0,0.24)] an:font-sans an:text-[13px] an:select-none';
  container.style.backgroundColor = '#333';
  container.style.color = '#fff';
  container.style.pointerEvents = 'auto';

  for (const entry of colors) {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className =
      'an:w-5 an:h-5 an:rounded-full an:border-none an:cursor-pointer an:shrink-0 ' +
      'an:transition-all an:duration-150 hover:an:scale-110';
    swatch.style.backgroundColor = entry.color;
    swatch.style.boxShadow =
      entry.id === active.id
        ? '0 0 0 2px #fff, 0 0 0 3px rgba(0,0,0,0.3)'
        : 'inset 0 0 0 1px rgba(255,255,255,0.25)';
    if (entry.id === active.id) {
      swatch.style.transform = 'scale(1.15)';
    }
    const label = entry.tag || entry.id;
    swatch.addEventListener('mouseenter', () => showTooltip(swatch, label));
    swatch.addEventListener('mouseleave', () => hideTooltip());
    swatch.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    swatch.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      saveActiveColorId(entry.id);
      refreshSwatches(container);
    });
    swatch.setAttribute('data-color-id', entry.id);
    container.appendChild(swatch);
  }

  const sep = document.createElement('div');
  sep.className = 'an:w-px an:h-4 an:mx-1 an:shrink-0';
  sep.style.backgroundColor = 'rgba(255,255,255,0.25)';
  container.appendChild(sep);

  const highlightBtn = document.createElement('button');
  highlightBtn.type = 'button';
  highlightBtn.className =
    'an:border-none an:cursor-pointer an:text-white an:text-[13px] an:font-medium ' +
    'an:bg-transparent an:px-2 an:py-1 an:rounded hover:an:bg-white/15 an:transition-colors an:whitespace-nowrap';
  highlightBtn.textContent = 'Highlight';
  highlightBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  highlightBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleHighlightClick();
  });
  container.appendChild(highlightBtn);

  return container;
}

function refreshSwatches(container: HTMLElement): void {
  const colors = getHighlightColors();
  const active = getActiveColor(colors);
  const swatches = container.querySelectorAll<HTMLElement>('[data-color-id]');
  swatches.forEach((swatch) => {
    const id = swatch.getAttribute('data-color-id');
    const isActive = id === active.id;
    swatch.style.boxShadow = isActive
      ? '0 0 0 2px #fff, 0 0 0 3px rgba(0,0,0,0.3)'
      : 'inset 0 0 0 1px rgba(255,255,255,0.25)';
    swatch.style.transform = isActive ? 'scale(1.15)' : '';
  });
}

function handleHighlightClick(): void {
  if (isHighlightDisabled()) return;
  if (!savedRange || !onHighlight) return;
  const colors = getHighlightColors();
  const active = getActiveColor(colors);
  const range = savedRange;
  hideSelectionToolbar();
  onHighlight(range, active.color);
  window.getSelection()?.removeAllRanges();
}

function isInsideExtension(node: Node): boolean {
  let el: Node | null = node;
  while (el) {
    if (el instanceof HTMLElement && el.id === 'annotator-shadow-host') {
      return true;
    }
    el = el.parentNode;
  }
  return false;
}

function showSelectionToolbar(): void {
  if (isHighlightDisabled() || getActiveMode() === 'ink') return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);
  if (isInsideExtension(range.commonAncestorContainer)) return;

  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return;

  savedRange = range.cloneRange();

  if (toolbarEl) toolbarEl.remove();

  if (!activeColorId) activeColorId = loadActiveColorId();

  toolbarEl = buildToolbar();
  getShadowRoot().appendChild(toolbarEl);

  positionToolbar(toolbarEl, rect);
}

export function hideSelectionToolbar(): void {
  hideTooltip();
  if (toolbarEl) {
    toolbarEl.remove();
    toolbarEl = null;
  }
  savedRange = null;
}

function onMouseUp(e: MouseEvent): void {
  const path = e.composedPath();
  if (toolbarEl && path.includes(toolbarEl)) return;

  setTimeout(() => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      if (!isInsideExtension(sel.getRangeAt(0).commonAncestorContainer)) {
        showSelectionToolbar();
        return;
      }
    }
    hideSelectionToolbar();
  }, 10);
}

function onKeyUp(_e: KeyboardEvent): void {
  setTimeout(() => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      if (!isInsideExtension(sel.getRangeAt(0).commonAncestorContainer)) {
        showSelectionToolbar();
        return;
      }
    }
    hideSelectionToolbar();
  }, 10);
}

function onMouseDown(e: MouseEvent): void {
  const path = e.composedPath();
  if (toolbarEl && path.includes(toolbarEl)) return;
  hideSelectionToolbar();
}

function onScroll(): void {
  hideSelectionToolbar();
}

export function initSelectionToolbar(callback: OnHighlightCallback): void {
  onHighlight = callback;
  activeColorId = loadActiveColorId();

  boundMouseUp = onMouseUp;
  boundKeyUp = onKeyUp;
  boundMouseDown = onMouseDown;
  boundScroll = onScroll;

  document.addEventListener('mouseup', boundMouseUp, true);
  document.addEventListener('keyup', boundKeyUp, true);
  document.addEventListener('mousedown', boundMouseDown, true);
  window.addEventListener('scroll', boundScroll, true);
}

export function destroySelectionToolbar(): void {
  hideSelectionToolbar();
  onHighlight = null;

  if (boundMouseUp) document.removeEventListener('mouseup', boundMouseUp, true);
  if (boundKeyUp) document.removeEventListener('keyup', boundKeyUp, true);
  if (boundMouseDown) document.removeEventListener('mousedown', boundMouseDown, true);
  if (boundScroll) window.removeEventListener('scroll', boundScroll, true);

  boundMouseUp = null;
  boundKeyUp = null;
  boundMouseDown = null;
  boundScroll = null;
}
