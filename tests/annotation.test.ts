import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { annotate, load, retryFailed } from '@/annotation';
import type { Annotation, Selector } from '@/types';

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'group').mockImplementation(() => {});
  vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
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

// ---------------------------------------------------------------------------
// annotate
// ---------------------------------------------------------------------------

describe('annotate', () => {
  it('creates an annotation with a valid selector', async () => {
    const root = makeRoot('<p>Hello world</p>');
    const textNode = root.querySelector('p')!.firstChild!;
    const range = createRange(textNode, 6, textNode, 11);

    const ann = await annotate(range, root, 'https://example.com');

    expect(ann.id).toBeTruthy();
    expect(ann.pageUrl).toBe('https://example.com');
    expect(ann.selector.exact).toBe('world');
    expect(ann.created).toBeTruthy();
  });

  it('saves the annotation to storage', async () => {
    const root = makeRoot('<p>Hello world</p>');
    const textNode = root.querySelector('p')!.firstChild!;
    const range = createRange(textNode, 0, textNode, 5);

    await annotate(range, root, 'https://example.com');

    const stored = JSON.parse(localStorage.getItem('annotator_annotations') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].selector.exact).toBe('Hello');
  });

  it('highlights the annotated range', async () => {
    const root = makeRoot('<p>Hello world</p>');
    const textNode = root.querySelector('p')!.firstChild!;
    const range = createRange(textNode, 6, textNode, 11);

    await annotate(range, root, 'https://example.com');

    const highlights = root.querySelectorAll('.annotator-highlight');
    expect(highlights.length).toBeGreaterThanOrEqual(1);
  });

  it('stores body when provided', async () => {
    const root = makeRoot('<p>Hello world</p>');
    const textNode = root.querySelector('p')!.firstChild!;
    const range = createRange(textNode, 0, textNode, 5);

    const body = { type: 'TextualBody', value: 'A note' };
    const ann = await annotate(range, root, 'https://example.com', body);

    expect(ann.body).toEqual(body);
  });

  it('builds prefix and suffix context', async () => {
    const root = makeRoot('<p>before target after</p>');
    const textNode = root.querySelector('p')!.firstChild!;
    const range = createRange(textNode, 7, textNode, 13);

    const ann = await annotate(range, root, 'https://example.com');

    expect(ann.selector.exact).toBe('target');
    expect(ann.selector.prefix).toContain('before');
    expect(ann.selector.suffix).toContain('after');
  });

  it('builds document-level offsets', async () => {
    const root = makeRoot('<p>Hello world</p>');
    const textNode = root.querySelector('p')!.firstChild!;
    const range = createRange(textNode, 6, textNode, 11);

    const ann = await annotate(range, root, 'https://example.com');

    expect(ann.selector.docStartOffset).toBe(6);
    expect(ann.selector.docEndOffset).toBe(11);
  });
});

// ---------------------------------------------------------------------------
// load
// ---------------------------------------------------------------------------

describe('load', () => {
  it('returns empty result when no annotations stored', async () => {
    const root = makeRoot('<p>Hello</p>');
    const result = await load('https://example.com', root);

    expect(result.annotations).toHaveLength(0);
    expect(result.anchored).toBe(0);
    expect(result.total).toBe(0);
    expect(result.failed).toHaveLength(0);
  });

  it('loads and anchors annotations for the current page', async () => {
    const root = makeRoot('<p>Hello world</p>');
    const textNode = root.querySelector('p')!.firstChild!;
    const range = createRange(textNode, 6, textNode, 11);

    await annotate(range, root, 'https://example.com');

    document.body.innerHTML = '';
    const root2 = makeRoot('<p>Hello world</p>');
    const result = await load('https://example.com', root2);

    expect(result.total).toBe(1);
    expect(result.anchored).toBe(1);
    expect(result.failed).toHaveLength(0);
  });

  it('filters annotations by page URL', async () => {
    const root = makeRoot('<p>Hello world</p>');
    const textNode = root.querySelector('p')!.firstChild!;
    const range = createRange(textNode, 0, textNode, 5);

    await annotate(range, root, 'https://page-a.com');

    document.body.innerHTML = '';
    const root2 = makeRoot('<p>Hello world</p>');
    const result = await load('https://page-b.com', root2);

    expect(result.total).toBe(0);
    expect(result.annotations).toHaveLength(0);
  });

  it('reports failed annotations when text is missing from DOM', async () => {
    const root = makeRoot('<p>Hello world</p>');
    const textNode = root.querySelector('p')!.firstChild!;
    const range = createRange(textNode, 6, textNode, 11);

    await annotate(range, root, 'https://example.com');

    document.body.innerHTML = '';
    const root2 = makeRoot('<p>Completely different content</p>');
    const result = await load('https://example.com', root2);

    expect(result.total).toBe(1);
    expect(result.failed).toHaveLength(1);
    expect(result.anchored).toBe(0);
  });

  it('clears existing highlights before re-anchoring', async () => {
    const root = makeRoot('<p>Hello world</p>');
    const textNode = root.querySelector('p')!.firstChild!;
    const range = createRange(textNode, 0, textNode, 5);
    await annotate(range, root, 'https://example.com');

    const highlights1 = root.querySelectorAll('.annotator-highlight');
    expect(highlights1.length).toBeGreaterThanOrEqual(1);

    await load('https://example.com', root);

    const highlights2 = root.querySelectorAll('.annotator-highlight');
    expect(highlights2.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// retryFailed
// ---------------------------------------------------------------------------

describe('retryFailed', () => {
  it('returns empty when no pending annotations', () => {
    const root = makeRoot('<p>Hello</p>');
    const stillFailed = retryFailed([], root);
    expect(stillFailed).toHaveLength(0);
  });

  it('anchors previously failed annotations when content appears', async () => {
    const root = makeRoot('<p>Hello world</p>');
    const textNode = root.querySelector('p')!.firstChild!;
    const range = createRange(textNode, 6, textNode, 11);
    const ann = await annotate(range, root, 'https://example.com');

    document.body.innerHTML = '';
    const root2 = makeRoot('<p>Different content</p>');
    const result = await load('https://example.com', root2);
    expect(result.failed).toHaveLength(1);

    document.body.innerHTML = '';
    const root3 = makeRoot('<p>Hello world</p>');
    const stillFailed = retryFailed(result.failed, root3);
    expect(stillFailed).toHaveLength(0);

    const highlights = root3.querySelectorAll('.annotator-highlight');
    expect(highlights.length).toBeGreaterThanOrEqual(1);
  });

  it('keeps annotations as failed when content is still missing', async () => {
    const selector: Selector = {
      exact: 'nonexistent text that will never appear',
      prefix: 'aaa',
      suffix: 'bbb',
      start: 'p[1]',
      end: 'p[1]',
      startOffset: 0,
      endOffset: 39,
    };
    const ann: Annotation = {
      id: 'test-id',
      selector,
      pageUrl: 'https://example.com',
    };

    const root = makeRoot('<p>Some other content</p>');
    const stillFailed = retryFailed([ann], root);
    expect(stillFailed).toHaveLength(1);
    expect(stillFailed[0]!.id).toBe('test-id');
  });
});
