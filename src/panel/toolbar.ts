import {
  PANEL_ID,
  TOOLBAR_DRAG_HANDLE_ID,
  TOOLBAR_ID,
  TOOLBAR_OFFSET_STORAGE_KEY,
} from './constants';
import { ICONS } from './icons';
import { activateInkMode, deactivateInkMode, type OnElementAnnotate } from './ink-mode';
import { applySavedPalette, openPalettePanel } from './palette-panel';
import { openPanel, registerActivePanelButtonSetter, syncPanelOffset } from './popup-panel';
import { hideSelectionToolbar } from './selection-toolbar';
import { $id, $q, $qa, getShadowRoot } from './shadow-host';
import { DRAG_HANDLE_CLS, DRAG_HANDLE_BORDER } from './ui-utils';

let inkCallback: OnElementAnnotate | null = null;

const BTN_TOGGLE = 'an:w-9 an:h-9 an:p-0 an:border-none an:rounded-lg an:cursor-pointer an:inline-flex an:items-center an:justify-center [&>svg]:an:w-5 [&>svg]:an:h-5';
const BTN_TOGGLE_ACTIVE = 'an:bg-[var(--an-toggle-active-bg,#2e7d32)] an:text-white an:shadow-sm';
const BTN_TOGGLE_INACTIVE = 'an:bg-transparent an:text-[#444] hover:an:bg-[#e0e0e0]';

const TOGGLE_ACTIVE_CLS = BTN_TOGGLE_ACTIVE.split(' ');
const TOGGLE_INACTIVE_CLS = BTN_TOGGLE_INACTIVE.split(' ');

/** Apply active/inactive toggle style to any toolbar toggle button. Uses --an-icon-color for inactive so custom palette is respected. */
function applyToggleStyle(btn: HTMLElement, isActive: boolean, title?: string): void {
  btn.classList.remove(...TOGGLE_ACTIVE_CLS, ...TOGGLE_INACTIVE_CLS);
  btn.classList.add(...(isActive ? TOGGLE_ACTIVE_CLS : TOGGLE_INACTIVE_CLS));
  if (isActive) btn.setAttribute('data-active', 'true');
  else btn.removeAttribute('data-active');
  btn.style.backgroundColor = '';
  btn.style.color = isActive ? '' : 'var(--an-icon-color, #444)';
  if (title !== undefined) btn.title = title;
}

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
    const isElement = span.getAttribute('data-highlight-type') === 'element';
    if (hide) {
      if (isElement) {
        const current = span.style.getPropertyValue('outline');
        if (current) span.setAttribute(SAVED_COLOR_ATTR, current);
        span.style.setProperty('outline', 'none', 'important');
      } else {
        const current = span.style.getPropertyValue('background-color');
        if (current) span.setAttribute(SAVED_COLOR_ATTR, current);
        span.style.setProperty('background-color', 'transparent', 'important');
      }
    } else {
      const saved = span.getAttribute(SAVED_COLOR_ATTR);
      if (saved) {
        if (isElement) {
          span.style.setProperty('outline', saved, 'important');
        } else {
          span.style.setProperty('background-color', saved, 'important');
        }
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
      class="an:fixed an:left-1/2 an:bottom-4 an:z-[2147483647] an:font-sans an:text-[13px] an:flex an:items-center an:bg-[#f0f0f0] an:text-[#333] an:p-2 an:rounded-xl an:shadow-[0_4px_20px_rgba(0,0,0,0.12)]"
      style="--an-toolbar-border: rgba(0,0,0,0.12); --an-toolbar-handle-color: #aaa; transform: translateX(calc(-50% + var(--annotator-toolbar-offset-x, 0px)))">
      <div id="${TOOLBAR_DRAG_HANDLE_ID}"
        class="${DRAG_HANDLE_CLS} an:py-2 an:px-1.5"
        style="${DRAG_HANDLE_BORDER}; color: var(--an-toolbar-handle-color, #aaa)"
        title="Drag to move toolbar" data-divider>${ICONS.dragIndicator}</div>
      <div class="an:flex an:items-center an:gap-2 an:px-2.5">
        <div class="an:flex an:items-center an:bg-transparent an:rounded-lg an:p-1 an:gap-0.5" style="border: 1px solid var(--an-toolbar-border)" data-toggle-group="annotation-mode">
          <button type="button" id="add-annotation" class="${BTN_TOGGLE} ${BTN_TOGGLE_ACTIVE}" title="Highlight selection" data-mode="highlight" data-active="true">${ICONS.highlight}</button>
          <button type="button" id="annotator-btn-ink" class="${BTN_TOGGLE} ${BTN_TOGGLE_INACTIVE}" title="Ink Selection" data-mode="ink">${ICONS.inkSelection}</button>
        </div>
        <button type="button" id="annotator-btn-visibility" class="${BTN_TOGGLE} ${BTN_TOGGLE_INACTIVE}" title="Hide highlights" data-mode="visibility">${ICONS.visibilityOff}</button>
        <button type="button" id="annotator-btn-showdb" class="${BTN_TOGGLE} ${BTN_TOGGLE_INACTIVE}" title="Show annotations DB" data-panel="database">${ICONS.database}</button>
        <button type="button" id="annotator-btn-palette" class="${BTN_TOGGLE} ${BTN_TOGGLE_INACTIVE}" title="Palette" data-panel="palette">${ICONS.palette}</button>
        <button type="button" id="annotator-btn-chatbox" class="${BTN_TOGGLE} ${BTN_TOGGLE_INACTIVE}" title="Chatbox" data-panel="chatbox">${ICONS.chatbox}</button>
        <button type="button" id="annotator-btn-dashboard" class="${BTN_TOGGLE} ${BTN_TOGGLE_INACTIVE}" title="Dashboard" data-panel="dashboard">${ICONS.dashboard}</button>
        <button type="button" id="annotator-btn-settings" class="${BTN_TOGGLE} ${BTN_TOGGLE_INACTIVE}" title="Settings" data-panel="settings">${ICONS.settings}</button>
      </div>
    </div>
  `;
}

function setupToolbarDrag(): void {
  const toolbar = $id(TOOLBAR_ID);
  const handle = $id(TOOLBAR_DRAG_HANDLE_ID);
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

/** Register callback for ink-mode element annotations. Call once after injectToolbar. */
export function registerInkCallback(cb: OnElementAnnotate): void {
  inkCallback = cb;
}

function setupModeToggle(): void {
  const group = $q('[data-toggle-group="annotation-mode"]');
  if (!group) return;

  const buttons = group.querySelectorAll<HTMLButtonElement>('button[data-mode]');

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode as 'highlight' | 'ink';
      if (mode === activeMode) return;
      activeMode = mode;

      buttons.forEach((b) => {
        applyToggleStyle(b, b.dataset.mode === mode);
      });

      if (mode === 'ink') {
        hideSelectionToolbar();
        if (inkCallback) activateInkMode(inkCallback);
      } else {
        deactivateInkMode();
      }

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
  const buttons = $qa<HTMLButtonElement>(
    '#' + TOOLBAR_ID + ' button[data-panel]',
  );

  registerActivePanelButtonSetter((panelId) => {
    buttons.forEach((btn) => {
      applyToggleStyle(btn, btn.dataset.panel === panelId);
    });
  });

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
          <div class="an:flex an:items-center an:justify-center an:py-10 an:text-[var(--ap-muted)] an:text-sm">
            ${title} coming soon
          </div>
        `;
      });
    });
  });
}

function setupVisibilityToggle(): void {
  const btn = $id('annotator-btn-visibility');
  if (!btn) return;

  highlightDisabled = loadHighlightDisabled();
  applyToggleStyle(btn, highlightDisabled, highlightDisabled ? 'Show highlights' : 'Hide highlights');

  btn.addEventListener('click', () => {
    saveHighlightDisabled(!highlightDisabled);
    applyToggleStyle(btn, highlightDisabled, highlightDisabled ? 'Show highlights' : 'Hide highlights');
    applySavedPalette();
  });
}

export function injectToolbar(): boolean {
  if ($id(PANEL_ID)) return false;

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = buildToolbarHTML();
  getShadowRoot().appendChild(panel);

  setupToolbarDrag();
  setupModeToggle();
  setupVisibilityToggle();
  setupPanelButtons();
  applySavedPalette();
  return true;
}
