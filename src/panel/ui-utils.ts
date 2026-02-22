import { getShadowRoot } from './shadow-host';

let tooltipEl: HTMLElement | null = null;

export function showTooltip(anchor: HTMLElement, text: string): void {
  hideTooltip();
  const tip = document.createElement('div');
  tip.className =
    'an:fixed an:z-[2147483647] an:py-1 an:px-2.5 an:rounded an:text-[11px] an:font-sans ' +
    'an:whitespace-nowrap an:pointer-events-none an:select-none';
  tip.style.backgroundColor = '#1a1a1a';
  tip.style.color = '#eee';
  tip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
  tip.textContent = text;
  getShadowRoot().appendChild(tip);

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

export function hideTooltip(): void {
  if (tooltipEl) {
    tooltipEl.remove();
    tooltipEl = null;
  }
}
