// ─── Page Types ──────────────────────────────────────────────────────────────

export type PageType = 'static' | 'spa' | 'infinite' | 'pdf' | 'canvas';

export type AnnotationState =
  | 'stored'    // saved but not tried yet
  | 'anchored'  // found in DOM, highlighted
  | 'orphaned'  // was highlighted, DOM node removed (infinite scroll recycled it)
  | 'failed'    // tried to find, couldn't
  | 'deferred'; // content not in DOM yet, will retry when visible

// ─── Anchor Strategies ───────────────────────────────────────────────────────

export type AnchorStrategy =
  | { type: 'dom-xpath'; start: string; end: string; startOffset: number; endOffset: number }
  | { type: 'text-position'; startOffset: number; endOffset: number }
  | { type: 'text-quote'; exact: string; prefix: string; suffix: string }
  | { type: 'pdf-position'; pageNumber: number; startOffset: number; endOffset: number };

// ─── Annotation (what gets stored) ───────────────────────────────────────────

export interface Annotation {
  id: string;
  pageUrl: string;
  baseUrl: string;
  exact: string;
  anchors: AnchorStrategy[];
  body?: { type: string; value: string };
  created: string;
}

// ─── Anchor Targets (what resolve() returns) ─────────────────────────────────

export type AnchorTarget =
  | { type: 'dom-range'; range: Range }
  | { type: 'rect'; rects: DOMRect[] }
  | { type: 'virtual'; text: string; metadata: unknown };

export type ResolveResult =
  | { ok: true; target: AnchorTarget }
  | { ok: false; error: string };

// ─── Context types ───────────────────────────────────────────────────────────

export interface PageContext {
  pageUrl: string;
  baseUrl: string;
  root: Element;
  pageType: PageType;
}

export interface SelectionInfo {
  selection: Selection;
  range: Range;
  text: string;
  root: Element;
}

// ─── Highlight ───────────────────────────────────────────────────────────────

export interface HighlightStyle {
  color: string;
  opacity?: number;
}

export interface HighlightHandle {
  annotationId: string;
  dispose(): void;
}

// ─── Core Interfaces ─────────────────────────────────────────────────────────

export interface Anchorer {
  buildAnchor(selection: SelectionInfo, context: PageContext): AnchorStrategy[];
  resolve(anchor: AnchorStrategy, context: PageContext): ResolveResult;
  canHandle(context: PageContext): boolean;
}

export interface Highlighter {
  highlight(target: AnchorTarget, annotationId: string, style: HighlightStyle): HighlightHandle;
  remove(handle: HighlightHandle): void;
  clearAll(): void;
  canHandle(target: AnchorTarget): boolean;
}

export interface PageObserver {
  watch(config: {
    root: Element;
    onContentReady: (contentId: string) => void;
    onContentRemoved?: (contentId: string) => void;
  }): void;
  dispose(): void;
  canHandle(context: PageContext): boolean;
}

export interface SiteAdapter {
  matchesUrl(url: string): boolean;
  getContentId(element: Element): string | null;
  getScrollContainer(): Element | null;
  getPageType(): PageType;
}

export interface AnnotationStorage {
  loadAll(pageUrl: string): Promise<Annotation[]>;
  save(annotation: Annotation): Promise<void>;
  delete(id: string): Promise<void>;
}
