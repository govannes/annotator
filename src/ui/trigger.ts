/**
 * Floating trigger button (bird-in-bubble style) to open the sidebar.
 * Position (left/right) comes from sidebar-prefs; full-height vertical placement.
 */

import { getSidebarPosition, type SidebarPosition } from './sidebar-prefs';

const TRIGGER_ID = 'annotator-sidebar-trigger';

/** Bird outline pointing left, in a speech-bubble style container. */
function triggerInnerHTML(position: SidebarPosition): string {
  const isLeft = position === 'left';
  /* bird facing left: simple outline */
  const birdPath = isLeft
    ? 'M12 4c-2 1.5-3 4-3 6s1 4 3 5.5c0 0 1 1 1 2 0 1-.5 1.5-1 1.5s-1-.5-1-1c0 0-1.5.5-2.5 0C5.5 17 4 15 4 12s1.5-5 3.5-6.5C7.5 5 9 5 9 5c0-.5.5-1 1-1s1 .5 1 1c2-1.5 4-2 6-1 .5.5 1 1.5 1 2.5s-.5 2-1 2.5c1 0 2-.5 2-1.5s-1-2.5-2-3.5C16 5 14 4 12 4z'
    : 'M12 20c2-1.5 3-4 3-6s-1-4-3-5.5c0 0-1-1-1-2 0-1 .5-1.5 1-1.5s1 .5 1 1c0 0 1.5-.5 2.5 0C18.5 7 20 9 20 12s-1.5 5-3.5 6.5C16.5 19 15 19 15 19c0 .5-.5 1-1 1s-1-.5-1-1c-2 1.5-4 2-6 1-.5-.5-1-1.5-1-2.5s.5-2 1-2.5c-1 0-2 .5-2 1.5s1 2.5 2 3.5C8 19 10 20 12 20z';
  return `
    <div class="annotator-trigger-bubble" style="
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 2px 12px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    ">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.95;">
        <path d="${birdPath}"/>
      </svg>
    </div>
  `;
}

export function createTrigger(onClick: () => void): HTMLElement {
  const position = getSidebarPosition();
  const isLeft = position === 'left';

  const wrap = document.createElement('div');
  wrap.id = TRIGGER_ID;
  wrap.setAttribute('aria-label', 'Open annotations');
  wrap.style.cssText = `
    position: fixed;
    top: 50%;
    ${isLeft ? 'left: 0' : 'right: 0'};
    transform: translateY(-50%);
    z-index: 2147483646;
    font-family: system-ui, -apple-system, sans-serif;
  `;
  wrap.innerHTML = triggerInnerHTML(position);

  const bubble = wrap.querySelector('.annotator-trigger-bubble') as HTMLElement;
  if (bubble) {
    bubble.addEventListener('mouseenter', () => {
      bubble.style.transform = 'scale(1.05)';
      bubble.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)';
    });
    bubble.addEventListener('mouseleave', () => {
      bubble.style.transform = 'scale(1)';
      bubble.style.boxShadow = '0 2px 12px rgba(0,0,0,0.2)';
    });
    bubble.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
  }

  return wrap;
}

export function getTriggerRootId(): string {
  return TRIGGER_ID;
}
