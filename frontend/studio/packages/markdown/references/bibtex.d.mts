export type BibEntry = { type: string; key: string; fields: Record<string, string> };
export type ReferencePiece = string | { em: string } | { strong: string } | { link: string };

export declare const BIBLIOGRAPHY_PATH: string;
export declare const CITATION: RegExp;
export declare function parseCitation(inner: string): { key: string; locator: string }[] | null;
export declare function parseBibtex(text: string): Map<string, BibEntry>;
export declare function plainTex(text: string | undefined): string;
export declare function authorList(authors: string | undefined): string;
export declare function referencePieces(entry: BibEntry): ReferencePiece[];
export declare function numberRanges(numbers: number[]): string;
