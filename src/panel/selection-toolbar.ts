import {
  ACTIVE_HIGHLIGHT_COLOR_KEY,
  PANEL_ID,
  SELECTION_TOOLBAR_ID,
  type HighlightColorEntry,
} from './constants';
import { getHighlightColors } from './palette-panel';
import { isHighlightDisabled } from './toolbar';

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
  const id = activeColorId ?? loadActiveColorId();
  return colors.find((c) => c.id === id) ?? colors[0]!;
}

// ─── Lightweight swatch tooltip ──────────────────────────────────────────────

let tooltipEl: HTMLElement | null = null;

function showTooltip(anchor: HTMLElement, text: string): void {
  hideTooltip();
  const tip = document.createElement('div');
  tip.className =
    'fixed z-[2147483647] py-1 px-2.5 rounded text-[11px] font-sans ' +
    'whitespace-nowrap pointer-events-none select-none';
  tip.style.backgroundColor = '#1a1a1a';
  tip.style.color = '#eee';
  tip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
  tip.textContent = text;
  document.body.appendChild(tip);

  const ar = anchor.getBoundingClientRect();
  const tw = tip.offsetWidth;
  const th = tip.offsetHeight;
  const gap = 6;

  let left = ar.left + ar.width / 2 - tw / 2;
  left = Math.max(4, Math.min(left, window.innerWidth - tw - 4));

  let top = ar.top - th - gap;
  if (top < 4) top = ar.bottom + gap;

  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
  tooltipEl = tip;
}

function hideTooltip(): void {
  if (tooltipEl) {
    tooltipEl.remove();
    tooltipEl = null;
  }
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
    'fixed z-[2147483647] flex items-center gap-1.5 py-1.5 px-2.5 ' +
    'rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.24)] font-sans text-[13px] select-none';
  container.style.backgroundColor = '#333';
  container.style.color = '#fff';
  container.style.pointerEvents = 'auto';

  // Color swatches
  for (const entry of colors) {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className =
      'w-5 h-5 rounded-full border-none cursor-pointer shrink-0 ' +
      'transition-all duration-150 hover:scale-110';
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

  // Separator
  const sep = document.createElement('div');
  sep.className = 'w-px h-4 mx-0.5 shrink-0';
  sep.style.backgroundColor = 'rgba(255,255,255,0.25)';
  container.appendChild(sep);

  // Highlight button
  const highlightBtn = document.createElement('button');
  highlightBtn.type = 'button';
  highlightBtn.className =
    'border-none cursor-pointer text-white text-[13px] font-medium ' +
    'bg-transparent px-1.5 py-0.5 rounded hover:bg-white/15 transition-colors whitespace-nowrap';
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
    if (el instanceof HTMLElement) {
      const id = el.id;
      if (id === PANEL_ID || id === SELECTION_TOOLBAR_ID || id === 'annotator-popup-panel') {
        return true;
      }
    }
    el = el.parentNode;
  }
  return false;
}

function showSelectionToolbar(): void {
  if (isHighlightDisabled()) return;
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
  document.body.appendChild(toolbarEl);

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
  if (toolbarEl && toolbarEl.contains(e.target as Node)) return;

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
  if (toolbarEl && toolbarEl.contains(e.target as Node)) return;
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
