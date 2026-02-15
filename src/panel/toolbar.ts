import {
  PANEL_ID,
  TOOLBAR_ID,
  TOOLBAR_DRAG_HANDLE_ID,
  TOOLBAR_OFFSET_STORAGE_KEY,
} from './constants';
import { ICONS } from './icons';

const BTN = 'w-9 h-9 p-0 border-none rounded-lg bg-transparent text-[#ccc] cursor-pointer inline-flex items-center justify-center hover:bg-[#333] hover:text-[#eee] active:bg-[#444] [&>svg]:w-5 [&>svg]:h-5';
const BTN_HIGHLIGHT = `${BTN} text-[#8bc34a] hover:bg-[#2d4a1a] hover:text-[#a5d6a7]`;

function buildToolbarHTML(): string {
  return `
    <div id="${TOOLBAR_ID}"
      class="fixed left-1/2 bottom-4 z-[2147483647] font-sans text-[13px] flex items-center bg-[#1a1a1a] text-[#eee] py-1.5 pl-0.5 pr-1 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
      style="transform: translateX(calc(-50% + var(--annotator-toolbar-offset-x, 0px)))">
      <div id="${TOOLBAR_DRAG_HANDLE_ID}"
        class="cursor-grab py-2 px-1.5 mr-0.5 rounded-lg text-[#888] flex items-center justify-center select-none"
        title="Drag to move toolbar">${ICONS.dragIndicator}</div>
      <div class="flex items-center gap-0.5 pl-1 border-l border-[#333]">
        <button type="button" id="add-annotation" class="${BTN_HIGHLIGHT}" title="Highlight selection">${ICONS.highlight}</button>
        <button type="button" id="annotator-btn-showdb" class="${BTN}" title="Show annotations DB">${ICONS.database}</button>
        <button type="button" id="annotator-btn-delete" class="${BTN}" title="Delete selected highlight">${ICONS.delete}</button>
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

export function injectToolbar(): boolean {
  if (document.getElementById(PANEL_ID)) return false;

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = buildToolbarHTML();
  document.body.appendChild(panel);

  setupToolbarDrag();
  return true;
}
