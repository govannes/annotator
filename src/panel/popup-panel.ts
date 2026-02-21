import { POPUP_PANEL_ID, TOOLBAR_ID, PALETTE_STORAGE_KEY, DEFAULT_PALETTE, type PaletteConfig } from './constants';

let currentPanelId: string | null = null;
let outsideClickHandler: ((e: MouseEvent) => void) | null = null;

/** Sync the popup panel's horizontal position with the toolbar offset. */
export function syncPanelOffset(): void {
  const panel = document.getElementById(POPUP_PANEL_ID);
  if (!panel) return;
  const toolbar = document.getElementById(TOOLBAR_ID);
  const offset = toolbar
    ? getComputedStyle(toolbar).getPropertyValue('--annotator-toolbar-offset-x') || '0px'
    : '0px';
  panel.style.transform = `translateX(calc(-50% + ${offset}))`;
}

function loadPanelPalette(): PaletteConfig {
  try {
    const raw = localStorage.getItem(PALETTE_STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_PALETTE);
    const parsed = JSON.parse(raw) as PaletteConfig;
    if (!parsed.system || !Array.isArray(parsed.highlights)) {
      return structuredClone(DEFAULT_PALETTE);
    }
    return parsed;
  } catch {
    return structuredClone(DEFAULT_PALETTE);
  }
}

function colorToHexSimple(color: string): string {
  if (color.startsWith('#') && (color.length === 7 || color.length === 4)) return color;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return '#000000';
  ctx.fillStyle = color;
  const computed = ctx.fillStyle;
  if (computed.startsWith('#')) return computed;
  const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return '#000000';
  return '#' + [match[1], match[2], match[3]].map((c) => parseInt(c!, 10).toString(16).padStart(2, '0')).join('');
}

function relativeLum(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const s = parseInt(h.slice(i, i + 2), 16) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Mix a foreground color toward white or black until it reaches `minRatio`
 * contrast against `bgLum`. Picks the direction (lighten or darken) that
 * requires less travel from the starting point.
 */
function ensureContrast(fg: string, bgLum: number, minRatio: number): string {
  const [r, g, b] = hexToRgb(fg);
  const fgLum = relativeLum(fg);
  if (contrastRatio(fgLum, bgLum) >= minRatio) return fg;

  const goLight = bgLum <= 0.5;
  const target = goLight ? [255, 255, 255] : [0, 0, 0];

  for (let t = 0.05; t <= 1; t += 0.05) {
    const mr = r + (target[0]! - r) * t;
    const mg = g + (target[1]! - g) * t;
    const mb = b + (target[2]! - b) * t;
    const mixed = rgbToHex(mr, mg, mb);
    if (contrastRatio(relativeLum(mixed), bgLum) >= minRatio) return mixed;
  }
  return goLight ? '#ffffff' : '#000000';
}

/**
 * Compute a full set of semantic color tokens from the panel background,
 * then set them as CSS custom properties on the panel root. Every token
 * is guaranteed readable against the actual background — no binary
 * dark/light switch that breaks on mid-tones.
 */
function setPanelCSSVars(panel: HTMLElement, bgHex: string): void {
  const bgLum = relativeLum(bgHex);
  const goLight = bgLum <= 0.5;

  const textBase   = goLight ? '#e8e8e8' : '#1a1a1a';
  const mutedBase   = goLight ? '#c0c0c0' : '#707070';
  const subtleBase  = goLight ? '#b8b8b8' : '#909090';
  const faintBase   = goLight ? '#888'    : '#aaa';

  const text      = ensureContrast(textBase,  bgLum, 3.2);
  const muted     = ensureContrast(mutedBase, bgLum, 2.2);
  const subtle    = ensureContrast(subtleBase, bgLum, 1.8);
  const faint     = ensureContrast(faintBase, bgLum, 1.5);
  const inputText = ensureContrast(goLight ? '#ddd' : '#333', bgLum, 3.2);
  const iconIdle  = ensureContrast(goLight ? '#aaa' : '#aaa', bgLum, 1.5);

  const borderAlpha   = goLight ? 0.18 : 0.12;
  const borderMdAlpha = goLight ? 0.25 : 0.18;
  const surfaceAlpha  = goLight ? 0.08 : 0.04;
  const hoverAlpha    = goLight ? 0.12 : 0.06;
  const ch = goLight ? '255,255,255' : '0,0,0';

  const vars: Record<string, string> = {
    '--ap-bg':            bgHex,
    '--ap-text':          text,
    '--ap-muted':         muted,
    '--ap-subtle':        subtle,
    '--ap-faint':         faint,
    '--ap-border':        `rgba(${ch},${borderAlpha})`,
    '--ap-border-md':     `rgba(${ch},${borderMdAlpha})`,
    '--ap-surface':       `rgba(${ch},${surfaceAlpha})`,
    '--ap-hover':         `rgba(${ch},${hoverAlpha})`,
    '--ap-input-text':    inputText,
    '--ap-input-border':  `rgba(${ch},${goLight ? 0.25 : 0.15})`,
    '--ap-input-focus':   `rgba(${ch},${goLight ? 0.45 : 0.30})`,
    '--ap-danger':        '#d32f2f',
    '--ap-danger-bg':     goLight ? 'rgba(211,47,47,0.15)' : '#fee',
    '--ap-icon-idle':     iconIdle,
  };

  for (const [k, v] of Object.entries(vars)) {
    panel.style.setProperty(k, v);
  }

  panel.style.backgroundColor = bgHex;
  panel.style.color = text;
  panel.style.borderColor = vars['--ap-border']!;
}

function applyPanelTheme(panel: HTMLElement, header: HTMLElement): void {
  const config = loadPanelPalette();
  const bgHex = colorToHexSimple(config.system.backgroundColor);
  setPanelCSSVars(panel, bgHex);
  header.style.borderColor = 'var(--ap-border)';
}

/**
 * Re-apply panel theme vars from outside (e.g. after palette save).
 * Accepts a raw background color string.
 */
export function refreshPanelTheme(bgColor: string): void {
  const panel = document.getElementById(POPUP_PANEL_ID);
  if (!panel) return;
  const bgHex = colorToHexSimple(bgColor);
  setPanelCSSVars(panel, bgHex);
  const header = panel.querySelector<HTMLElement>('.border-b');
  if (header) header.style.borderColor = 'var(--ap-border)';
}

function buildPanelContainer(title: string): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = POPUP_PANEL_ID;
  panel.className =
    'fixed left-1/2 bottom-[70px] z-[2147483647] border ' +
    'rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] font-sans text-[13px] ' +
    'max-w-[400px] w-[90vw] max-h-[50vh] flex flex-col';

  syncPanelOffset.call(null);
  const toolbar = document.getElementById(TOOLBAR_ID);
  const offset = toolbar
    ? getComputedStyle(toolbar).getPropertyValue('--annotator-toolbar-offset-x') || '0px'
    : '0px';
  panel.style.transform = `translateX(calc(-50% + ${offset}))`;

  const header = document.createElement('div');
  header.className =
    'flex justify-between items-center px-4 py-3 border-b shrink-0';
  header.innerHTML = `
    <span class="font-semibold text-sm" data-popup-title>${title}</span>
    <button id="annotator-popup-close"
      class="bg-transparent border-none cursor-pointer text-lg leading-none p-1 rounded opacity-60 hover:opacity-100">&times;</button>
  `;
  panel.appendChild(header);

  const body = document.createElement('div');
  body.id = 'annotator-popup-body';
  body.className = 'overflow-y-auto p-4 flex-1';
  panel.appendChild(body);

  applyPanelTheme(panel, header);

  return panel;
}

function addClickOutsideDismiss(panel: HTMLElement): void {
  function handler(e: MouseEvent) {
    const target = e.target as Node;
    const toolbar = document.getElementById(TOOLBAR_ID);
    if (
      !panel.contains(target) &&
      (!toolbar || !toolbar.contains(target))
    ) {
      closePanel();
    }
  }
  outsideClickHandler = handler;
  setTimeout(() => document.addEventListener('click', handler, true), 0);
}

function removeClickOutsideDismiss(): void {
  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler, true);
    outsideClickHandler = null;
  }
}

export function closePanel(): void {
  const existing = document.getElementById(POPUP_PANEL_ID);
  if (existing) existing.remove();
  removeClickOutsideDismiss();
  currentPanelId = null;
}

export function openPanel(
  panelId: string,
  title: string,
  renderContent: (body: HTMLElement) => void,
): void {
  if (currentPanelId === panelId) {
    closePanel();
    return;
  }

  closePanel();

  const container = buildPanelContainer(title);
  document.body.appendChild(container);
  currentPanelId = panelId;

  const body = document.getElementById('annotator-popup-body');
  if (body) renderContent(body);

  document
    .getElementById('annotator-popup-close')
    ?.addEventListener('click', () => closePanel());

  addClickOutsideDismiss(container);
}

export function getOpenPanelId(): string | null {
  return currentPanelId;
}
