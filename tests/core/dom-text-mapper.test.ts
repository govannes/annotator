import { describe, it, expect, afterEach } from 'vitest';
import { build, mapperOffsetsToRange, mapperRangeToOffsets } from '@/core/dom-text-mapper';

afterEach(() => {
  document.body.innerHTML = '';
});

function makeRoot(html: string): HTMLDivElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

// ---------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------

describe('build', () => {
  it('extracts plain text from a simple element', () => {
    const root = makeRoot('Hello world');
    const { text } = build(root);
    expect(text).toBe('Hello world');
  });

  it('concatenates text across nested elements', () => {
    const root = makeRoot('<p>Hello <strong>world</strong></p>');
    const { text } = build(root);
    expect(text).toBe('Hello world');
  });

  it('concatenates text across sibling paragraphs', () => {
    const root = makeRoot('<p>First</p><p>Second</p>');
    const { text } = build(root);
    expect(text).toBe('FirstSecond');
  });

  it('creates one segment per text node', () => {
    const root = makeRoot('<p>Hello <em>world</em></p>');
    const { segments } = build(root);
    expect(segments.length).toBe(2);
    expect(segments[0]!.node.textContent).toBe('Hello ');
    expect(segments[1]!.node.textContent).toBe('world');
  });

  it('segments have correct start/end offsets', () => {
    const root = makeRoot('<span>AB</span><span>CDE</span>');
    const { segments } = build(root);
    expect(segments[0]).toMatchObject({ start: 0, end: 2 });
    expect(segments[1]).toMatchObject({ start: 2, end: 5 });
  });

  it('skips script and style elements', () => {
    const root = makeRoot('visible<script>hidden();</script><style>.x{}</style> text');
    const { text } = build(root);
    expect(text).not.toContain('hidden');
    expect(text).not.toContain('.x');
    expect(text).toContain('visible');
    expect(text).toContain('text');
  });

  it('handles empty root', () => {
    const root = makeRoot('');
    const { text, segments } = build(root);
    expect(text).toBe('');
    expect(segments).toHaveLength(0);
  });

  it('handles deeply nested structure', () => {
    const root = makeRoot('<div><div><div><span>deep</span></div></div></div>');
    const { text } = build(root);
    expect(text).toBe('deep');
  });
});

// ---------------------------------------------------------------------------
// mapperOffsetsToRange
// ---------------------------------------------------------------------------

describe('mapperOffsetsToRange', () => {
  it('creates a Range spanning within a single text node', () => {
    const root = makeRoot('Hello world');
    const { segments } = build(root);
    const range = mapperOffsetsToRange(6, 11, segments);
    expect(range).not.toBeNull();
    expect(range!.toString()).toBe('world');
  });

  it('creates a Range spanning across multiple text nodes', () => {
    const root = makeRoot('<span>Hello </span><span>world</span>');
    const { segments } = build(root);
    const range = mapperOffsetsToRange(0, 11, segments);
    expect(range).not.toBeNull();
    expect(range!.toString()).toBe('Hello world');
  });

  it('creates a Range for a partial text node', () => {
    const root = makeRoot('abcdefghij');
    const { segments } = build(root);
    const range = mapperOffsetsToRange(3, 7, segments);
    expect(range).not.toBeNull();
    expect(range!.toString()).toBe('defg');
  });

  it('returns null when offsets exceed segments', () => {
    const root = makeRoot('short');
    const { segments } = build(root);
    const range = mapperOffsetsToRange(100, 200, segments);
    expect(range).toBeNull();
  });

  it('handles zero-length range', () => {
    const root = makeRoot('Hello');
    const { segments } = build(root);
    const range = mapperOffsetsToRange(3, 3, segments);
    expect(range).not.toBeNull();
    expect(range!.collapsed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// mapperRangeToOffsets
// ---------------------------------------------------------------------------

describe('mapperRangeToOffsets', () => {
  it('converts a DOM Range back to character offsets', () => {
    const root = makeRoot('<p>Hello <strong>world</strong></p>');
    const { segments } = build(root);

    const range = document.createRange();
    const strongText = root.querySelector('strong')!.firstChild!;
    range.setStart(strongText, 0);
    range.setEnd(strongText, 5);

    const offsets = mapperRangeToOffsets(range, segments);
    expect(offsets).toEqual({ start: 6, end: 11 });
  });

  it('handles range within a single text node', () => {
    const root = makeRoot('abcdefghij');
    const { segments } = build(root);

    const range = document.createRange();
    range.setStart(root.firstChild!, 2);
    range.setEnd(root.firstChild!, 5);

    const offsets = mapperRangeToOffsets(range, segments);
    expect(offsets).toEqual({ start: 2, end: 5 });
  });
});

// ---------------------------------------------------------------------------
// Round-trip: offsets → Range → offsets
// ---------------------------------------------------------------------------

describe('round-trip', () => {
  it('preserves offsets through Range conversion and back', () => {
    const root = makeRoot('<p>Hello <em>beautiful</em> world</p>');
    const { segments } = build(root);

    const range = mapperOffsetsToRange(6, 15, segments)!;
    expect(range.toString()).toBe('beautiful');

    const offsets = mapperRangeToOffsets(range, segments);
    expect(offsets).toEqual({ start: 6, end: 15 });
  });

  it('round-trips a cross-node selection', () => {
    const root = makeRoot('<span>AA</span><span>BB</span><span>CC</span>');
    const { segments } = build(root);

    const range = mapperOffsetsToRange(1, 5, segments)!;
    expect(range.toString()).toBe('ABBC');

    const offsets = mapperRangeToOffsets(range, segments);
    expect(offsets).toEqual({ start: 1, end: 5 });
  });
});
