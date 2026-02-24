import {
  PANEL_ID,
  TOOLBAR_DRAG_HANDLE_ID,
  TOOLBAR_ID,
  TOOLBAR_OFFSET_STORAGE_KEY,
} from './constants';
import { type OnElementAnnotate } from './ink-mode';
import { applySavedPalette } from './palette-panel';
import { openPanel, registerActivePanelButtonSetter, syncPanelOffset } from './popup-panel';
import { renderCapturePanel } from './panels/capture-panel';
import { renderScreenshotPanel } from './panels/screenshot-panel';
import { renderNotePanel } from './panels/note-panel';
import { renderSwipePanel } from './panels/swipe-panel';
import { renderColorsPanel } from './panels/colors-panel';
import { renderAIPanel } from './panels/ai-panel';
import { renderSettingsPanel } from './panels/settings-panel';
import { $id, $qa, getShadowRoot } from './shadow-host';

let inkCallback: OnElementAnnotate | null = null;

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

// ─── Toolbar SVG icons (stroke-based, matching the mock) ────────────────────

const TB_ICONS = {
  capture: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
  visibility: '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  visibilityOff: '<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
  screenshot: '<svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 0 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  note: '<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  swipe: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
  colors: '<svg viewBox="0 0 24 24"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>',
  ai: '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h.01M12 10h.01M16 10h.01" stroke-width="2.5"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
} as const;

const TB_BTN_CLS = 'tb-btn';
const TB_SEP_CLS = 'tb-sep';

function buildToolbarHTML(): string {
  return `
    <div id="${TOOLBAR_ID}"
      class="an:fixed an:left-1/2 an:bottom-8 an:z-[2147483647] an:font-sans an:text-[13px] an:flex an:items-center an:rounded-[15px]"
      style="background:var(--an-toolbar-bg, #1c1917); border:1px solid var(--an-toolbar-border, #44403c); padding:5px 7px; gap:1px; box-shadow:0 0 0 1px rgba(255,255,255,0.04),0 8px 32px rgba(0,0,0,0.5); transform: translateX(calc(-50% + var(--annotator-toolbar-offset-x, 0px)))">

      <button type="button" id="${TOOLBAR_DRAG_HANDLE_ID}"
        class="${TB_BTN_CLS}" style="cursor:grab" title="Drag toolbar">
        <div class="drag-dots"><span></span><span></span><span></span><span></span><span></span><span></span></div>
      </button>

      <div class="${TB_SEP_CLS}"></div>

      <button type="button" id="annotator-btn-capture" class="${TB_BTN_CLS}" data-panel="capture" title="Capture mode">${TB_ICONS.capture}</button>
      <button type="button" id="annotator-btn-visibility" class="${TB_BTN_CLS}" data-mode="visibility" title="Toggle highlights">${TB_ICONS.visibility}</button>
      <button type="button" id="annotator-btn-screenshot" class="${TB_BTN_CLS}" data-panel="screenshot" title="Screenshot">${TB_ICONS.screenshot}</button>
      <button type="button" id="annotator-btn-note" class="${TB_BTN_CLS}" data-panel="note" title="Quick note">${TB_ICONS.note}</button>

      <div class="${TB_SEP_CLS}"></div>

      <button type="button" id="annotator-btn-swipe" class="${TB_BTN_CLS}" data-panel="swipe" title="Swipe file">${TB_ICONS.swipe}</button>
      <button type="button" id="annotator-btn-colors" class="${TB_BTN_CLS}" data-panel="colors" title="Colors">${TB_ICONS.colors}</button>
      <button type="button" id="annotator-btn-ai" class="${TB_BTN_CLS}" data-panel="ai" title="Write with AI">${TB_ICONS.ai}</button>

      <div class="${TB_SEP_CLS}"></div>

      <button type="button" id="annotator-btn-settings" class="${TB_BTN_CLS}" data-panel="settings" title="Settings">${TB_ICONS.settings}</button>

    </div>
  `;
}

// ─── Toolbar drag ───────────────────────────────────────────────────────────

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

// ─── Annotation mode ────────────────────────────────────────────────────────

let activeMode: 'highlight' | 'ink' = 'highlight';

export function getActiveMode(): 'highlight' | 'ink' {
  return activeMode;
}

export function registerInkCallback(cb: OnElementAnnotate): void {
  inkCallback = cb;
}

export function getInkCallback(): OnElementAnnotate | null {
  return inkCallback;
}

// ─── Panel button registry ──────────────────────────────────────────────────

const PANEL_RENDERERS: Record<string, (body: HTMLElement) => void> = {
  capture: renderCapturePanel,
  screenshot: renderScreenshotPanel,
  note: renderNotePanel,
  swipe: renderSwipePanel,
  colors: renderColorsPanel,
  ai: renderAIPanel,
  settings: renderSettingsPanel,
};

const PANEL_OPTIONS: Record<string, { maxHeight?: string }> = {
  note: { maxHeight: 'none' },
  colors: { maxHeight: 'none' },
};

function setupPanelButtons(): void {
  const buttons = $qa<HTMLButtonElement>(
    '#' + TOOLBAR_ID + ' button[data-panel]',
  );

  registerActivePanelButtonSetter((panelId) => {
    buttons.forEach((btn) => {
      const isActive = btn.dataset.panel === panelId;
      btn.classList.toggle('on', isActive);
    });
  });

  buttons.forEach((btn) => {
    const panelId = btn.dataset.panel!;
    const renderer = PANEL_RENDERERS[panelId];
    if (!renderer) return;

    btn.addEventListener('click', () => {
      openPanel(panelId, panelId, renderer, PANEL_OPTIONS[panelId]);
    });
  });
}

// ─── Visibility toggle ──────────────────────────────────────────────────────

function setupVisibilityToggle(): void {
  const btn = $id('annotator-btn-visibility');
  if (!btn) return;

  highlightDisabled = loadHighlightDisabled();
  updateVisBtn(btn);

  btn.addEventListener('click', () => {
    saveHighlightDisabled(!highlightDisabled);
    updateVisBtn(btn);
  });
}

function updateVisBtn(btn: HTMLElement): void {
  btn.title = highlightDisabled ? 'Show highlights' : 'Hide highlights';
  btn.innerHTML = highlightDisabled ? TB_ICONS.visibilityOff : TB_ICONS.visibility;
}

// ─── Inject ─────────────────────────────────────────────────────────────────

export function injectToolbar(): boolean {
  if ($id(PANEL_ID)) return false;

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = buildToolbarHTML();
  getShadowRoot().appendChild(panel);

  setupToolbarDrag();
  setupVisibilityToggle();
  setupPanelButtons();
  applySavedPalette();
  return true;
}
