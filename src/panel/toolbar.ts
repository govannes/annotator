import {
  PANEL_ID,
  TOOLBAR_DRAG_HANDLE_ID,
  TOOLBAR_ID,
  TOOLBAR_OFFSET_STORAGE_KEY,
} from './constants';
import { ICONS } from './icons';
import { applySavedPalette, openPalettePanel } from './palette-panel';
import { openPanel, syncPanelOffset } from './popup-panel';

const BTN = 'w-9 h-9 p-0 border-none rounded-lg bg-transparent text-[#444] cursor-pointer inline-flex items-center justify-center hover:bg-[#e8e8e8] hover:text-[#222] active:bg-[#ddd] [&>svg]:w-5 [&>svg]:h-5';
const BTN_TOGGLE = 'w-9 h-9 p-0 border-none rounded-lg cursor-pointer inline-flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5';
const BTN_TOGGLE_ACTIVE = 'bg-[#2e7d32] text-white shadow-sm';
const BTN_TOGGLE_INACTIVE = 'bg-transparent text-[#444] hover:bg-[#e0e0e0]';

const HIGHLIGHT_DISABLED_KEY = 'annotator_highlight_disabled';
const SAVED_COLOR_ATTR = 'data-annotator-saved-color';
let highlightDisabled = false;

function loadHighlightDisabled(): boolean {
  try {
    return localStorage.getItem(HIGHLIGHT_DISABLED_KEY) === '1';
  } catch { return false; }
}

function saveHighlightDisabled(disabled: boolean): void {
  highlightDisabled = disabled;
  try {
    localStorage.setItem(HIGHLIGHT_DISABLED_KEY, disabled ? '1' : '0');
  } catch { /* ignore */ }
  toggleHighlightSpans(disabled);
}

function toggleHighlightSpans(hide: boolean): void {
  const spans = document.querySelectorAll<HTMLElement>('.annotator-highlight');
  console.log('[Annotator] toggleHighlightSpans — hide:', hide, 'spans:', spans.length);
  spans.forEach((span) => {
    if (hide) {
      const current = span.style.getPropertyValue('background-color');
      if (current) span.setAttribute(SAVED_COLOR_ATTR, current);
      span.style.setProperty('background-color', 'transparent', 'important');
    } else {
      const saved = span.getAttribute(SAVED_COLOR_ATTR);
      if (saved) {
        span.style.setProperty('background-color', saved, 'important');
        span.removeAttribute(SAVED_COLOR_ATTR);
      }
    }
  });
}

export function isHighlightDisabled(): boolean {
  return highlightDisabled;
}

export function applyHighlightVisibility(): void {
  if (highlightDisabled) toggleHighlightSpans(true);
}

function buildToolbarHTML(): string {
  return `
    <div id="${TOOLBAR_ID}"
      class="fixed left-1/2 bottom-4 z-[2147483647] font-sans text-[13px] flex items-center bg-[#f0f0f0] text-[#333] py-1.5 pl-0.5 pr-1 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.12)]"
      style="transform: translateX(calc(-50% + var(--annotator-toolbar-offset-x, 0px)))">
      <div id="${TOOLBAR_DRAG_HANDLE_ID}"
        class="cursor-grab py-2 px-2 border-r text-[#aaa] flex items-center justify-center select-none"
        title="Drag to move toolbar" data-divider>${ICONS.dragIndicator}</div>
      <div class="flex items-center gap-1.5 px-2">
        <div class="flex items-center bg-transparent border border-current rounded-lg p-0.5 gap-0.5" data-toggle-group="annotation-mode">
          <button type="button" id="add-annotation" class="${BTN_TOGGLE} ${BTN_TOGGLE_ACTIVE}" title="Highlight selection" data-mode="highlight">${ICONS.highlight}</button>
          <button type="button" id="annotator-btn-ink" class="${BTN_TOGGLE} ${BTN_TOGGLE_INACTIVE}" title="Ink Selection" data-mode="ink">${ICONS.inkSelection}</button>
        </div>
        <button type="button" id="annotator-btn-visibility" class="${BTN_TOGGLE} ${BTN_TOGGLE_INACTIVE}" title="Hide highlights" data-mode="visibility">${ICONS.visibilityOff}</button>
        <button type="button" id="annotator-btn-showdb" class="${BTN}" title="Show annotations DB" data-panel="database">${ICONS.database}</button>
        <button type="button" id="annotator-btn-palette" class="${BTN}" title="Palette" data-panel="palette">${ICONS.palette}</button>
        <button type="button" id="annotator-btn-chatbox" class="${BTN}" title="Chatbox" data-panel="chatbox">${ICONS.chatbox}</button>
        <button type="button" id="annotator-btn-dashboard" class="${BTN}" title="Dashboard" data-panel="dashboard">${ICONS.dashboard}</button>
        <button type="button" id="annotator-btn-settings" class="${BTN}" title="Settings" data-panel="settings">${ICONS.settings}</button>
      </div>
    </div>
    <div id="add-annotation-result" class="fixed -left-[9999px] pointer-events-none" aria-hidden="true"></div>
  `;
}

function setupToolbarDrag(): void {
  const toolbar = document.getElementById(TOOLBAR_ID);
  const handle = document.getElementById(TOOLBAR_DRAG_HANDLE_ID);
  if (!toolbar || !handle) return;

  const pageKey = `${TOOLBAR_OFFSET_STORAGE_KEY}_${window.location.hostname}`;

  function getStoredOffset(): number {
    try {
      const v = localStorage.getItem(pageKey);
      if (v != null) return parseInt(v, 10) || 0;
    } catch (_) { /* ignore */ }
    return 0;
  }

  function setOffsetPx(px: number): void {
    toolbar!.style.setProperty('--annotator-toolbar-offset-x', `${px}px`);
    syncPanelOffset();
    try {
      localStorage.setItem(pageKey, String(px));
    } catch (_) { /* ignore */ }
  }

  setOffsetPx(getStoredOffset());

  let startX = 0;
  let startOffset = 0;

  handle.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    startX = e.clientX;
    startOffset = getStoredOffset();
    handle.style.cursor = 'grabbing';

    const onMove = (e2: MouseEvent) => {
      const dx = e2.clientX - startX;
      setOffsetPx(startOffset + dx);
    };
    const onUp = () => {
      handle.style.cursor = 'grab';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

let activeMode: 'highlight' | 'ink' = 'highlight';

export function getActiveMode(): 'highlight' | 'ink' {
  return activeMode;
}

function setupModeToggle(): void {
  const group = document.querySelector('[data-toggle-group="annotation-mode"]');
  if (!group) return;

  const buttons = group.querySelectorAll<HTMLButtonElement>('button[data-mode]');
  const activeCls = BTN_TOGGLE_ACTIVE.split(' ');
  const inactiveCls = BTN_TOGGLE_INACTIVE.split(' ');

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode as 'highlight' | 'ink';
      if (mode === activeMode) return;
      activeMode = mode;

      buttons.forEach((b) => {
        const isActive = b.dataset.mode === mode;
        b.classList.remove(...activeCls, ...inactiveCls);
        b.classList.add(...(isActive ? activeCls : inactiveCls));
        b.style.backgroundColor = '';
        b.style.color = '';
      });

      applySavedPalette();
    });
  });
}

const PANEL_PLACEHOLDERS: Record<string, string> = {
  chatbox: 'Chatbox',
  dashboard: 'Dashboard',
  settings: 'Settings',
};

function setupPanelButtons(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>(
    '#' + TOOLBAR_ID + ' button[data-panel]',
  );

  buttons.forEach((btn) => {
    const panelId = btn.dataset.panel!;
    if (panelId === 'database') return;

    if (panelId === 'palette') {
      btn.addEventListener('click', () => openPalettePanel());
      return;
    }

    const title = PANEL_PLACEHOLDERS[panelId] ?? panelId;
    btn.addEventListener('click', () => {
      openPanel(panelId, title, (body) => {
        body.innerHTML = `
          <div class="flex items-center justify-center py-8 text-[var(--ap-muted)] text-sm">
            ${title} coming soon
          </div>
        `;
      });
    });
  });
}

function setupVisibilityToggle(): void {
  const btn = document.getElementById('annotator-btn-visibility');
  console.log('[Annotator] setupVisibilityToggle — btn found:', !!btn);
  if (!btn) return;

  highlightDisabled = loadHighlightDisabled();
  console.log('[Annotator] visibility init — disabled:', highlightDisabled);
  applyVisibilityStyle(btn);

  btn.addEventListener('click', () => {
    const newState = !highlightDisabled;
    console.log('[Annotator] visibility toggle clicked — hiding:', newState);
    saveHighlightDisabled(newState);
    applyVisibilityStyle(btn);
  });
}

function applyVisibilityStyle(btn: HTMLElement): void {
  const activeCls = BTN_TOGGLE_ACTIVE.split(' ');
  const inactiveCls = BTN_TOGGLE_INACTIVE.split(' ');
  btn.classList.remove(...activeCls, ...inactiveCls);
  btn.classList.add(...(highlightDisabled ? activeCls : inactiveCls));
  btn.style.backgroundColor = '';
  btn.style.color = '';
  btn.title = highlightDisabled ? 'Show highlights' : 'Hide highlights';
  applySavedPalette();
}

export function injectToolbar(): boolean {
  if (document.getElementById(PANEL_ID)) return false;

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = buildToolbarHTML();
  document.body.appendChild(panel);

  setupToolbarDrag();
  setupModeToggle();
  setupVisibilityToggle();
  setupPanelButtons();
  applySavedPalette();
  return true;
}
