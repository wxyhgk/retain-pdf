export type Token = [text: string, name: string | null];
export type LineRange = { start: number; end: number };
export type FenceMeta = {
	title: string;
	lines: LineRange | null;
	open: boolean;
	fold: boolean;
	/** `match=`: lines holding one of these texts. */
	match: string[] | null;
	/** `context=`: lines around each match. */
	context: number;
	/** `from=` … `to=`: the stretches between lines holding these. */
	from: string[] | null;
	to: string[] | null;
	/** `last`: only the last match or stretch. */
	last: boolean;
	/** `hl=`: line numbers that stand out. */
	highlight: LineRange[];
	/** `mark=`: lines holding one of these stand out. */
	mark: string[] | null;
};

export declare const TOKEN_COLORS: Readonly<Record<string, string>>;
export declare function tokenStyle(name: string | null): string;
export declare function highlightLines(language: string, source: string, keep?: (lineNumber: number) => boolean): (Token[] | null)[];
export declare function parseFenceMeta(meta: unknown): FenceMeta;
export declare function holdsAny(line: string, texts: string[] | null): boolean;
export declare function isMarked(meta: FenceMeta, number: number, line: string): boolean;
export declare const FOLD_AFTER: number;
export declare const FOLDED_LINES: number;
export declare const EXCERPT_AFTER: number;
export declare const HEAD_LINES: number;
export declare const TAIL_LINES: number;
export declare function excerptLines(
	text: string,
	options: Partial<FenceMeta> | LineRange | null,
): { parts: { start: number; lines: string[] }[]; total: number; picked?: boolean; missing?: string };
export declare function downloadName(language: string, title?: string, path?: string): string;
