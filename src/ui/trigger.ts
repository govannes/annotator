/**
 * Bookmark-style trigger tab: collapsed tab on the edge, hover expands to show
 * logo, close button, and Y-position drag handle. Click opens the sidebar.
 */

import {
  getSidebarPosition,
  getTriggerYPercent,
  setTriggerYPercent,
  type SidebarPosition,
} from './sidebar-prefs';

const TRIGGER_ID = 'annotator-sidebar-trigger';

const BIRD_LEFT =
  'M12 4c-2 1.5-3 4-3 6s1 4 3 5.5c0 0 1 1 1 2 0 1-.5 1.5-1 1.5s-1-.5-1-1c0 0-1.5.5-2.5 0C5.5 17 4 15 4 12s1.5-5 3.5-6.5C7.5 5 9 5 9 5c0-.5.5-1 1-1s1 .5 1 1c2-1.5 4-2 6-1 .5.5 1 1.5 1 2.5s-.5 2-1 2.5c1 0 2-.5 2-1.5s-1-2.5-2-3.5C16 5 14 4 12 4z';
const BIRD_RIGHT =
  'M12 20c2-1.5 3-4 3-6s-1-4-3-5.5c0 0-1-1-1-2 0-1 .5-1.5 1-1.5s1 .5 1 1c0 0 1.5-.5 2.5 0C18.5 7 20 9 20 12s-1.5 5-3.5 6.5C16.5 19 15 19 15 19c0 .5-.5 1-1 1s-1-.5-1-1c-2 1.5-4 2-6 1-.5-.5-1-1.5-1-2.5s.5-2 1-2.5c-1 0-2 .5-2 1.5s1 2.5 2 3.5C8 19 10 20 12 20z';

export interface TriggerOptions {
  onOpen: () => void;
  onClose: () => void;
  /** Current side (left/right). When changed in Settings, trigger re-positions to this side. */
  getSide?: () => SidebarPosition;
}

function getPosition(getSide?: () => SidebarPosition): SidebarPosition {
  return getSide?.() ?? getSidebarPosition();
}

export interface TriggerApi {
  __applyPosition?: () => void;
}

export function createTrigger(options: TriggerOptions): HTMLElement & TriggerApi {
  const { onOpen, onClose, getSide } = options;

  let yPercent = getTriggerYPercent();

  const wrap = document.createElement('div') as HTMLElement & TriggerApi;
  wrap.id = TRIGGER_ID;
  wrap.setAttribute('aria-label', 'Open annotations');

  function applyPosition(): void {
    const position = getPosition(getSide);
    const isLeft = position === 'left';
    const birdPath = isLeft ? BIRD_LEFT : BIRD_RIGHT;
    wrap.style.left = isLeft ? '0' : '';
    wrap.style.right = isLeft ? '' : '0';
    tab.style.boxShadow = isLeft ? '2px 0 8px rgba(0,0,0,0.2)' : '-2px 0 8px rgba(0,0,0,0.2)';
    tab.style.borderRadius = isLeft ? '0 12px 12px 0' : '12px 0 0 12px';
    closeBtn.style.left = isLeft ? '-6px' : '';
    closeBtn.style.right = isLeft ? '' : '-6px';
    logo.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.95;">
        <path d="${birdPath}"/>
      </svg>
    `;
  }

  const position0 = getPosition(getSide);
  const isLeft = position0 === 'left';
  const birdPath = isLeft ? BIRD_LEFT : BIRD_RIGHT;

  wrap.style.cssText = `
    position: fixed;
    top: ${yPercent}%;
    ${isLeft ? 'left: 0' : 'right: 0'};
    transform: translateY(-50%);
    z-index: 2147483646;
    font-family: system-ui, -apple-system, sans-serif;
    display: flex;
    align-items: center;
    transition: top 0.05s ease-out;
  `;

  const tab = document.createElement('div');
  tab.className = 'annotator-trigger-tab';
  tab.style.cssText = `
    position: relative;
    display: flex;
    align-items: center;
    height: 52px;
    min-width: 20px;
    width: 20px;
    padding: 0;
    box-sizing: border-box;
    background: #22c55e;
    box-shadow: ${isLeft ? '2px' : '-2px'} 0 8px rgba(0,0,0,0.2);
    border: none;
    border-radius: ${isLeft ? '0 12px 12px 0' : '12px 0 0 12px'};
    cursor: pointer;
    transition: width 0.2s ease, min-width 0.2s ease, padding 0.2s ease;
    overflow: visible;
  `;

  const logo = document.createElement('div');
  logo.className = 'annotator-trigger-bubble';
  logo.style.cssText = `
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 4px;
  `;
  logo.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.95;">
      <path d="${birdPath}"/>
    </svg>
  `;
  logo.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onOpen();
  });

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.style.cssText = `
    position: absolute;
    top: -6px;
    ${isLeft ? 'left: -6px' : 'right: -6px'};
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1px solid #d1d5db;
    background: #f9fafb;
    color: #374151;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    line-height: 1;
    transition: background 0.15s, color 0.15s, opacity 0.2s ease;
    opacity: 0;
    box-shadow: 0 1px 4px rgba(0,0,0,0.15);
  `;
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  });
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.background = '#eee';
    closeBtn.style.color = '#111';
  });
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.background = '#f9fafb';
    closeBtn.style.color = '#374151';
  });

  const dragHandle = document.createElement('div');
  dragHandle.setAttribute('aria-label', 'Drag to move');
  dragHandle.style.cssText = `
    flex-shrink: 0;
    width: 12px;
    height: 44px;
    margin-left: 4px;
    margin-right: 4px;
    background: rgba(255,255,255,0.25);
    border-radius: 4px;
    cursor: grab;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    transition: width 0.2s ease, margin 0.2s ease, opacity 0.2s ease;
    overflow: hidden;
    opacity: 0;
    width: 0;
    margin-left: 0;
    margin-right: 0;
  `;
  dragHandle.innerHTML = `
    <span style="width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,0.9);"></span>
    <span style="width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,0.9);"></span>
    <span style="width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,0.9);"></span>
  `;

  tab.appendChild(closeBtn);
  tab.appendChild(logo);
  tab.appendChild(dragHandle);

  function expand(): void {
    tab.style.width = 'auto';
    tab.style.minWidth = '110px';
    tab.style.padding = isLeft ? '0 6px 0 4px' : '0 4px 0 6px';
    logo.style.transform = 'scale(1)';
    closeBtn.style.opacity = '1';
    dragHandle.style.width = '12px';
    dragHandle.style.marginLeft = '4px';
    dragHandle.style.marginRight = '4px';
    dragHandle.style.opacity = '1';
  }
  function collapse(): void {
    tab.style.width = '20px';
    tab.style.minWidth = '20px';
    tab.style.padding = '0';
    logo.style.transform = 'scale(0.5)';
    closeBtn.style.opacity = '0';
    dragHandle.style.width = '0';
    dragHandle.style.marginLeft = '0';
    dragHandle.style.marginRight = '0';
    dragHandle.style.opacity = '0';
  }

  logo.style.transition = 'transform 0.2s ease';

  tab.addEventListener('mouseenter', expand);
  tab.addEventListener('mouseleave', collapse);
  collapse();

  wrap.appendChild(tab);

  function applyY(): void {
    yPercent = getTriggerYPercent();
    wrap.style.top = `${yPercent}%`;
  }

  dragHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startPercent = getTriggerYPercent();

    function onMove(ev: MouseEvent): void {
      const deltaY = ev.clientY - startY;
      const viewHeight = window.innerHeight;
      const deltaPercent = (deltaY / viewHeight) * 100;
      let next = startPercent + deltaPercent;
      next = Math.max(0, Math.min(100, next));
      setTriggerYPercent(next);
      applyY();
    }
    function onUp(): void {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  applyY();
  wrap.__applyPosition = applyPosition;
  return wrap;
}

export function getTriggerRootId(): string {
  return TRIGGER_ID;
}
