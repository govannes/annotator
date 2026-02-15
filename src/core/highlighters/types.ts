export interface HighlightStyle {
    type?: string;
    color?: string;
}

export interface Highlighter {
    draw(range: Range, annotationId: string, style: HighlightStyle): boolean;

    clear(root: Element): void;

    getAnnotationId(element: Element): string | null;

    isHighlight(element: Element): boolean;
}
