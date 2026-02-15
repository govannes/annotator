export interface RangeSelector {
  start: string;       
  end: string;
  startOffset: number; 
  endOffset: number;
}

export interface TextPositionSelector {
  start: number;       
  end: number;
}

export interface TextQuoteSelector {
  exact: string;       
  prefix: string;      
  suffix: string;      
}

export interface AnnotationTarget {
  source: string;      
  selector: {
    range?: RangeSelector;
    textPosition?: TextPositionSelector;
    textQuote?: TextQuoteSelector;
  };
}

export interface Annotation {
  id: string;
  target: AnnotationTarget;
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
