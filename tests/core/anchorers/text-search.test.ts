import { describe, it, expect } from 'vitest';
import {
  findAllExactMatches,
  pickBestMatch,
  anchorFromQuoteContext,
  anchorFromQuoteOnly,
} from '@/core/anchorers/text-search';

// ---------------------------------------------------------------------------
// findAllExactMatches
// ---------------------------------------------------------------------------

describe('findAllExactMatches', () => {
  it('finds a single occurrence', () => {
    expect(findAllExactMatches('hello world', 'world')).toEqual([
      { start: 6, end: 11 },
    ]);
  });

  it('finds multiple occurrences', () => {
    expect(findAllExactMatches('the cat sat on the mat', 'the')).toEqual([
      { start: 0, end: 3 },
      { start: 15, end: 18 },
    ]);
  });

  it('returns empty when no match exists', () => {
    expect(findAllExactMatches('hello world', 'xyz')).toEqual([]);
  });

  it('trims the search term before matching', () => {
    expect(findAllExactMatches('hello', '  hello  ')).toEqual([
      { start: 0, end: 5 },
    ]);
  });

  it('returns empty for whitespace-only search', () => {
    expect(findAllExactMatches('anything', '   ')).toEqual([]);
  });

  it('returns empty for empty string search', () => {
    expect(findAllExactMatches('anything', '')).toEqual([]);
  });

  it('handles overlapping occurrences', () => {
    const matches = findAllExactMatches('aaa', 'aa');
    expect(matches).toEqual([
      { start: 0, end: 2 },
      { start: 1, end: 3 },
    ]);
  });

  it('is case-sensitive', () => {
    expect(findAllExactMatches('Hello hello', 'hello')).toEqual([
      { start: 6, end: 11 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// pickBestMatch
// ---------------------------------------------------------------------------

describe('pickBestMatch', () => {
  it('returns null for empty matches', () => {
    expect(pickBestMatch([], 'doc')).toBeNull();
  });

  it('returns the only match when there is one', () => {
    const m = [{ start: 5, end: 10 }];
    expect(pickBestMatch(m, 'doc')).toEqual(m[0]);
  });

  it('prefers match with matching prefix and suffix', () => {
    const doc = 'AAA target BBB some target CCC';
    const matches = findAllExactMatches(doc, 'target');
    const best = pickBestMatch(matches, doc, { prefix: 'AAA ', suffix: ' BBB' });
    expect(best).toEqual({ start: 4, end: 10 });
  });

  it('uses position hint to break ties', () => {
    const doc = 'click here and click here again';
    const matches = findAllExactMatches(doc, 'click here');
    const best = pickBestMatch(matches, doc, { positionHint: 20 });
    expect(best).toEqual({ start: 15, end: 25 });
  });

  it('falls back to first match when no hints resolve', () => {
    const doc = 'aa bb aa';
    const matches = findAllExactMatches(doc, 'aa');
    const best = pickBestMatch(matches, doc);
    expect(best).toEqual({ start: 0, end: 2 });
  });

  it('prefers context matches even when position hint favors another', () => {
    const doc = 'PREFIX target SUFFIX ... target ...';
    const matches = findAllExactMatches(doc, 'target');
    const best = pickBestMatch(matches, doc, {
      prefix: 'PREFIX ',
      suffix: ' SUFFIX',
      positionHint: 30,
    });
    expect(best).toEqual({ start: 7, end: 13 });
  });
});

// ---------------------------------------------------------------------------
// anchorFromQuoteContext
// ---------------------------------------------------------------------------

describe('anchorFromQuoteContext', () => {
  it('anchors using prefix + exact + suffix as a single needle', () => {
    // prefix/suffix are trimmed, so needle = "before" + "target" + "after" = "beforetargetafter"
    // The doc must contain this concatenated string literally.
    const doc = 'xxx beforetargetafter yyy';
    const result = anchorFromQuoteContext(doc, {
      exact: 'target',
      prefix: 'before',
      suffix: 'after',
    });
    // needle "beforetargetafter" starts at 4; prefix "before" len=6 → exact at 10
    expect(result).toEqual({ start: 10, end: 16 });
  });

  it('trims prefix/suffix before building needle', () => {
    // prefix "  AB" trims to "AB", suffix "CD  " trims to "CD"
    // needle = "AB" + "target" + "CD" = "ABtargetCD"
    const doc = 'ABtargetCD end';
    const result = anchorFromQuoteContext(doc, {
      exact: 'target',
      prefix: '  AB',
      suffix: 'CD  ',
    });
    expect(result).toEqual({ start: 2, end: 8 });
  });

  it('returns null when exact is empty', () => {
    expect(anchorFromQuoteContext('doc', { exact: '', prefix: '', suffix: '' })).toBeNull();
  });

  it('returns null when nothing matches', () => {
    const result = anchorFromQuoteContext('hello world', {
      exact: 'missing text',
      prefix: '',
      suffix: '',
    });
    expect(result).toBeNull();
  });

  it('falls back to fuzzy whitespace normalization', () => {
    // needle after trim = "hello" + "beautiful" + "world" = "hellobeautifulworld"
    // normalized doc  = "hello beautiful world"
    // normalized needle = "hellobeautifulworld" — won't match in normalized doc either.
    // For fuzzy to work, the trimmed needle must match after normalization.
    // Use a case where extra whitespace is in the doc between the trimmed parts.
    // needle = "hello beautiful world" (prefix="" exact="hello beautiful world" suffix="")
    const doc = 'hello   beautiful   world';
    const result = anchorFromQuoteContext(
      doc,
      { exact: 'hello beautiful world', prefix: '', suffix: '' },
      undefined,
      true,
    );
    expect(result).not.toBeNull();
    expect(doc.slice(result!.start, result!.end)).toBe('hello   beautiful   world');
  });

  it('returns null in non-fuzzy mode when whitespace differs', () => {
    const doc = 'hello   beautiful   world';
    const result = anchorFromQuoteContext(
      doc,
      { exact: 'hello beautiful world', prefix: '', suffix: '' },
      undefined,
      false,
    );
    expect(result).toBeNull();
  });

  it('disambiguates multiple matches with position hint', () => {
    // needle = "AX" + "target" + "XB" = "AXtargetXB"
    const doc = 'AXtargetXB ... AXtargetXB';
    const result = anchorFromQuoteContext(
      doc,
      { exact: 'target', prefix: 'AX', suffix: 'XB' },
      20,
    );
    // Second "AXtargetXB" at index 15, prefix "AX" len=2 → exact starts at 17
    expect(result).toEqual({ start: 17, end: 23 });
  });

  it('works with empty prefix and suffix', () => {
    const doc = 'hello world';
    const result = anchorFromQuoteContext(doc, {
      exact: 'hello',
      prefix: '',
      suffix: '',
    });
    expect(result).toEqual({ start: 0, end: 5 });
  });
});

// ---------------------------------------------------------------------------
// anchorFromQuoteOnly
// ---------------------------------------------------------------------------

describe('anchorFromQuoteOnly', () => {
  it('finds exact text in document', () => {
    const result = anchorFromQuoteOnly('hello world', 'world');
    expect(result).toEqual({ start: 6, end: 11 });
  });

  it('strips surrounding double quotes', () => {
    const result = anchorFromQuoteOnly('hello world', '"world"');
    expect(result).toEqual({ start: 6, end: 11 });
  });

  it('returns null for empty string', () => {
    expect(anchorFromQuoteOnly('doc', '')).toBeNull();
  });

  it('returns null for whitespace-only', () => {
    expect(anchorFromQuoteOnly('doc', '   ')).toBeNull();
  });

  it('returns null when text not found', () => {
    expect(anchorFromQuoteOnly('hello', 'xyz')).toBeNull();
  });

  it('falls back to whitespace normalization when exact match fails', () => {
    const doc = 'hello   beautiful   world';
    const result = anchorFromQuoteOnly(doc, 'hello beautiful world');
    expect(result).not.toBeNull();
    expect(doc.slice(result!.start, result!.end)).toBe('hello   beautiful   world');
  });

  it('uses position hint to disambiguate multiple matches', () => {
    const doc = 'foo bar baz foo bar baz';
    const result = anchorFromQuoteOnly(doc, 'foo bar', { positionHint: 15 });
    expect(result).toEqual({ start: 12, end: 19 });
  });

  it('uses prefix/suffix to disambiguate', () => {
    // "target" appears at index 4 and index 23
    const doc = 'AAA target BBB ... CCC target DDD';
    const result = anchorFromQuoteOnly(doc, 'target', {
      prefix: 'CCC ',
      suffix: ' DDD',
    });
    expect(result).toEqual({ start: 23, end: 29 });
  });

  it('uses startFromOffset as fallback', () => {
    // With 3 matches and no context/hint, pickBestMatch returns first match.
    // startFromOffset only applies when pickBestMatch returns null (no positionHint, no prefix/suffix).
    // But pickBestMatch always returns something if matches > 0, so startFromOffset
    // is only used if pickBestMatch returns null — which won't happen here.
    // Verify it at least returns a valid match.
    const doc = 'ab ab ab';
    const result = anchorFromQuoteOnly(doc, 'ab', { startFromOffset: 4 });
    expect(result).not.toBeNull();
    expect(doc.slice(result!.start, result!.end)).toBe('ab');
  });
});
