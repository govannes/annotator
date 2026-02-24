const PAGE_PROMPTS = [
  'What makes these subject lines work?',
  'Summarize what I\'ve highlighted here',
  'Write 5 subject lines in this style',
  'What curiosity gap techniques am I missing?',
];

const SWIPE_PROMPTS = [
  'Show me patterns from my Headlines collection',
  'Find subject lines similar to these',
  'What topics do I swipe most from?',
  'Write copy using my best CTAs',
];

const MOCK_REPLIES = [
  'Your swipe file has 84 Headlines items. The dominant pattern: curiosity gaps (31%), specificity anchors (24%), social proof openers (18%). The curiosity gap ones correlate with your highest-starred items.',
  'Looking at your 4 highlights from this page: they cluster around two techniques \u2014 the curiosity gap and what I\'d call the \'permission slip\' (We almost didn\'t launch this). Both withhold information to compel action.',
  '5 subject lines in this style:\n1. \'We almost pulled this offer\'\n2. \'The email that got 94 replies\'\n3. \'Why I deleted 3,000 subscribers\'\n4. \'This took us 4 months to admit\'\n5. \'The CTA we were afraid to test\'',
  'You\'re missing two high-converting patterns from your current swipe file: (1) the named enemy \u2014 a shared villain your reader already hates, and (2) the specificity anchor \u2014 a precise number that signals credibility.',
];

interface Message { role: 'user' | 'ai'; text: string }

let activeCtx: 'page' | 'swipe' = 'page';
let messages: Message[] = [];
let replyIdx = 0;

export function renderAIPanel(body: HTMLElement): void {
  body.style.padding = '0';
  body.innerHTML = '';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--ap-border);flex-shrink:0';

  const title = document.createElement('div');
  title.style.cssText = 'font-size:11px;font-weight:600;color:var(--ap-muted);letter-spacing:.1em;text-transform:uppercase;font-family:monospace';
  title.textContent = 'Write with AI';
  header.appendChild(title);

  const ctxRow = document.createElement('div');
  ctxRow.style.cssText = 'display:flex;gap:5px;margin-left:auto';

  (['page', 'swipe'] as const).forEach((ctx) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.style.cssText = 'font-size:11px;padding:3px 10px;border-radius:10px;border:1px solid var(--ap-border);color:var(--ap-muted);cursor:pointer;font-family:monospace;transition:all .12s;background:transparent';
    chip.textContent = ctx === 'page' ? 'This page' : 'My swipe file';
    if (ctx === activeCtx) {
      chip.style.borderColor = 'var(--ap-muted)';
      chip.style.color = 'var(--ap-text)';
      chip.style.background = 'var(--ap-surface)';
    }
    chip.addEventListener('click', () => {
      activeCtx = ctx;
      messages = [];
      renderAIPanel(body);
    });
    ctxRow.appendChild(chip);
  });
  header.appendChild(ctxRow);
  body.appendChild(header);

  const prompts = activeCtx === 'page' ? PAGE_PROMPTS : SWIPE_PROMPTS;

  if (messages.length === 0) {
    const promptsWrap = document.createElement('div');
    promptsWrap.style.cssText = 'padding:10px 14px;display:flex;flex-direction:column;gap:5px';

    const promptLabel = document.createElement('div');
    promptLabel.style.cssText = 'font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ap-muted);font-family:monospace;margin-bottom:3px';
    promptLabel.textContent = 'Suggested';
    promptsWrap.appendChild(promptLabel);

    prompts.forEach((p) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.style.cssText = 'padding:8px 11px;border-radius:9px;border:1px solid var(--ap-border);background:var(--ap-surface);color:var(--ap-text);font-size:12.5px;cursor:pointer;text-align:left;font-family:inherit;transition:all .12s;line-height:1.4';
      chip.innerHTML = `<span style="color:var(--ap-muted)">\u2726</span> ${p}`;
      chip.addEventListener('mouseenter', () => {
        chip.style.borderColor = 'var(--ap-muted)';
        chip.style.background = 'var(--ap-hover)';
      });
      chip.addEventListener('mouseleave', () => {
        chip.style.borderColor = 'var(--ap-border)';
        chip.style.background = 'var(--ap-surface)';
      });
      chip.addEventListener('click', () => {
        sendMessage(p, body);
      });
      promptsWrap.appendChild(chip);
    });
    body.appendChild(promptsWrap);
  } else {
    const msgsWrap = document.createElement('div');
    msgsWrap.style.cssText = 'flex:1;overflow-y:auto;padding:10px 14px;display:flex;flex-direction:column;gap:8px';

    messages.forEach((m) => {
      const msg = document.createElement('div');
      msg.style.cssText = `max-width:90%;padding:8px 11px;border-radius:10px;font-size:12.5px;line-height:1.55;white-space:pre-line`;
      if (m.role === 'user') {
        msg.style.cssText += ';background:var(--ap-surface);color:var(--ap-text);align-self:flex-end;border:1px solid var(--ap-border)';
      } else {
        msg.style.cssText += ';background:var(--ap-surface);color:var(--ap-text);align-self:flex-start;border:1px solid var(--ap-border);font-family:serif;font-style:italic';
      }
      msg.textContent = m.text;
      msgsWrap.appendChild(msg);
    });

    body.appendChild(msgsWrap);
    requestAnimationFrame(() => { msgsWrap.scrollTop = msgsWrap.scrollHeight; });
  }

  const inputRow = document.createElement('div');
  inputRow.style.cssText = 'display:flex;gap:6px;padding:10px 14px;border-top:1px solid var(--ap-border);flex-shrink:0';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Ask about this page or your swipe file\u2026';
  input.style.cssText = 'flex:1;background:var(--ap-surface);border:1px solid var(--ap-border);border-radius:8px;padding:7px 10px;font-size:13px;color:var(--ap-text);font-family:inherit;outline:none;transition:border-color .15s';
  input.addEventListener('focus', () => { input.style.borderColor = 'var(--ap-muted)'; });
  input.addEventListener('blur', () => { input.style.borderColor = 'var(--ap-border)'; });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = input.value.trim();
      if (val) sendMessage(val, body);
    }
  });
  inputRow.appendChild(input);

  const sendBtn = document.createElement('button');
  sendBtn.type = 'button';
  sendBtn.style.cssText = 'background:var(--ap-text);border:none;border-radius:8px;padding:7px 13px;color:var(--ap-bg);font-size:14px;cursor:pointer;font-weight:600;display:flex;align-items:center';
  sendBtn.textContent = '\u2191';
  sendBtn.addEventListener('mouseenter', () => { sendBtn.style.opacity = '0.88'; });
  sendBtn.addEventListener('mouseleave', () => { sendBtn.style.opacity = '1'; });
  sendBtn.addEventListener('click', () => {
    const val = input.value.trim();
    if (val) sendMessage(val, body);
  });
  inputRow.appendChild(sendBtn);
  body.appendChild(inputRow);
}

function sendMessage(text: string, body: HTMLElement): void {
  messages.push({ role: 'user', text });
  renderAIPanel(body);

  setTimeout(() => {
    const reply = MOCK_REPLIES[replyIdx % MOCK_REPLIES.length]!;
    replyIdx++;
    messages.push({ role: 'ai', text: reply });
    renderAIPanel(body);
  }, 700);
}
