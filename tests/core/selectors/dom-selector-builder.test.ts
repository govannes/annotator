import { describe, it, expect, afterEach } from 'vitest';
import {
  buildFromRange,
  resolveFromRange,
  buildFromTextPosition,
  resolveFromTextPosition,
  buildFromTextQuote,
} from '@/core/selectors/dom-selector-builder';
import { build, mapperOffsetsToRange } from '@/core/dom-text-mapper';
import type { Selector } from '@/types';

afterEach(() => {
  document.body.innerHTML = '';
});

function makeRoot(html: string): HTMLDivElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

function selectText(root: HTMLElement, text: string): Range {
  const fullText = root.textContent ?? '';
  const idx = fullText.indexOf(text);
  if (idx < 0) throw new Error(`"${text}" not found in root`);

  const { segments } = build(root);
  const range = mapperOffsetsToRange(idx, idx + text.length, segments);
  if (!range) throw new Error(`Failed to create range for "${text}"`);
  return range;
}

// ---------------------------------------------------------------------------
// buildFromRange / resolveFromRange  (XPath round-trip)
// ---------------------------------------------------------------------------

describe('buildFromRange + resolveFromRange', () => {
  it('round-trips a range in a simple paragraph', () => {
    const root = makeRoot('<p>Hello world</p>');
    const range = selectText(root, 'world');

    const partial = buildFromRange(range, root);
    expect(partial.start).toBeTruthy();
    expect(partial.end).toBeTruthy();
    expect(typeof partial.startOffset).toBe('number');
    expect(typeof partial.endOffset).toBe('number');

    const selector: Selector = {
      start: partial.start!,
      end: partial.end!,
      startOffset: partial.startOffset!,
      endOffset: partial.endOffset!,
      exact: 'world',
      prefix: '',
      suffix: '',
    };

    const resolved = resolveFromRange(selector, root);
    expect(resolved).not.toBeNull();
    expect(resolved!.toString()).toBe('world');
  });

  it('round-trips a range spanning nested elements', () => {
    const root = makeRoot('<p>Hello <strong>bold</strong> text</p>');
    const range = selectText(root, 'bold');

    const partial = buildFromRange(range, root);
    const selector: Selector = {
      start: partial.start!,
      end: partial.end!,
      startOffset: partial.startOffset!,
      endOffset: partial.endOffset!,
      exact: 'bold',
      prefix: '',
      suffix: '',
    };

    const resolved = resolveFromRange(selector, root);
    expect(resolved).not.toBeNull();
    expect(resolved!.toString()).toBe('bold');
  });

  it('resolveFromRange returns null when expected quote mismatches', () => {
    const root = makeRoot('<p>Hello world</p>');
    const range = selectText(root, 'world');

    const partial = buildFromRange(range, root);
    const selector: Selector = {
      start: partial.start!,
      end: partial.end!,
      startOffset: partial.startOffset!,
      endOffset: partial.endOffset!,
      exact: 'wrong text',
      prefix: '',
      suffix: '',
    };

    const resolved = resolveFromRange(selector, root, 'wrong text');
    expect(resolved).toBeNull();
  });

  it('resolveFromRange returns null for invalid xpath', () => {
    const root = makeRoot('<p>Hello</p>');
    const selector: Selector = {
      start: 'nonexistent[1]/path[1]',
      end: 'nonexistent[1]/path[1]',
      startOffset: 0,
      endOffset: 5,
      exact: 'Hello',
      prefix: '',
      suffix: '',
    };
    expect(resolveFromRange(selector, root)).toBeNull();
  });

  it('handles multiple same-tag siblings', () => {
    const root = makeRoot('<p>First</p><p>Second</p><p>Third</p>');
    const range = selectText(root, 'Second');

    const partial = buildFromRange(range, root);
    const selector: Selector = {
      start: partial.start!,
      end: partial.end!,
      startOffset: partial.startOffset!,
      endOffset: partial.endOffset!,
      exact: 'Second',
      prefix: '',
      suffix: '',
    };

    const resolved = resolveFromRange(selector, root);
    expect(resolved).not.toBeNull();
    expect(resolved!.toString()).toBe('Second');
  });
});

// ---------------------------------------------------------------------------
// buildFromTextPosition / resolveFromTextPosition
// ---------------------------------------------------------------------------

describe('buildFromTextPosition + resolveFromTextPosition', () => {
  it('round-trips a text position selector', () => {
    const root = makeRoot('<p>Hello <em>world</em></p>');
    const { segments } = build(root);
    const range = selectText(root, 'world');

    const partial = buildFromTextPosition(range, segments);
    expect(partial.startOffset).toBe(6);
    expect(partial.endOffset).toBe(11);

    const selector: Selector = {
      start: String(partial.startOffset),
      end: String(partial.endOffset),
      startOffset: partial.startOffset!,
      endOffset: partial.endOffset!,
      exact: 'world',
      prefix: '',
      suffix: '',
    };

    const resolved = resolveFromTextPosition(selector, segments);
    expect(resolved).not.toBeNull();
    expect(resolved!.toString()).toBe('world');
  });

  it('rejects stale offsets when expected quote mismatches', () => {
    const root = makeRoot('<p>Hello world</p>');
    const { segments } = build(root);

    const selector: Selector = {
      start: '0',
      end: '5',
      startOffset: 0,
      endOffset: 5,
      exact: 'wrong',
      prefix: '',
      suffix: '',
    };

    const resolved = resolveFromTextPosition(selector, segments, 'wrong');
    expect(resolved).toBeNull();
  });

  it('handles full-text selection', () => {
    const root = makeRoot('Single text node');
    const { segments } = build(root);
    const range = selectText(root, 'Single text node');

    const partial = buildFromTextPosition(range, segments);
    expect(partial.startOffset).toBe(0);
    expect(partial.endOffset).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// buildFromTextQuote
// ---------------------------------------------------------------------------

describe('buildFromTextQuote', () => {
  it('extracts exact, prefix, and suffix', () => {
    const doc = 'aaa bbb ccc ddd eee';
    const result = buildFromTextQuote(doc, 4, 7);
    expect(result.exact).toBe('bbb');
    expect(result.prefix).toBe('aaa ');
    // suffix is up to 32 chars after the selection
    expect(result.suffix).toBe(' ccc ddd eee');
  });

  it('limits prefix/suffix to 32 characters', () => {
    const long = 'A'.repeat(100) + 'TARGET' + 'B'.repeat(100);
    const start = 100;
    const end = 106;
    const result = buildFromTextQuote(long, start, end);
    expect(result.exact).toBe('TARGET');
    expect(result.prefix!.length).toBe(32);
    expect(result.suffix!.length).toBe(32);
  });

  it('handles selection at the very beginning', () => {
    const doc = 'Hello world';
    const result = buildFromTextQuote(doc, 0, 5);
    expect(result.exact).toBe('Hello');
    expect(result.prefix).toBe('');
    // suffix grabs up to 32 chars — "Hello world" only has " world" left
    expect(result.suffix).toBe(' world');
  });

  it('handles selection at the very end', () => {
    const doc = 'Hello world';
    const result = buildFromTextQuote(doc, 6, 11);
    expect(result.exact).toBe('world');
    expect(result.prefix).toBe('Hello ');
    expect(result.suffix).toBe('');
  });
});
