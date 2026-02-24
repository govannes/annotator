import { closePanel } from '../popup-panel';

const collections = ['General', 'Headlines', 'CTAs', 'Inspo', 'Avoid'];

export function renderNotePanel(body: HTMLElement): void {
  body.style.padding = '0';
  body.innerHTML = '';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--ap-border);flex-shrink:0';
  const title = document.createElement('div');
  title.style.cssText = 'font-size:11px;font-weight:600;color:var(--ap-muted);letter-spacing:.1em;text-transform:uppercase;font-family:monospace';
  title.textContent = 'Quick Note';
  header.appendChild(title);

  const urlBadge = document.createElement('div');
  urlBadge.style.cssText = 'margin-left:auto;font-size:11px;color:var(--ap-muted);font-family:monospace';
  try { urlBadge.textContent = new URL(window.location.href).hostname; } catch { urlBadge.textContent = ''; }
  header.appendChild(urlBadge);
  body.appendChild(header);

  const formWrap = document.createElement('div');
  formWrap.id = 'qn-form-wrap';

  const formBody = document.createElement('div');
  formBody.style.cssText = 'padding:12px 14px;display:flex;flex-direction:column;gap:9px';

  const textarea = document.createElement('textarea');
  textarea.style.cssText = 'width:100%;background:var(--ap-surface);border:1px solid var(--ap-border);border-radius:10px;padding:11px 12px;font-size:14px;color:var(--ap-text);font-family:serif;font-style:italic;resize:none;outline:none;line-height:1.65;height:100px;transition:border-color .15s;box-sizing:border-box';
  textarea.placeholder = 'Capture a thought about this page\u2026';
  textarea.addEventListener('focus', () => { textarea.style.borderColor = 'var(--ap-muted)'; });
  textarea.addEventListener('blur', () => { textarea.style.borderColor = 'var(--ap-border)'; });

  const charCount = document.createElement('div');
  charCount.style.cssText = 'font-size:10px;color:var(--ap-muted);font-family:monospace;text-align:right;margin-top:-5px';
  charCount.textContent = '0 / 280';

  textarea.addEventListener('input', () => {
    charCount.textContent = `${textarea.value.length} / 280`;
  });

  formBody.appendChild(textarea);
  formBody.appendChild(charCount);

  const colSection = document.createElement('div');
  const colLabel = document.createElement('div');
  colLabel.style.cssText = 'font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ap-muted);font-family:monospace;margin-bottom:6px';
  colLabel.textContent = 'Collection';
  colSection.appendChild(colLabel);

  const colRow = document.createElement('div');
  colRow.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap';

  let activeCol = collections[0]!;

  collections.forEach((c) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.style.cssText = 'font-size:11px;padding:3px 10px;border-radius:10px;border:1px solid var(--ap-border);background:transparent;color:var(--ap-muted);cursor:pointer;font-family:monospace;transition:all .12s';
    chip.textContent = c;
    if (c === activeCol) {
      chip.style.background = 'var(--ap-surface)';
      chip.style.borderColor = 'var(--ap-muted)';
      chip.style.color = 'var(--ap-text)';
    }
    chip.addEventListener('click', () => {
      activeCol = c;
      colRow.querySelectorAll('button').forEach((b) => {
        b.style.background = 'transparent';
        b.style.borderColor = 'var(--ap-border)';
        b.style.color = 'var(--ap-muted)';
      });
      chip.style.background = 'var(--ap-surface)';
      chip.style.borderColor = 'var(--ap-muted)';
      chip.style.color = 'var(--ap-text)';
    });
    chip.addEventListener('mouseenter', () => {
      if (c !== activeCol) { chip.style.borderColor = 'var(--ap-muted)'; chip.style.color = 'var(--ap-text)'; }
    });
    chip.addEventListener('mouseleave', () => {
      if (c !== activeCol) { chip.style.borderColor = 'var(--ap-border)'; chip.style.color = 'var(--ap-muted)'; }
    });
    colRow.appendChild(chip);
  });
  colSection.appendChild(colRow);
  formBody.appendChild(colSection);

  const footerRow = document.createElement('div');
  footerRow.style.cssText = 'display:flex;align-items:center;gap:8px';

  const urlDisplay = document.createElement('div');
  urlDisplay.style.cssText = 'flex:1;background:var(--ap-surface);border:1px solid var(--ap-border);border-radius:7px;padding:6px 10px;font-size:10.5px;color:var(--ap-muted);font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  try {
    const u = new URL(window.location.href);
    urlDisplay.textContent = u.hostname + u.pathname;
  } catch { urlDisplay.textContent = ''; }
  footerRow.appendChild(urlDisplay);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.style.cssText = 'background:var(--ap-text);border:none;border-radius:8px;padding:6px 14px;color:var(--ap-bg);font-size:12.5px;font-weight:600;font-family:inherit;cursor:pointer;white-space:nowrap';
  saveBtn.textContent = 'Save \u21b5';
  saveBtn.addEventListener('mouseenter', () => { saveBtn.style.opacity = '0.88'; });
  saveBtn.addEventListener('mouseleave', () => { saveBtn.style.opacity = '1'; });

  const savedView = document.createElement('div');
  savedView.style.cssText = 'display:none;flex-direction:column;align-items:center;justify-content:center;padding:30px 14px;gap:8px';

  function doSave(): void {
    const val = textarea.value.trim();
    if (!val) return;
    formWrap.style.display = 'none';
    savedView.style.display = 'flex';
    const subText = savedView.querySelector('[data-sub]') as HTMLElement;
    if (subText) subText.textContent = 'Added to ' + activeCol;
    setTimeout(() => {
      textarea.value = '';
      charCount.textContent = '0 / 280';
      formWrap.style.display = 'block';
      savedView.style.display = 'none';
      closePanel();
    }, 1600);
  }

  saveBtn.addEventListener('click', doSave);
  textarea.addEventListener('keydown', (e) => {
    if (e.metaKey && e.key === 'Enter') doSave();
  });

  footerRow.appendChild(saveBtn);
  formBody.appendChild(footerRow);
  formWrap.appendChild(formBody);
  body.appendChild(formWrap);

  const icon = document.createElement('div');
  icon.style.cssText = 'font-size:26px';
  icon.textContent = '\u2726';
  savedView.appendChild(icon);

  const savedText = document.createElement('div');
  savedText.style.cssText = 'font-size:13px;color:var(--ap-text)';
  savedText.textContent = 'Note saved';
  savedView.appendChild(savedText);

  const savedSub = document.createElement('div');
  savedSub.style.cssText = 'font-size:11px;color:var(--ap-muted);font-family:monospace';
  savedSub.setAttribute('data-sub', '');
  savedSub.textContent = 'Added to ' + activeCol;
  savedView.appendChild(savedSub);

  body.appendChild(savedView);
}
