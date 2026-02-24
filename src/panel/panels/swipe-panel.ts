interface SwipeItem {
  color: string;
  colorSoft: string;
  collection: string;
  quote: string;
  domain: string;
  tags: string[];
  note: string;
  date: string;
  type: 'highlight' | 'note' | 'screenshot';
}

const MOCK_ITEMS: SwipeItem[] = [
  { color: 'var(--ap-text)', colorSoft: 'var(--ap-surface)', collection: 'Headlines', quote: 'The real battle is won before anyone reads a single word.', domain: 'copyblogger.com', tags: ['email', 'urgency'], note: 'Cross this with the curiosity gap framework.', date: 'now', type: 'highlight' },
  { color: '#fb923c', colorSoft: 'rgba(251,146,60,0.1)', collection: 'CTAs', quote: 'Create an itch the reader can only scratch by opening the email.', domain: 'copyblogger.com', tags: ['curiosity', 'hooks'], note: 'Classic curiosity gap.', date: 'now', type: 'highlight' },
  { color: '#84cc16', colorSoft: 'rgba(132,204,22,0.1)', collection: 'Inspo', quote: 'We almost didn\'t launch this.', domain: 'blog.superhuman.com', tags: ['launch', 'curiosity'], note: 'Missing chapter technique.', date: 'now', type: 'highlight' },
  { color: '#fb7185', colorSoft: 'rgba(251,113,133,0.1)', collection: 'Avoid', quote: 'Fake urgency trains your list to ignore your deadlines.', domain: 'copyhackers.com', tags: ['urgency', 'avoid'], note: 'Keep as reminder.', date: '2h', type: 'highlight' },
  { color: 'var(--ap-text)', colorSoft: 'var(--ap-surface)', collection: 'Headlines', quote: 'Nobody buys a drill. They buy a hole in the wall.', domain: 'marketingexamples.com', tags: ['positioning'], note: 'Use this for every features vs benefits talk.', date: '1d', type: 'note' },
  { color: '#38bdf8', colorSoft: 'rgba(56,189,248,0.1)', collection: 'Research', quote: 'Features tell. Benefits sell. Emotions compel.', domain: 'copyhackers.com', tags: ['framework', 'emotions'], note: 'Three-layer hierarchy.', date: '2d', type: 'highlight' },
];

const SEGMENTS = ['All', 'Highlights', 'Notes', 'Screenshots'] as const;

let activeSegment: string = 'All';
let detailItem: SwipeItem | null = null;

function filteredItems(): SwipeItem[] {
  if (activeSegment === 'All') return MOCK_ITEMS;
  const typeMap: Record<string, string> = { Highlights: 'highlight', Notes: 'note', Screenshots: 'screenshot' };
  const t = typeMap[activeSegment] ?? '';
  return MOCK_ITEMS.filter((item) => item.type === t);
}

function buildListView(_body: HTMLElement, rerender: () => void): HTMLElement {
  const wrap = document.createElement('div');

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--ap-border);flex-shrink:0';

  const seg = document.createElement('div');
  seg.style.cssText = 'display:flex;background:var(--ap-surface);border-radius:8px;padding:3px;gap:2px;flex:1';

  SEGMENTS.forEach((s) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = 'padding:4px 10px;border-radius:5px;border:none;background:transparent;color:var(--ap-muted);font-size:12px;font-family:inherit;font-weight:500;cursor:pointer;transition:all .12s;white-space:nowrap';
    if (s === activeSegment) {
      btn.style.background = 'var(--ap-hover)';
      btn.style.color = 'var(--ap-text)';
    }
    btn.textContent = s;
    btn.addEventListener('click', () => {
      activeSegment = s;
      rerender();
    });
    seg.appendChild(btn);
  });
  header.appendChild(seg);

  const search = document.createElement('input');
  search.type = 'text';
  search.placeholder = 'Search\u2026';
  search.style.cssText = 'width:100px;flex:0;margin-left:6px;background:var(--ap-surface);border:1px solid var(--ap-border);border-radius:8px;padding:6px 10px;font-size:13px;color:var(--ap-text);font-family:inherit;outline:none;transition:border-color .15s';
  search.addEventListener('focus', () => { search.style.borderColor = 'var(--ap-muted)'; });
  search.addEventListener('blur', () => { search.style.borderColor = 'var(--ap-border)'; });
  header.appendChild(search);
  wrap.appendChild(header);

  const listBody = document.createElement('div');
  listBody.style.cssText = 'overflow-y:auto;flex:1';

  const items = filteredItems();
  items.forEach((item) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;transition:background .1s;border-bottom:1px solid var(--ap-border)';
    row.addEventListener('mouseenter', () => { row.style.background = 'var(--ap-surface)'; });
    row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });

    const dot = document.createElement('div');
    dot.style.cssText = `width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${item.color}`;
    row.appendChild(dot);

    const text = document.createElement('div');
    text.style.cssText = 'font-size:13px;color:var(--ap-text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:serif;font-style:italic';
    text.textContent = `\u201c${item.quote}\u201d`;
    row.appendChild(text);

    const badge = document.createElement('div');
    badge.style.cssText = `font-size:10px;padding:2px 7px;border-radius:10px;font-family:monospace;font-weight:500;flex-shrink:0;background:${item.colorSoft};color:${item.color}`;
    badge.textContent = item.collection;
    row.appendChild(badge);

    const date = document.createElement('div');
    date.style.cssText = 'font-size:10px;color:var(--ap-muted);font-family:monospace;flex-shrink:0';
    date.textContent = item.date;
    row.appendChild(date);

    const arrow = document.createElement('div');
    arrow.style.cssText = 'font-size:11px;color:var(--ap-muted)';
    arrow.textContent = '\u203a';
    row.appendChild(arrow);

    row.addEventListener('click', () => {
      detailItem = item;
      rerender();
    });

    listBody.appendChild(row);
  });

  wrap.appendChild(listBody);
  return wrap;
}

function buildDetailView(item: SwipeItem, rerender: () => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--ap-border);flex-shrink:0';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.style.cssText = 'width:24px;height:24px;border-radius:6px;background:var(--ap-surface);border:none;color:var(--ap-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .12s;flex-shrink:0';
  backBtn.textContent = '\u2039';
  backBtn.addEventListener('click', () => {
    detailItem = null;
    rerender();
  });
  backBtn.addEventListener('mouseenter', () => { backBtn.style.background = 'var(--ap-hover)'; backBtn.style.color = 'var(--ap-text)'; });
  backBtn.addEventListener('mouseleave', () => { backBtn.style.background = 'var(--ap-surface)'; backBtn.style.color = 'var(--ap-muted)'; });
  header.appendChild(backBtn);

  const domain = document.createElement('div');
  domain.style.cssText = 'font-size:11px;font-weight:600;color:var(--ap-muted);letter-spacing:.1em;text-transform:uppercase;font-family:monospace';
  domain.textContent = item.domain;
  header.appendChild(domain);

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.style.cssText = 'margin-left:auto;flex:0;padding:4px 10px;font-size:11px;border-radius:7px;border:1px solid var(--ap-border);background:transparent;color:var(--ap-muted);font-family:inherit;cursor:pointer;transition:all .12s';
  copyBtn.textContent = 'Copy \u2197';
  copyBtn.addEventListener('mouseenter', () => { copyBtn.style.borderColor = 'var(--ap-muted)'; copyBtn.style.color = 'var(--ap-text)'; });
  copyBtn.addEventListener('mouseleave', () => { copyBtn.style.borderColor = 'var(--ap-border)'; copyBtn.style.color = 'var(--ap-muted)'; });
  header.appendChild(copyBtn);
  wrap.appendChild(header);

  const quote = document.createElement('div');
  quote.style.cssText = `margin:12px 14px;padding:12px 13px;font-family:serif;font-size:13.5px;font-style:italic;color:var(--ap-text);line-height:1.7;background:var(--ap-surface);border-radius:0 9px 9px 0;border-left:3px solid ${item.color}`;
  quote.textContent = `\u201c${item.quote}\u201d`;
  wrap.appendChild(quote);

  const meta = document.createElement('div');
  meta.style.cssText = 'padding:0 14px 12px;display:flex;flex-direction:column;gap:11px;overflow-y:auto';

  const tagsSection = document.createElement('div');
  const tagsLabel = document.createElement('div');
  tagsLabel.style.cssText = 'font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ap-muted);font-family:monospace;margin-bottom:6px';
  tagsLabel.textContent = 'Tags';
  tagsSection.appendChild(tagsLabel);

  const tagRow = document.createElement('div');
  tagRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px';
  item.tags.forEach((t) => {
    const tag = document.createElement('span');
    tag.style.cssText = 'font-size:11px;padding:2px 8px;border-radius:10px;background:var(--ap-surface);border:1px solid var(--ap-border);color:var(--ap-muted);font-family:monospace;cursor:pointer;display:flex;align-items:center;gap:3px';
    tag.innerHTML = `${t} <span style="opacity:.5;font-size:11px">\u00d7</span>`;
    tagRow.appendChild(tag);
  });
  const addTag = document.createElement('span');
  addTag.style.cssText = 'font-size:11px;padding:2px 8px;border-radius:10px;border:1px dashed var(--ap-border);color:var(--ap-muted);font-family:monospace;cursor:pointer;transition:all .12s';
  addTag.textContent = '+ tag';
  addTag.addEventListener('mouseenter', () => { addTag.style.borderColor = 'var(--ap-text)'; addTag.style.color = 'var(--ap-text)'; });
  addTag.addEventListener('mouseleave', () => { addTag.style.borderColor = 'var(--ap-border)'; addTag.style.color = 'var(--ap-muted)'; });
  tagRow.appendChild(addTag);
  tagsSection.appendChild(tagRow);
  meta.appendChild(tagsSection);

  const noteSection = document.createElement('div');
  const noteLabel = document.createElement('div');
  noteLabel.style.cssText = 'font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ap-muted);font-family:monospace;margin-bottom:6px';
  noteLabel.textContent = 'Note';
  noteSection.appendChild(noteLabel);

  const noteArea = document.createElement('textarea');
  noteArea.style.cssText = 'width:100%;background:var(--ap-surface);border:1px solid var(--ap-border);border-radius:8px;padding:8px 10px;font-size:12.5px;color:var(--ap-text);font-family:inherit;resize:none;outline:none;line-height:1.55;min-height:56px;transition:border-color .15s;box-sizing:border-box';
  noteArea.placeholder = 'What makes this work? When would you use it?';
  noteArea.value = item.note;
  noteArea.addEventListener('focus', () => { noteArea.style.borderColor = 'var(--ap-muted)'; });
  noteArea.addEventListener('blur', () => { noteArea.style.borderColor = 'var(--ap-border)'; });
  noteSection.appendChild(noteArea);
  meta.appendChild(noteSection);
  wrap.appendChild(meta);

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:6px;padding:9px 14px;border-top:1px solid var(--ap-border);flex-shrink:0';

  const actionDefs = [
    { label: '\u229e Project', cls: '' },
    { label: '\u2606 Star', cls: '' },
    { label: '\u2b06 Copy', cls: 'copy' },
    { label: '\ud83d\uddd1 Delete', cls: 'del' },
  ];

  actionDefs.forEach((a) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = 'flex:1;padding:6px;border-radius:7px;border:1px solid var(--ap-border);background:transparent;color:var(--ap-muted);font-size:12px;font-family:inherit;cursor:pointer;transition:all .12s;display:flex;align-items:center;justify-content:center;gap:4px';
    btn.textContent = a.label;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'var(--ap-surface)';
      btn.style.color = 'var(--ap-text)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
      btn.style.color = 'var(--ap-muted)';
    });
    actions.appendChild(btn);
  });
  wrap.appendChild(actions);

  return wrap;
}

export function renderSwipePanel(body: HTMLElement): void {
  body.style.padding = '0';
  body.innerHTML = '';

  const rerender = () => renderSwipePanel(body);

  if (detailItem) {
    body.appendChild(buildDetailView(detailItem, rerender));
  } else {
    body.appendChild(buildListView(body, rerender));
  }
}
