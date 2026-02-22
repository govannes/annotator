import { ACTIVE_HIGHLIGHT_COLOR_KEY } from './constants';
import { getHighlightColors } from './palette-panel';
import { getShadowRoot } from './shadow-host';
import { isHighlightDisabled } from './toolbar';

export type OnElementAnnotate = (element: Element, color: string) => void;

const OVERLAY_ID = 'annotator-ink-overlay';
const SHADOW_HOST_ID = 'annotator-shadow-host';

let active = false;
let overlay: HTMLDivElement | null = null;
let hoveredElement: Element | null = null;
let onAnnotate: OnElementAnnotate | null = null;

let boundMouseMove: ((e: MouseEvent) => void) | null = null;
let boundClick: ((e: MouseEvent) => void) | null = null;
let boundKeyDown: ((e: KeyboardEvent) => void) | null = null;

function getActiveColor(): string {
  const colors = getHighlightColors();
  let id: string | null = null;
  try { id = localStorage.getItem(ACTIVE_HIGHLIGHT_COLOR_KEY); } catch { /* ignore */ }
  if (id) {
    const found = colors.find((c) => c.id === id);
    if (found) return found.color;
  }
  return colors[0]?.color ?? 'rgba(255, 220, 0, 0.35)';
}

function createOverlay(): HTMLDivElement {
  const el = document.createElement('div');
  el.id = OVERLAY_ID;
  el.style.cssText =
    'position: fixed; pointer-events: none; z-index: 2147483646; ' +
    'border: 2px solid; border-radius: 2px; transition: all 60ms ease-out; display: none;';
  getShadowRoot().appendChild(el);
  return el;
}

function positionOverlay(target: Element): void {
  if (!overlay) return;
  const rect = target.getBoundingClientRect();
  const color = getActiveColor();
  overlay.style.left = `${rect.left}px`;
  overlay.style.top = `${rect.top}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.backgroundColor = 'transparent';
  overlay.style.borderColor = color.replace(/[\d.]+\)$/, '0.8)');
  overlay.style.display = 'block';
}

function hideOverlay(): void {
  if (overlay) overlay.style.display = 'none';
  hoveredElement = null;
}

function isOwnElement(el: Element): boolean {
  let node: Element | null = el;
  while (node) {
    if (node.id === SHADOW_HOST_ID) return true;
    node = node.parentElement;
  }
  return false;
}

function onMouseMove(e: MouseEvent): void {
  const target = document.elementFromPoint(e.clientX, e.clientY);
  if (!target || isOwnElement(target)) {
    hideOverlay();
    return;
  }
  if (target === hoveredElement) return;
  hoveredElement = target;
  positionOverlay(target);
}

function onClick(e: MouseEvent): void {
  if (isHighlightDisabled()) return;
  if (!hoveredElement || isOwnElement(hoveredElement)) return;

  e.preventDefault();
  e.stopPropagation();

  const color = getActiveColor();
  const element = hoveredElement;
  hideOverlay();

  if (onAnnotate) onAnnotate(element, color);
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') hideOverlay();
}

export function activateInkMode(callback: OnElementAnnotate): void {
  if (active) return;
  active = true;
  onAnnotate = callback;

  overlay = createOverlay();

  boundMouseMove = onMouseMove;
  boundClick = onClick;
  boundKeyDown = onKeyDown;

  document.addEventListener('mousemove', boundMouseMove, true);
  document.addEventListener('click', boundClick, true);
  document.addEventListener('keydown', boundKeyDown, true);
}

export function deactivateInkMode(): void {
  if (!active) return;
  active = false;
  onAnnotate = null;

  hideOverlay();
  if (overlay) { overlay.remove(); overlay = null; }

  if (boundMouseMove) document.removeEventListener('mousemove', boundMouseMove, true);
  if (boundClick) document.removeEventListener('click', boundClick, true);
  if (boundKeyDown) document.removeEventListener('keydown', boundKeyDown, true);
  boundMouseMove = null;
  boundClick = null;
  boundKeyDown = null;
}

export function isInkModeActive(): boolean {
  return active;
}
