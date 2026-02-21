import { describe, it, expect, afterEach } from 'vitest';
import { highlightRange, clearHighlights } from '@/core/highlighters/dom-highlighter';

afterEach(() => {
  document.body.innerHTML = '';
});

function makeRoot(html: string): HTMLDivElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

function createRange(startNode: Node, startOffset: number, endNode: Node, endOffset: number): Range {
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

function getHighlights(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll('.annotator-highlight'));
}

// ---------------------------------------------------------------------------
// highlightRange
// ---------------------------------------------------------------------------

describe('highlightRange', () => {
  it('wraps selected text in a highlight span', () => {
    const root = makeRoot('Hello world');
    const textNode = root.firstChild!;
    const range = createRange(textNode, 6, textNode, 11);

    const result = highlightRange(range, 'ann-1');
    expect(result).toBe(true);

    const highlights = getHighlights(root);
    expect(highlights).toHaveLength(1);
    expect(highlights[0]!.textContent).toBe('world');
  });

  it('sets data-annotation-id attribute', () => {
    const root = makeRoot('Hello world');
    const range = createRange(root.firstChild!, 0, root.firstChild!, 5);

    highlightRange(range, 'my-annotation');

    const span = root.querySelector('.annotator-highlight')!;
    expect(span.getAttribute('data-annotation-id')).toBe('my-annotation');
  });

  it('sets data-highlight-type attribute', () => {
    const root = makeRoot('Hello world');
    const range = createRange(root.firstChild!, 0, root.firstChild!, 5);

    highlightRange(range, 'ann-1');

    const span = root.querySelector('.annotator-highlight')!;
    expect(span.getAttribute('data-highlight-type')).toBe('highlight');
  });

  it('applies background-color style', () => {
    const root = makeRoot('Hello world');
    const range = createRange(root.firstChild!, 0, root.firstChild!, 5);

    highlightRange(range, 'ann-1');

    const span = root.querySelector('.annotator-highlight') as HTMLElement;
    expect(span.style.backgroundColor).toBeTruthy();
  });

  it('preserves text before and after the highlight', () => {
    const root = makeRoot('Hello beautiful world');
    const textNode = root.firstChild!;
    const range = createRange(textNode, 6, textNode, 15);

    highlightRange(range, 'ann-1');

    expect(root.textContent).toBe('Hello beautiful world');
  });

  it('returns false for a collapsed range', () => {
    const root = makeRoot('Hello');
    const range = createRange(root.firstChild!, 3, root.firstChild!, 3);

    expect(highlightRange(range, 'ann-1')).toBe(false);
  });

  it('handles range spanning multiple text nodes across elements', () => {
    const root = makeRoot('<p>Hello </p><p>world</p>');
    const firstText = root.querySelector('p')!.firstChild!;
    const secondText = root.querySelectorAll('p')[1]!.firstChild!;
    const range = createRange(firstText, 0, secondText, 5);

    const result = highlightRange(range, 'ann-1');
    expect(result).toBe(true);

    const highlights = getHighlights(root);
    expect(highlights.length).toBeGreaterThanOrEqual(1);
  });

  it('creates multiple highlight spans for multi-node selection', () => {
    const root = makeRoot('<span>AAA</span><span>BBB</span><span>CCC</span>');
    const firstText = root.querySelector('span')!.firstChild!;
    const lastText = root.querySelectorAll('span')[2]!.firstChild!;
    const range = createRange(firstText, 1, lastText, 2);

    highlightRange(range, 'ann-1');

    const highlights = getHighlights(root);
    expect(highlights.length).toBeGreaterThanOrEqual(2);
  });

  it('handles highlighting at the start of a text node', () => {
    const root = makeRoot('Hello world');
    const range = createRange(root.firstChild!, 0, root.firstChild!, 5);

    highlightRange(range, 'ann-1');

    const highlights = getHighlights(root);
    expect(highlights).toHaveLength(1);
    expect(highlights[0]!.textContent).toBe('Hello');
  });

  it('handles highlighting at the end of a text node', () => {
    const root = makeRoot('Hello world');
    const range = createRange(root.firstChild!, 6, root.firstChild!, 11);

    highlightRange(range, 'ann-1');

    const highlights = getHighlights(root);
    expect(highlights).toHaveLength(1);
    expect(highlights[0]!.textContent).toBe('world');
  });
});

// ---------------------------------------------------------------------------
// clearHighlights
// ---------------------------------------------------------------------------

describe('clearHighlights', () => {
  it('removes all highlight spans', () => {
    const root = makeRoot('Hello world');
    const range = createRange(root.firstChild!, 6, root.firstChild!, 11);
    highlightRange(range, 'ann-1');

    expect(getHighlights(root)).toHaveLength(1);

    clearHighlights(root);

    expect(getHighlights(root)).toHaveLength(0);
  });

  it('restores text content after clearing', () => {
    const root = makeRoot('Hello world');
    const range = createRange(root.firstChild!, 6, root.firstChild!, 11);
    highlightRange(range, 'ann-1');

    clearHighlights(root);

    expect(root.textContent).toBe('Hello world');
  });

  it('handles clearing when no highlights exist', () => {
    const root = makeRoot('No highlights here');
    clearHighlights(root);
    expect(root.textContent).toBe('No highlights here');
  });

  it('clears multiple highlights from different annotations', () => {
    const root = makeRoot('<p>AAA BBB CCC</p>');
    const textNode = root.querySelector('p')!.firstChild!;

    const range1 = createRange(textNode, 0, textNode, 3);
    highlightRange(range1, 'ann-1');

    const cccNode = root.querySelector('p')!.lastChild!;
    const range2 = createRange(cccNode, cccNode.textContent!.indexOf('CCC'), cccNode, cccNode.textContent!.indexOf('CCC') + 3);
    highlightRange(range2, 'ann-2');

    expect(getHighlights(root).length).toBeGreaterThanOrEqual(1);

    clearHighlights(root);
    expect(getHighlights(root)).toHaveLength(0);
    expect(root.textContent).toBe('AAA BBB CCC');
  });
});
