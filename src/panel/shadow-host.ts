import css from '../style.css?inline';

let shadowRoot: ShadowRoot | null = null;

export function initShadowHost(): ShadowRoot {
  const existing = document.getElementById('annotator-shadow-host');
  if (existing?.shadowRoot) {
    shadowRoot = existing.shadowRoot;
    return shadowRoot;
  }

  const host = document.createElement('div');
  host.id = 'annotator-shadow-host';
  const sr = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = css;
  sr.appendChild(style);

  document.body.appendChild(host);
  shadowRoot = sr;
  return sr;
}

export function getShadowRoot(): ShadowRoot {
  return shadowRoot!;
}

export function $id(id: string): HTMLElement | null {
  return (shadowRoot?.getElementById(id) as HTMLElement) ?? null;
}

export function $q<T extends HTMLElement = HTMLElement>(
  selector: string,
): T | null {
  return (shadowRoot?.querySelector<T>(selector)) ?? null;
}

export function $qa<T extends HTMLElement = HTMLElement>(
  selector: string,
): NodeListOf<T> {
  return shadowRoot!.querySelectorAll<T>(selector);
}
