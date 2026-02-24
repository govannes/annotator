interface ColorMeaning {
  color: string;
  name: string;
  badge: string;
  count: number;
}

const COLORS = [
  { color: '#f59e0b', name: 'Headlines' },
  { color: '#fb923c', name: 'CTAs' },
  { color: '#84cc16', name: 'Inspo' },
  { color: '#fb7185', name: 'Avoid' },
  { color: '#38bdf8', name: 'Research' },
];

const COLOR_MEANINGS: ColorMeaning[] = [
  { color: '#f59e0b', name: 'Headlines', badge: 'headlines', count: 84 },
  { color: '#fb923c', name: 'CTAs', badge: 'ctas', count: 61 },
  { color: '#84cc16', name: 'Inspo', badge: 'inspo', count: 52 },
  { color: '#fb7185', name: 'Avoid', badge: 'avoid', count: 29 },
  { color: '#38bdf8', name: 'Research', badge: 'research', count: 21 },
];

let selectedIdx = 0;

export function renderColorsPanel(body: HTMLElement): void {
  body.style.padding = '0';
  body.innerHTML = '';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--ap-border);flex-shrink:0';
  const title = document.createElement('div');
  title.style.cssText = 'font-size:11px;font-weight:600;color:var(--ap-muted);letter-spacing:.1em;text-transform:uppercase;font-family:monospace';
  title.textContent = 'Highlight Colors';
  header.appendChild(title);
  body.appendChild(header);

  const content = document.createElement('div');
  content.style.cssText = 'padding:13px 14px;display:flex;flex-direction:column;gap:13px';

  const activeSection = document.createElement('div');
  const activeTitle = document.createElement('div');
  activeTitle.style.cssText = 'font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ap-muted);font-family:monospace;margin-bottom:8px';
  activeTitle.textContent = 'Active color';
  activeSection.appendChild(activeTitle);

  const swatchRow = document.createElement('div');
  swatchRow.style.cssText = 'display:flex;gap:8px;align-items:center';

  COLORS.forEach((c, i) => {
    const swatch = document.createElement('div');
    swatch.style.cssText = `width:28px;height:28px;border-radius:50%;cursor:pointer;border:2px solid ${i === selectedIdx ? 'white' : 'transparent'};transition:all .13s;flex-shrink:0;background:${c.color}`;
    if (i === selectedIdx) {
      swatch.style.boxShadow = `0 0 0 2px ${c.color}`;
    }
    swatch.addEventListener('mouseenter', () => { swatch.style.transform = 'scale(1.12)'; });
    swatch.addEventListener('mouseleave', () => { swatch.style.transform = 'scale(1)'; });
    swatch.addEventListener('click', () => {
      selectedIdx = i;
      renderColorsPanel(body);
    });
    swatchRow.appendChild(swatch);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.style.cssText = 'width:28px;height:28px;border-radius:50%;border:2px dashed var(--ap-border);background:transparent;color:var(--ap-muted);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .12s;flex-shrink:0;line-height:1';
  addBtn.textContent = '+';
  addBtn.addEventListener('mouseenter', () => { addBtn.style.borderColor = 'var(--ap-text)'; addBtn.style.color = 'var(--ap-text)'; });
  addBtn.addEventListener('mouseleave', () => { addBtn.style.borderColor = 'var(--ap-border)'; addBtn.style.color = 'var(--ap-muted)'; });
  swatchRow.appendChild(addBtn);

  activeSection.appendChild(swatchRow);
  content.appendChild(activeSection);

  const meaningsSection = document.createElement('div');
  const meaningsTitle = document.createElement('div');
  meaningsTitle.style.cssText = 'font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ap-muted);font-family:monospace;margin-bottom:8px';
  meaningsTitle.textContent = 'Color meanings';
  meaningsSection.appendChild(meaningsTitle);

  const meaningsList = document.createElement('div');
  meaningsList.style.cssText = 'display:flex;flex-direction:column;gap:4px';

  COLOR_MEANINGS.forEach((cm) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:9px;padding:7px 10px;background:var(--ap-surface);border-radius:8px;cursor:pointer;transition:background .1s';
    row.addEventListener('mouseenter', () => { row.style.background = 'var(--ap-hover)'; });
    row.addEventListener('mouseleave', () => { row.style.background = 'var(--ap-surface)'; });

    const dot = document.createElement('div');
    dot.style.cssText = `width:9px;height:9px;border-radius:50%;flex-shrink:0;background:${cm.color}`;
    row.appendChild(dot);

    const name = document.createElement('div');
    name.style.cssText = 'font-size:13px;color:var(--ap-text);flex:1';
    name.textContent = cm.name;
    row.appendChild(name);

    const badge = document.createElement('div');
    badge.style.cssText = 'font-size:10px;font-family:monospace;padding:2px 7px;border-radius:10px;color:var(--ap-muted);background:var(--ap-hover)';
    badge.textContent = cm.badge;
    row.appendChild(badge);

    const count = document.createElement('div');
    count.style.cssText = 'font-size:10px;color:var(--ap-muted);font-family:monospace';
    count.textContent = String(cm.count);
    row.appendChild(count);

    meaningsList.appendChild(row);
  });

  meaningsSection.appendChild(meaningsList);
  content.appendChild(meaningsSection);
  body.appendChild(content);
}
