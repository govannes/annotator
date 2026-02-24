const SVG_REGION = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
const SVG_DOM_EL = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>';
const SVG_FULL = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
const SVG_CAMERA = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 0 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';

let activeRegion = 0;
const collections = ['Inspo', 'Headlines', 'CTAs', 'Avoid', 'Research'];

export function renderScreenshotPanel(body: HTMLElement): void {
  body.style.padding = '0';
  body.innerHTML = '';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--ap-border);flex-shrink:0';
  const title = document.createElement('div');
  title.style.cssText = 'font-size:11px;font-weight:600;color:var(--ap-muted);letter-spacing:.1em;text-transform:uppercase;font-family:monospace';
  title.textContent = 'Screenshot';
  header.appendChild(title);
  body.appendChild(header);

  const preview = document.createElement('div');
  preview.style.cssText = 'margin:12px 14px;border:1px solid var(--ap-border);border-radius:10px;overflow:hidden;cursor:pointer;position:relative';

  const mockScreen = document.createElement('div');
  mockScreen.style.cssText = 'width:100%;height:110px;background:var(--ap-surface);padding:10px 14px;display:flex;flex-direction:column;gap:5px;position:relative';
  const barWidths = ['55%', '80%', '68%', '45%', '75%', '60%', '82%'];
  const hlIndices = [2, 5];
  barWidths.forEach((w, i) => {
    const bar = document.createElement('div');
    bar.style.cssText = `height:5px;border-radius:3px;width:${w}`;
    if (hlIndices.includes(i)) {
      bar.style.background = 'rgba(245,158,11,0.27)';
      bar.style.borderBottom = '1px solid #f59e0b';
    } else {
      bar.style.background = 'var(--ap-border)';
    }
    mockScreen.appendChild(bar);
  });
  preview.appendChild(mockScreen);

  const hoverOverlay = document.createElement('div');
  hoverOverlay.style.cssText = 'position:absolute;inset:0;border:2px dashed var(--ap-muted);border-radius:10px;background:var(--ap-surface);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .18s';
  const hoverLabel = document.createElement('div');
  hoverLabel.style.cssText = 'font-size:12px;color:var(--ap-muted);font-family:monospace';
  hoverLabel.textContent = 'Click to select region';
  hoverOverlay.appendChild(hoverLabel);
  preview.appendChild(hoverOverlay);

  preview.addEventListener('mouseenter', () => { hoverOverlay.style.opacity = '1'; });
  preview.addEventListener('mouseleave', () => { hoverOverlay.style.opacity = '0'; });
  body.appendChild(preview);

  const regionRow = document.createElement('div');
  regionRow.style.cssText = 'display:flex;gap:6px;padding:0 14px 10px';

  const regionBtns = [
    { svg: SVG_REGION, label: 'Select region' },
    { svg: SVG_DOM_EL, label: 'DOM element' },
    { svg: SVG_FULL, label: 'Full page' },
  ];

  regionBtns.forEach((cfg, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = 'flex:1;padding:9px 8px;border-radius:9px;border:1px solid var(--ap-border);background:var(--ap-surface);color:var(--ap-muted);font-size:12px;font-family:inherit;cursor:pointer;transition:all .12s;display:flex;flex-direction:column;align-items:center;gap:5px';
    if (i === activeRegion) {
      btn.style.borderColor = 'var(--ap-text)';
      btn.style.color = 'var(--ap-text)';
    }
    btn.innerHTML = cfg.svg;
    const span = document.createElement('span');
    span.textContent = cfg.label;
    btn.appendChild(span);

    btn.addEventListener('click', () => {
      activeRegion = i;
      renderScreenshotPanel(body);
    });
    btn.addEventListener('mouseenter', () => {
      if (i !== activeRegion) btn.style.borderColor = 'var(--ap-muted)';
    });
    btn.addEventListener('mouseleave', () => {
      if (i !== activeRegion) btn.style.borderColor = 'var(--ap-border)';
    });
    regionRow.appendChild(btn);
  });
  body.appendChild(regionRow);

  const footerRow = document.createElement('div');
  footerRow.style.cssText = 'padding:0 14px 14px;display:flex;gap:8px;align-items:center';

  const colLabel = document.createElement('span');
  colLabel.style.cssText = 'font-size:12px;color:var(--ap-muted);flex-shrink:0';
  colLabel.textContent = 'Save to';
  footerRow.appendChild(colLabel);

  const select = document.createElement('select');
  select.style.cssText = 'flex:1;background:var(--ap-surface);border:1px solid var(--ap-border);border-radius:7px;padding:6px 10px;font-size:12px;color:var(--ap-text);font-family:inherit;outline:none;cursor:pointer';
  collections.forEach((c) => {
    const opt = document.createElement('option');
    opt.textContent = c;
    select.appendChild(opt);
  });
  footerRow.appendChild(select);

  const captureBtn = document.createElement('button');
  captureBtn.type = 'button';
  captureBtn.style.cssText = 'background:var(--ap-text);border:none;border-radius:8px;padding:7px 14px;color:var(--ap-bg);font-size:12.5px;font-weight:600;font-family:inherit;cursor:pointer;transition:opacity .12s;white-space:nowrap;display:flex;align-items:center;gap:5px';
  captureBtn.innerHTML = SVG_CAMERA + ' Capture';
  captureBtn.addEventListener('mouseenter', () => { captureBtn.style.opacity = '0.88'; });
  captureBtn.addEventListener('mouseleave', () => { captureBtn.style.opacity = '1'; });
  footerRow.appendChild(captureBtn);

  body.appendChild(footerRow);
}
