const SVG_TEXT = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>';
const SVG_DOM = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>';

let captureMode: 'text' | 'dom' = 'text';
let autoSave = true;

export function renderCapturePanel(body: HTMLElement): void {
  body.style.padding = '0';
  body.innerHTML = '';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--ap-border);flex-shrink:0';
  const title = document.createElement('div');
  title.style.cssText = 'font-size:11px;font-weight:600;color:var(--ap-muted);letter-spacing:.1em;text-transform:uppercase;font-family:monospace';
  title.textContent = 'Capture Mode';
  header.appendChild(title);
  body.appendChild(header);

  const options = document.createElement('div');
  options.style.cssText = 'display:flex;gap:7px;padding:12px 14px';

  function buildOpt(svg: string, label: string, desc: string, key: string, mode: 'text' | 'dom'): HTMLElement {
    const opt = document.createElement('div');
    opt.style.cssText = 'flex:1;padding:13px 10px;border-radius:11px;border:1px solid var(--ap-border);background:var(--ap-surface);color:var(--ap-muted);cursor:pointer;transition:all .15s;display:flex;flex-direction:column;align-items:center;gap:8px;font-family:inherit';
    if (captureMode === mode) {
      opt.style.borderColor = 'var(--ap-text)';
      opt.style.color = 'var(--ap-text)';
    }

    opt.innerHTML = svg;

    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:13px;font-weight:500';
    lbl.textContent = label;
    opt.appendChild(lbl);

    const d = document.createElement('div');
    d.style.cssText = 'font-size:11px;text-align:center;line-height:1.4;color:var(--ap-muted)';
    d.textContent = desc;
    opt.appendChild(d);

    const k = document.createElement('div');
    k.style.cssText = 'font-family:monospace;font-size:10px;background:var(--ap-hover);padding:2px 7px;border-radius:4px;color:var(--ap-muted)';
    k.textContent = key;
    opt.appendChild(k);

    opt.addEventListener('click', () => {
      captureMode = mode;
      renderCapturePanel(body);
    });

    opt.addEventListener('mouseenter', () => {
      if (captureMode !== mode) opt.style.borderColor = 'var(--ap-muted)';
    });
    opt.addEventListener('mouseleave', () => {
      if (captureMode !== mode) opt.style.borderColor = 'var(--ap-border)';
    });

    return opt;
  }

  options.appendChild(buildOpt(SVG_TEXT, 'Text Select', 'Highlight any text selection on the page', 'T', 'text'));
  options.appendChild(buildOpt(SVG_DOM, 'DOM Element', 'Click to capture entire page elements', 'D', 'dom'));
  body.appendChild(options);

  const footer = document.createElement('div');
  footer.style.cssText = 'padding:0 14px 12px;display:flex;flex-direction:column;gap:6px';

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:9px 11px;background:var(--ap-surface);border-radius:9px';

  const rowInfo = document.createElement('div');
  rowInfo.style.cssText = 'flex:1';

  const rowLabel = document.createElement('div');
  rowLabel.style.cssText = 'font-size:13px;color:var(--ap-text)';
  rowLabel.textContent = 'Auto-save on select';
  rowInfo.appendChild(rowLabel);

  const rowSub = document.createElement('div');
  rowSub.style.cssText = 'font-size:11px;color:var(--ap-muted);margin-top:1px';
  rowSub.textContent = 'No confirmation, instant capture';
  rowInfo.appendChild(rowSub);

  row.appendChild(rowInfo);

  const toggle = document.createElement('div');
  toggle.style.cssText = `width:32px;height:18px;background:${autoSave ? 'var(--ap-text)' : 'var(--ap-border)'};border-radius:9px;position:relative;cursor:pointer;transition:background .2s;flex-shrink:0`;
  const knob = document.createElement('div');
  knob.style.cssText = `position:absolute;width:14px;height:14px;background:white;border-radius:50%;top:2px;left:${autoSave ? '16px' : '2px'};transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)`;
  toggle.appendChild(knob);
  toggle.addEventListener('click', () => {
    autoSave = !autoSave;
    toggle.style.background = autoSave ? 'var(--ap-text)' : 'var(--ap-border)';
    knob.style.left = autoSave ? '16px' : '2px';
  });
  row.appendChild(toggle);
  footer.appendChild(row);

  const kbRow = document.createElement('div');
  kbRow.style.cssText = 'display:flex;gap:5px;align-items:center;padding:7px 11px;background:var(--ap-surface);border-radius:9px';

  function addKb(parent: HTMLElement, key: string, desc: string, ml?: boolean): void {
    const k = document.createElement('span');
    k.style.cssText = `font-family:monospace;font-size:11px;padding:2px 7px;background:var(--ap-hover);border:1px solid var(--ap-border);border-radius:4px;color:var(--ap-text)${ml ? ';margin-left:auto' : ''}`;
    k.textContent = key;
    parent.appendChild(k);
    const d = document.createElement('span');
    d.style.cssText = 'font-size:11px;color:var(--ap-muted);margin-left:2px';
    d.textContent = desc;
    parent.appendChild(d);
  }

  addKb(kbRow, 'Q', 'Toggle quick capture');
  addKb(kbRow, 'Esc', 'Cancel', true);
  footer.appendChild(kbRow);

  body.appendChild(footer);
}
