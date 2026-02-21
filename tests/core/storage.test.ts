import { describe, it, expect, beforeEach } from 'vitest';
import { loadAnnotations, saveAnnotation, deleteAnnotation } from '@/core/storage';
import type { Annotation, Selector } from '@/types';

function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  const selector: Selector = {
    exact: 'test text',
    prefix: 'before ',
    suffix: ' after',
    start: 'p[1]',
    end: 'p[1]',
    startOffset: 0,
    endOffset: 9,
  };
  return {
    id: crypto.randomUUID(),
    selector,
    pageUrl: 'https://example.com',
    created: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// loadAnnotations
// ---------------------------------------------------------------------------

describe('loadAnnotations', () => {
  it('returns empty array when nothing is stored', async () => {
    const result = await loadAnnotations();
    expect(result).toEqual([]);
  });

  it('returns stored annotations', async () => {
    const ann = makeAnnotation();
    await saveAnnotation(ann);
    const result = await loadAnnotations();
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(ann.id);
  });

  it('survives corrupted localStorage data', async () => {
    localStorage.setItem('annotator_annotations', 'not valid json');
    const result = await loadAnnotations();
    expect(result).toEqual([]);
  });

  it('returns empty when localStorage has non-array JSON', async () => {
    localStorage.setItem('annotator_annotations', '{"not":"an array"}');
    const result = await loadAnnotations();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// saveAnnotation
// ---------------------------------------------------------------------------

describe('saveAnnotation', () => {
  it('saves a new annotation', async () => {
    const ann = makeAnnotation();
    const saved = await saveAnnotation(ann);
    expect(saved.id).toBe(ann.id);

    const all = await loadAnnotations();
    expect(all).toHaveLength(1);
  });

  it('returns the annotation back', async () => {
    const ann = makeAnnotation({ pageUrl: 'https://test.com' });
    const saved = await saveAnnotation(ann);
    expect(saved).toEqual(ann);
  });

  it('updates an existing annotation by id', async () => {
    const ann = makeAnnotation();
    await saveAnnotation(ann);

    const updated = { ...ann, pageUrl: 'https://updated.com' };
    await saveAnnotation(updated);

    const all = await loadAnnotations();
    expect(all).toHaveLength(1);
    expect(all[0]!.pageUrl).toBe('https://updated.com');
  });

  it('appends multiple different annotations', async () => {
    await saveAnnotation(makeAnnotation());
    await saveAnnotation(makeAnnotation());
    await saveAnnotation(makeAnnotation());

    const all = await loadAnnotations();
    expect(all).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// deleteAnnotation
// ---------------------------------------------------------------------------

describe('deleteAnnotation', () => {
  it('removes an annotation by id', async () => {
    const ann = makeAnnotation();
    await saveAnnotation(ann);
    await deleteAnnotation(ann.id);

    const all = await loadAnnotations();
    expect(all).toHaveLength(0);
  });

  it('does nothing if id does not exist', async () => {
    const ann = makeAnnotation();
    await saveAnnotation(ann);
    await deleteAnnotation('nonexistent-id');

    const all = await loadAnnotations();
    expect(all).toHaveLength(1);
  });

  it('only removes the targeted annotation', async () => {
    const ann1 = makeAnnotation();
    const ann2 = makeAnnotation();
    await saveAnnotation(ann1);
    await saveAnnotation(ann2);

    await deleteAnnotation(ann1.id);

    const all = await loadAnnotations();
    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe(ann2.id);
  });
});
