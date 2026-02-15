import type { Annotation } from '../types';

const STORAGE_KEY = 'annotator_annotations';

function readAll(): Annotation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(annotations: Annotation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(annotations));
}

export async function loadAnnotations(): Promise<Annotation[]> {
  return readAll();
}

export async function saveAnnotation(annotation: Annotation): Promise<Annotation> {
  const all = readAll();
  const idx = all.findIndex((a) => a.id === annotation.id);
  if (idx >= 0) {
    all[idx] = annotation;
  } else {
    all.push(annotation);
  }
  writeAll(all);
  return annotation;
}

export async function deleteAnnotation(id: string): Promise<void> {
  const all = readAll();
  writeAll(all.filter((a) => a.id !== id));
}
