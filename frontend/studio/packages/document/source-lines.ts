import { alignBodyBlocks } from './merge.ts';
import { parseMarkdownBodyBlocks, parseStudioDocument } from './parse.ts';

/**
 * Which lines of an article's file the editor's selection is, for telling
 * someone else (an AI in the terminal) what to look at. The editor marks
 * the selected blocks with a paragraph holding `SELECTION_START` before
 * them and one holding `SELECTION_END` after, and writes the whole as
 * Markdown; its blocks are lined up with the file's as a save lines them
 * up, and the file's blocks between the marks are the lines.
 */

export const SELECTION_START = 'STUDIOSELECTIONSTARTMARK';
export const SELECTION_END = 'STUDIOSELECTIONENDMARK';

export type SourceLines = {
	/** The first line, counting from 1, in the whole file (properties and all). */
	start: number;
	/** The last line. */
	end: number;
	/** Those lines, as they are in the file. */
	text: string;
};

function lineAt(source: string, offset: number): number {
	let line = 1;
	for (let index = source.indexOf('\n'); index !== -1 && index < offset; index = source.indexOf('\n', index + 1)) line += 1;
	return line;
}

/** The lines of `source` the marks in `marked` (the editor's body, as Markdown) stand around; null when they cannot be told. */
export function sourceLinesOf(source: string, marked: string): SourceLines | null {
	const blocks = parseStudioDocument(source).body.blocks.filter((block) => block.kind !== 'whitespace');
	const edited = parseMarkdownBodyBlocks(marked);
	const first = edited.findIndex((block) => block.raw.includes(SELECTION_START));
	const last = edited.findIndex((block) => block.raw.includes(SELECTION_END));
	if (first < 0 || last <= first || !blocks.length) return null;
	const aligned = alignBodyBlocks(blocks, edited);
	const inside = aligned.slice(first + 1, last).filter((index): index is number => index !== null);
	// Changed blocks among them match none of the file's: the file's blocks between the kept neighbours stand for them.
	const before = aligned.slice(0, first).filter((index): index is number => index !== null).at(-1) ?? -1;
	const after = aligned.slice(last + 1).find((index): index is number => index !== null) ?? blocks.length;
	const from = Math.min(inside[0] ?? before + 1, before + 1);
	const to = Math.max(inside.at(-1) ?? after - 1, after - 1);
	if (from > to || from < 0 || to >= blocks.length) return null;
	let startOffset = blocks[from]!.start;
	let endOffset = blocks[to]!.end;
	// The blocks' blank lines around them are not theirs.
	while (startOffset < endOffset && /\s/u.test(source[startOffset]!)) startOffset += 1;
	while (endOffset > startOffset && /\s/u.test(source[endOffset - 1]!)) endOffset -= 1;
	return { start: lineAt(source, startOffset), end: lineAt(source, endOffset), text: source.slice(startOffset, endOffset) };
}
