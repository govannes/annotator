export interface Selector {
  exact: string;
  prefix: string;
  suffix: string;

  // Strategy 1: XPath path + char offset within the resolved element
  start: string;
  end: string;
  startOffset: number;
  endOffset: number;

  // Strategy 2: document-level character offsets (independent of DOM structure)
  docStartOffset?: number;
  docEndOffset?: number;
}

export interface ElementSelector {
  cssPath: string;
  xpath: string;
  tagName: string;
  attributes?: Record<string, string>;
  textSnippet?: string;
}

export interface Annotation {
  id: string;
  type?: 'highlight' | 'element';
  selector: Selector;
  elementSelector?: ElementSelector;
  pageUrl?: string;
  baseUrl?: string;
  body?: { type: string; value: string };
  color?: string;
  created?: string;
}

export type AnchoringStrategy =
  | 'range'         
  | 'position'      
  | 'quote-context' 
  | 'quote-only';   

export type AnchorResult =
  | { ok: true; range: Range; strategy: AnchoringStrategy }
  | { ok: false; error: string };
