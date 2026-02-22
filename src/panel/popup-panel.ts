import { POPUP_PANEL_ID, TOOLBAR_ID } from './constants';
import { colorToHex, contrastingForeground, ensureContrast, luminance, loadPalette } from './color-utils';
import { $id, getShadowRoot } from './shadow-host';

let currentPanelId: string | null = null;
let outsideClickHandler: ((e: MouseEvent) => void) | null = null;

/** Sync the popup panel's horizontal position with the toolbar offset. */
export function syncPanelOffset(): void {
  const panel = $id(POPUP_PANEL_ID);
  if (!panel) return;
  const toolbar = $id(TOOLBAR_ID);
  const offset = toolbar
    ? getComputedStyle(toolbar).getPropertyValue('--annotator-toolbar-offset-x') || '0px'
    : '0px';
  panel.style.transform = `translateX(calc(-50% + ${offset}))`;
}

/**
 * Compute a full set of semantic color tokens from the panel background,
 * then set them as CSS custom properties on the panel root. Every token
 * is guaranteed readable against the actual background — no binary
 * dark/light switch that breaks on mid-tones.
 */
function setPanelCSSVars(panel: HTMLElement, bgHex: string): void {
  const bgLum = luminance(bgHex);
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

function applyPanelTheme(panel: HTMLElement): void {
  const config = loadPalette();
  const bgHex = colorToHex(config.system.backgroundColor);
  setPanelCSSVars(panel, bgHex);
  const iconHex = colorToHex(config.system.iconColor);
  const host = getShadowRoot().host as HTMLElement;
  host.style.setProperty('--an-toggle-active-bg', iconHex);
  host.style.setProperty('--an-toggle-active-fg', contrastingForeground(iconHex));
  host.style.setProperty('--an-icon-color', iconHex);
}

/**
 * Re-apply panel theme vars from outside (e.g. after palette save).
 * Accepts a raw background color string.
 */
export function refreshPanelTheme(bgColor: string, iconColor?: string): void {
  const panel = $id(POPUP_PANEL_ID);
  if (!panel) return;
  const bgHex = colorToHex(bgColor);
  setPanelCSSVars(panel, bgHex);
  if (iconColor !== undefined) {
    const iconHex = colorToHex(iconColor);
    const host = getShadowRoot().host as HTMLElement;
    host.style.setProperty('--an-toggle-active-bg', iconHex);
    host.style.setProperty('--an-toggle-active-fg', contrastingForeground(iconHex));
    host.style.setProperty('--an-icon-color', iconHex);
  }
}

let activePanelButtonSetter: ((panelId: string | null) => void) | null = null;

/** Called by toolbar to sync which panel button is active when a panel opens/closes. */
export function registerActivePanelButtonSetter(cb: (panelId: string | null) => void): void {
  activePanelButtonSetter = cb;
}

/** Return the toolbar width in pixels, or a fallback if toolbar is missing. */
function getToolbarWidthPx(): number {
  const toolbar = $id(TOOLBAR_ID);
  if (!toolbar) return 400;
  return toolbar.getBoundingClientRect().width;
}

function buildPanelContainer(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = POPUP_PANEL_ID;
  panel.className =
    'an:fixed an:left-1/2 an:bottom-[84px] an:z-[2147483647] an:border ' +
    'an:rounded-xl an:shadow-[0_8px_32px_rgba(0,0,0,0.12)] an:font-sans an:text-[13px] ' +
    'an:max-h-[50vh] an:flex an:flex-col';

  syncPanelOffset.call(null);
  const toolbar = $id(TOOLBAR_ID);
  const offset = toolbar
    ? getComputedStyle(toolbar).getPropertyValue('--annotator-toolbar-offset-x') || '0px'
    : '0px';
  panel.style.transform = `translateX(calc(-50% + ${offset}))`;
  panel.style.width = `${getToolbarWidthPx()}px`;

  const body = document.createElement('div');
  body.id = 'annotator-popup-body';
  body.className = 'an:overflow-y-auto an:px-5 an:py-4 an:flex-1';
  panel.appendChild(body);

  applyPanelTheme(panel);

  return panel;
}

function addClickOutsideDismiss(panel: HTMLElement): void {
  function handler(e: MouseEvent) {
    const path = e.composedPath();
    const toolbar = $id(TOOLBAR_ID);
    if (
      !path.includes(panel) &&
      (!toolbar || !path.includes(toolbar))
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
  const previousPanelId = currentPanelId;
  const existing = $id(POPUP_PANEL_ID);
  if (existing) existing.remove();
  removeClickOutsideDismiss();
  currentPanelId = null;
  if (previousPanelId && activePanelButtonSetter) activePanelButtonSetter(null);
}

export function openPanel(
  panelId: string,
  _title: string,
  renderContent: (body: HTMLElement) => void,
): void {
  if (currentPanelId === panelId) {
    closePanel();
    return;
  }

  closePanel();

  const container = buildPanelContainer();
  getShadowRoot().appendChild(container);
  currentPanelId = panelId;

  const body = $id('annotator-popup-body');
  if (body) renderContent(body);

  if (activePanelButtonSetter) activePanelButtonSetter(panelId);

  addClickOutsideDismiss(container);
}

export function getOpenPanelId(): string | null {
  return currentPanelId;
}
