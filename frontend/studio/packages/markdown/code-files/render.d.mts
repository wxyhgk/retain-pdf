import type { FenceMeta } from './highlight.mjs';

export type HastElement = { type: 'element'; tagName: string; properties: Record<string, unknown>; children: HastChild[] };
export type HastChild = HastElement | { type: 'text'; value: string };

export declare const PRE_STYLE: string;
export declare function codeFileBar(file: { language: string; title?: string; path?: string; href?: string; total?: number }): HastElement;
export declare function foldFor(lines: number, meta: FenceMeta): number;
export declare function figureProperties(language: string, fold: number, extra?: string[]): Record<string, unknown>;
export declare function codeFileFigure(block: {
	language: string;
	meta: FenceMeta;
	source: string;
	file?: { path: string; text: string; href: string };
}): HastElement;
export declare function codeFileProblem(language: string, message: string): HastElement;
