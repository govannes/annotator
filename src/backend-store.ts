/**
 * Annotation storage using the backend API (see BACKEND-STORAGE.md).
 * All load/save/delete go to the backend API.
 */

import type { Annotation, AnnotationTarget } from './types';
import type { AnnotationStore, SaveOptions } from './storage';

const DEFAULT_BASE_URL = 'http://localhost:3000';

/** API request body for POST /annotations (camelCase). No fullPage — use POST /full-page after save. */
interface ApiAnnotationBody {
  id?: string;
  source: string;
  pageUrl: string;
  selector: Annotation['target']['selector'];
  bodyType?: string;
  bodyValue?: string;
  highlightType?: string;
  highlightColor?: string;
  baseUrl?: string;
}

/** API request body for POST /full-page (link snapshot to annotation). */
interface ApiFullPageBody {
  html: string;
  baseUrl: string;
  fullPath: string;
  annotationId: string;
}

/** API response for POST /full-page. */
interface ApiFullPageResponse {
  id: string;
  contentHash: string;
}

/** API response shape (camelCase). */
interface ApiAnnotationResponse {
  id: string;
  source: string;
  pageUrl: string;
  selector: Annotation['target']['selector'];
  bodyType?: string;
  bodyValue?: string;
  created?: string;
  highlightType?: string;
  highlightColor?: string;
  fullPageId?: string;
  baseUrl?: string;
}

function apiToAnnotation(api: ApiAnnotationResponse): Annotation {
  const target: AnnotationTarget = {
    source: api.source,
    selector: api.selector ?? {},
  };
  const ann: Annotation = {
    id: api.id,
    target,
    pageUrl: api.pageUrl,
    created: api.created,
    highlightType: api.highlightType,
    highlightColor: api.highlightColor,
    fullPageId: api.fullPageId,
    baseUrl: api.baseUrl,
  };
  if (api.bodyType != null || api.bodyValue != null) {
    ann.body = { type: api.bodyType ?? '', value: api.bodyValue ?? '' };
  }
  return ann;
}

function annotationToApiBody(annotation: Annotation): ApiAnnotationBody {
  return {
    id: annotation.id,
    source: annotation.target.source,
    pageUrl: annotation.pageUrl ?? annotation.target.source,
    selector: annotation.target.selector,
    bodyType: annotation.body?.type,
    bodyValue: annotation.body?.value,
    highlightType: annotation.highlightType,
    highlightColor: annotation.highlightColor,
    baseUrl: annotation.baseUrl,
  };
}

export interface BackendStoreConfig {
  /** Base URL of the annotations API (e.g. http://localhost:3000). */
  baseUrl: string;
}

/**
 * Create an AnnotationStore that uses the backend API.
 * load() → GET /annotations; save() → POST /annotations then optionally POST /full-page; delete() → DELETE /annotations/:id.
 */
export function createBackendStore(config: BackendStoreConfig): AnnotationStore {
  const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');

  return {
    async load(): Promise<Annotation[]> {
      const res = await fetch(`${baseUrl}/annotations`);
      if (!res.ok) throw new Error(`Annotations API load failed: ${res.status} ${res.statusText}`);
      const data = (await res.json()) as ApiAnnotationResponse[];
      if (!Array.isArray(data)) return [];
      return data.map(apiToAnnotation);
    },

    async save(annotation: Annotation, options?: SaveOptions): Promise<Annotation> {
      const body = annotationToApiBody(annotation);
      const res = await fetch(`${baseUrl}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Annotations API save failed: ${res.status} ${res.statusText} — ${text}`);
      }
      const api = (await res.json()) as ApiAnnotationResponse;
      let result = apiToAnnotation(api);

      if (options?.fullPage && result.id) {
        const fpBody: ApiFullPageBody = {
          html: options.fullPage.html,
          baseUrl: options.fullPage.baseUrl,
          fullPath: options.fullPage.fullPath,
          annotationId: result.id,
        };
        const fpRes = await fetch(`${baseUrl}/full-page`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fpBody),
        });
        if (fpRes.ok) {
          const fp = (await fpRes.json()) as ApiFullPageResponse;
          result = { ...result, fullPageId: fp.id };
        }
      }

      return result;
    },

    async delete(id: string): Promise<void> {
      const res = await fetch(`${baseUrl}/annotations/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) {
        throw new Error(`Annotations API delete failed: ${res.status} ${res.statusText}`);
      }
    },
  };
}
