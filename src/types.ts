export interface Selector {
  exact: string;       
  prefix: string;      
  suffix: string;   
  start: string;       
  end: string;
  startOffset: number; 
  endOffset: number;
}

export interface Annotation {
  id: string;
  selector: Selector;
  pageUrl?: string;
  baseUrl?: string;
  body?: { type: string; value: string };
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
