interface SettingsToggle {
  icon: string;
  label: string;
  on: boolean;
}

const toggles: SettingsToggle[] = [
  { icon: '\u26a1', label: 'Auto-save on select', on: true },
  { icon: '\ud83d\udd14', label: 'Capture confirmation', on: true },
  { icon: '\ud83c\udfa8', label: 'Color maps to collection', on: true },
];

export function renderSettingsPanel(body: HTMLElement): void {
  body.style.padding = '0';
  body.innerHTML = '';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--ap-border);flex-shrink:0';
  const title = document.createElement('div');
  title.style.cssText = 'font-size:11px;font-weight:600;color:var(--ap-muted);letter-spacing:.1em;text-transform:uppercase;font-family:monospace';
  title.textContent = 'Settings';
  header.appendChild(title);
  body.appendChild(header);

  const scrollBody = document.createElement('div');
  scrollBody.style.cssText = 'overflow-y:auto;flex:1';

  function addSection(label: string): void {
    const s = document.createElement('div');
    s.style.cssText = 'padding:10px 14px 3px;font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ap-muted);font-family:monospace';
    s.textContent = label;
    scrollBody.appendChild(s);
  }

  function addRow(icon: string, label: string, value: string): void {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;transition:background .1s';
    row.addEventListener('mouseenter', () => { row.style.background = 'var(--ap-surface)'; });
    row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });

    const ic = document.createElement('span');
    ic.style.cssText = 'font-size:14px;width:20px;text-align:center;flex-shrink:0;opacity:.75';
    ic.textContent = icon;
    row.appendChild(ic);

    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:13px;color:var(--ap-text);flex:1';
    lbl.textContent = label;
    row.appendChild(lbl);

    const val = document.createElement('span');
    val.style.cssText = 'font-size:11px;color:var(--ap-muted);font-family:monospace';
    val.textContent = value;
    row.appendChild(val);

    const arrow = document.createElement('span');
    arrow.style.cssText = 'font-size:11px;color:var(--ap-muted)';
    arrow.textContent = '\u203a';
    row.appendChild(arrow);

    scrollBody.appendChild(row);
  }

  function addToggleRow(icon: string, label: string, initialOn: boolean): void {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;transition:background .1s';
    row.addEventListener('mouseenter', () => { row.style.background = 'var(--ap-surface)'; });
    row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });

    const ic = document.createElement('span');
    ic.style.cssText = 'font-size:14px;width:20px;text-align:center;flex-shrink:0;opacity:.75';
    ic.textContent = icon;
    row.appendChild(ic);

    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:13px;color:var(--ap-text);flex:1';
    lbl.textContent = label;
    row.appendChild(lbl);

    let isOn = initialOn;
    const toggle = document.createElement('div');
    toggle.style.cssText = `width:32px;height:18px;background:${isOn ? 'var(--ap-text)' : 'var(--ap-border)'};border-radius:9px;position:relative;cursor:pointer;transition:background .2s;flex-shrink:0`;
    const knob = document.createElement('div');
    knob.style.cssText = `position:absolute;width:14px;height:14px;background:white;border-radius:50%;top:2px;left:${isOn ? '16px' : '2px'};transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)`;
    toggle.appendChild(knob);

    row.addEventListener('click', () => {
      isOn = !isOn;
      toggle.style.background = isOn ? 'var(--ap-text)' : 'var(--ap-border)';
      knob.style.left = isOn ? '16px' : '2px';
    });

    row.appendChild(toggle);
    scrollBody.appendChild(row);
  }

  function addDivider(): void {
    const d = document.createElement('div');
    d.style.cssText = 'height:1px;background:var(--ap-border);margin:4px 0';
    scrollBody.appendChild(d);
  }

  addSection('Appearance');
  addRow('\u25d1', 'Theme', 'Dark ink');
  addRow('\u229e', 'Panel mode', 'Popover');
  addDivider();

  addSection('Capture');
  toggles.forEach((t) => addToggleRow(t.icon, t.label, t.on));
  addDivider();

  addSection('Collections');
  addRow('\u25c8', 'Manage collections', '5 active');
  addDivider();

  addSection('Sync & Export');
  addRow('\u2601', 'Account', 'jane@copy.co');
  addRow('\u2b06', 'Export format', 'Markdown');
  addRow('\u29c9', 'Integrations', 'Notion');
  addDivider();

  addSection('AI');
  addRow('\u2726', 'Model', 'Claude Sonnet');
  addRow('\ud83d\udd11', 'API Key', '\u2022\u2022\u2022\u2022a3f2');
  addDivider();

  const openRow = document.createElement('div');
  openRow.style.cssText = 'display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;transition:background .1s;opacity:.6';

  const openIcon = document.createElement('span');
  openIcon.style.cssText = 'font-size:14px;width:20px;text-align:center;flex-shrink:0;opacity:.75';
  openIcon.textContent = '\u2197';
  openRow.appendChild(openIcon);

  const openLabel = document.createElement('span');
  openLabel.style.cssText = 'font-size:13px;color:var(--ap-text);flex:1';
  openLabel.textContent = 'Open web app';
  openRow.appendChild(openLabel);

  scrollBody.appendChild(openRow);
  body.appendChild(scrollBody);
}
