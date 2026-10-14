import remarkMath from 'remark-math';
import remarkMathBrackets from '../../plugins/remark-math-brackets.mjs';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { parseMarkdownBodyBlocks } from './parse.ts';
import type { MarkdownBlockSlice } from './types.ts';

export type MarkdownBodyMerge = {
	/** Body assembled in the order emitted by the editor. */
	readonly body: string;
	/** Semantically unchanged blocks restored from the original source. */
	readonly retainedBlocks: number;
	/** New or changed blocks accepted from the editor. */
	readonly changedBlocks: number;
};

const semanticParser = unified().use(remarkParse).use(remarkMath).use(remarkMathBrackets);

/**
 * The tree without what does not change the Markdown's meaning: source
 * positions, and `data`, the rendering hints plugins attach (a `\[…\]` in a
 * sentence is drawn display-style, which the editor writes back as `$…$`).
 */
function withoutPositions(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(withoutPositions);
	if (!value || typeof value !== 'object') return value;
	const clean: Record<string, unknown> = {};
	for (const [key, child] of Object.entries(value)) {
		if (key !== 'position' && key !== 'data') clean[key] = withoutPositions(child);
	}
	return clean;
}

function semanticFingerprint(block: MarkdownBlockSlice): string {
	try {
		const root = semanticParser.runSync(semanticParser.parse(block.raw)) as { children?: unknown[] };
		return JSON.stringify(withoutPositions(root.children ?? []));
	} catch {
		return `raw:${block.raw}`;
	}
}

function lcsLengths(original: readonly string[], edited: readonly string[]): number[][] {
	const rows = Array.from({ length: original.length + 1 }, () => Array<number>(edited.length + 1).fill(0));
	for (let originalIndex = original.length - 1; originalIndex >= 0; originalIndex -= 1) {
		for (let editedIndex = edited.length - 1; editedIndex >= 0; editedIndex -= 1) {
			rows[originalIndex]![editedIndex] = original[originalIndex] === edited[editedIndex]
				? rows[originalIndex + 1]![editedIndex + 1]! + 1
				: Math.max(rows[originalIndex + 1]![editedIndex]!, rows[originalIndex]![editedIndex + 1]!);
		}
	}
	return rows;
}

/**
 * Keeps byte-exact source for semantically unchanged top-level Markdown blocks.
 * Crepe output is used only for blocks that were inserted or genuinely edited.
 */
export function mergeMarkdownBody(originalBody: string, editedBody: string): MarkdownBodyMerge {
	if (originalBody === editedBody) {
		return { body: originalBody, retainedBlocks: parseMarkdownBodyBlocks(originalBody).length, changedBlocks: 0 };
	}

	const originalBlocks = parseMarkdownBodyBlocks(originalBody);
	const editedBlocks = parseMarkdownBodyBlocks(editedBody);
	if (!originalBlocks.length || !editedBlocks.length) {
		return {
			body: editedBody,
			retainedBlocks: 0,
			changedBlocks: editedBlocks.length,
		};
	}

	const originalFingerprints = originalBlocks.map(semanticFingerprint);
	const editedFingerprints = editedBlocks.map(semanticFingerprint);
	const lengths = lcsLengths(originalFingerprints, editedFingerprints);
	/** Each piece with the index of the original block it keeps, if it keeps one. */
	const merged: Array<{ raw: string; original?: number }> = [];
	let originalIndex = 0;
	let editedIndex = 0;
	let retainedBlocks = 0;
	let changedBlocks = 0;

	while (originalIndex < originalBlocks.length && editedIndex < editedBlocks.length) {
		if (originalFingerprints[originalIndex] === editedFingerprints[editedIndex]) {
			merged.push({ raw: originalBlocks[originalIndex]!.raw, original: originalIndex });
			originalIndex += 1;
			editedIndex += 1;
			retainedBlocks += 1;
			continue;
		}
		if (lengths[originalIndex + 1]![editedIndex]! >= lengths[originalIndex]![editedIndex + 1]!) {
			originalIndex += 1;
		} else {
			merged.push({ raw: editedBlocks[editedIndex]!.raw });
			editedIndex += 1;
			changedBlocks += 1;
		}
	}
	while (editedIndex < editedBlocks.length) {
		merged.push({ raw: editedBlocks[editedIndex]!.raw });
		editedIndex += 1;
		changedBlocks += 1;
	}

	return { body: joinBlocks(merged), retainedBlocks, changedBlocks };
}

/**
 * The pieces as one body. A block carries the blank line after it, except
 * the last one in its document: so where two pieces were not neighbours in
 * the original, a blank line is made sure of, or a paragraph added after the
 * old last block would run into it. Neighbours keep exactly what was between them.
 */
function joinBlocks(pieces: ReadonlyArray<{ raw: string; original?: number }>): string {
	let body = '';
	let previous: number | undefined;
	for (const [index, piece] of pieces.entries()) {
		const neighbours = previous !== undefined && piece.original === previous + 1;
		if (index > 0 && !neighbours && !/\n[ \t\r]*\n$/u.test(body)) {
			const newline = /\r\n/u.test(body) ? '\r\n' : '\n';
			body += body.endsWith('\n') ? newline : newline + newline;
		}
		body += piece.raw;
		previous = piece.original;
	}
	return body;
}
