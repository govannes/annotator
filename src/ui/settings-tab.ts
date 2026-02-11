/**
 * Settings tab: highlight color, sidebar position/width, "Go to portal" link.
 */

import {
  getSidebarPosition,
  setSidebarPosition,
  getSidebarWidth,
  setSidebarWidth,
  getHighlightColor,
  setHighlightColor,
  SIDEBAR_WIDTH_SMALL,
  SIDEBAR_WIDTH_MEDIUM,
  SIDEBAR_WIDTH_LARGE,
  HIGHLIGHT_COLOR_PRESETS,
} from './sidebar-prefs';
import type { SidebarPosition } from './sidebar-prefs';
import { SIDEBAR_POSITION_CHANGED_EVENT } from './sidebar-shell';

export interface SettingsTabDeps {
  /** Portal URL for "Go to portal". If empty, link is hidden. */
  portalUrl: string;
  /** Called when sidebar position/width changes so shell can re-apply (e.g. reinject). */
  onSidebarPrefsChanged?: () => void;
}

export function renderSettingsTab(container: HTMLElement, deps: SettingsTabDeps): void {
  const { portalUrl, onSidebarPrefsChanged } = deps;
  container.innerHTML = '';
  container.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    color: #374151;
    font-size: 14px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  `;

  // ----- Highlight color -----
  const highlightSection = document.createElement('section');
  highlightSection.style.cssText = 'flex-shrink: 0;';
  const highlightTitle = document.createElement('h3');
  highlightTitle.style.cssText = 'margin: 0 0 10px; font-size: 13px; font-weight: 600; color: #111;';
  highlightTitle.textContent = 'Highlight';
  highlightSection.appendChild(highlightTitle);
  const highlightLabel = document.createElement('label');
  highlightLabel.style.cssText = 'display: block; font-size: 12px; color: #6b7280; margin-bottom: 6px;';
  highlightLabel.textContent = 'Default highlight color';
  highlightSection.appendChild(highlightLabel);
  const colorSelect = document.createElement('select');
  colorSelect.style.cssText = `
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
    color: #374151;
    background: #fff;
  `;
  const current = getHighlightColor();
  HIGHLIGHT_COLOR_PRESETS.forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (value === current) opt.selected = true;
    colorSelect.appendChild(opt);
  });
  colorSelect.addEventListener('change', () => {
    setHighlightColor(colorSelect.value);
  });
  highlightSection.appendChild(colorSelect);
  container.appendChild(highlightSection);

  // ----- Sidebar position -----
  const positionSection = document.createElement('section');
  positionSection.style.cssText = 'flex-shrink: 0;';
  const positionTitle = document.createElement('h3');
  positionTitle.style.cssText = 'margin: 0 0 10px; font-size: 13px; font-weight: 600; color: #111;';
  positionTitle.textContent = 'Sidebar';
  positionSection.appendChild(positionTitle);
  const positionLabel = document.createElement('label');
  positionLabel.style.cssText = 'display: block; font-size: 12px; color: #6b7280; margin-bottom: 6px;';
  positionLabel.textContent = 'Position';
  positionSection.appendChild(positionLabel);
  const positionSelect = document.createElement('select');
  positionSelect.style.cssText = `
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
    color: #374151;
    background: #fff;
  `;
  (['right', 'left'] as SidebarPosition[]).forEach((pos) => {
    const opt = document.createElement('option');
    opt.value = pos;
    opt.textContent = pos === 'left' ? 'Left' : 'Right';
    if (pos === getSidebarPosition()) opt.selected = true;
    positionSelect.appendChild(opt);
  });
  positionSelect.addEventListener('change', () => {
    setSidebarPosition(positionSelect.value as SidebarPosition);
    window.dispatchEvent(new Event(SIDEBAR_POSITION_CHANGED_EVENT));
    onSidebarPrefsChanged?.();
  });
  positionSection.appendChild(positionSelect);

  const widthLabel = document.createElement('label');
  widthLabel.style.cssText = 'display: block; font-size: 12px; color: #6b7280; margin: 12px 0 6px;';
  widthLabel.textContent = 'Width';
  positionSection.appendChild(widthLabel);
  const widthSelect = document.createElement('select');
  widthSelect.style.cssText = `
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
    color: #374151;
    background: #fff;
  `;
  const widthPresets = [
    { value: SIDEBAR_WIDTH_SMALL, label: 'Small (320px)' },
    { value: SIDEBAR_WIDTH_MEDIUM, label: 'Medium (420px)' },
    { value: SIDEBAR_WIDTH_LARGE, label: 'Large (560px)' },
  ];
  const currentWidth = getSidebarWidth();
  widthPresets.forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = String(value);
    opt.textContent = label;
    if (value === currentWidth) opt.selected = true;
    widthSelect.appendChild(opt);
  });
  widthSelect.addEventListener('change', () => {
    setSidebarWidth(Number(widthSelect.value));
    onSidebarPrefsChanged?.();
  });
  positionSection.appendChild(widthSelect);
  container.appendChild(positionSection);

  // ----- Go to portal -----
  if (portalUrl) {
    const portalSection = document.createElement('section');
    portalSection.style.cssText = 'flex-shrink: 0; margin-top: auto; padding-top: 16px; border-top: 1px solid #e5e7eb;';
    const portalLink = document.createElement('a');
    portalLink.href = portalUrl;
    portalLink.target = '_blank';
    portalLink.rel = 'noopener noreferrer';
    portalLink.textContent = 'Go to portal';
    portalLink.style.cssText = `
      display: inline-block;
      font-size: 14px;
      color: #2563eb;
      text-decoration: none;
      padding: 8px 12px;
      border-radius: 6px;
      background: #eff6ff;
    `;
    portalLink.addEventListener('mouseenter', () => { portalLink.style.background = '#dbeafe'; });
    portalLink.addEventListener('mouseleave', () => { portalLink.style.background = '#eff6ff'; });
    portalSection.appendChild(portalLink);
    container.appendChild(portalSection);
  }
}
