import { markdownParser } from './markdown-parser.ts';
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

/** What Markdown means, however it is written. */
function meaning(markdown: string): string {
	try {
		const root = markdownParser.runSync(markdownParser.parse(markdown)) as { children?: unknown[] };
		return JSON.stringify(withoutPositions(root.children ?? []));
	} catch {
		return `raw:${markdown}`;
	}
}

function semanticFingerprint(block: MarkdownBlockSlice): string {
	return meaning(block.raw);
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
 * One block of the merged body: the original's bytes when it means the
 * same (`original` is its index there), or else the editor's. `edited` is
 * the editor's version either way.
 */
type Piece = { raw: string; edited: string; original?: number };

const BULLET = /^( {0,3})([*+-])(?=[ \t]|$)/mu;

/**
 * An edited list written with the bullet its original used, for the
 * editor writes its own. A list's bullet also tells it apart from a list
 * right after it, so keeping it keeps the two lists two.
 */
function withOriginalBullet(edited: MarkdownBlockSlice, original: MarkdownBlockSlice | undefined): string {
	if (edited.kind !== 'list' || original?.kind !== 'list') return edited.raw;
	const wanted = BULLET.exec(original.raw)?.[2];
	const found = BULLET.exec(edited.raw);
	if (!wanted || !found || found[2] === wanted) return edited.raw;
	const marker = new RegExp(`^${found[1]}[${found[2]}](?=[ \\t]|$)`, 'gmu');
	return edited.raw.replace(marker, `${found[1]}${wanted}`);
}

/**
 * Keeps byte-exact source for semantically unchanged top-level Markdown blocks.
 * Crepe output is used only for blocks that were inserted or genuinely edited,
 * and the whole always means what the editor shows: where a kept block would
 * read differently next to an edited one (two lists running together, say),
 * it is written the editor's way too.
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
	const pieces: Piece[] = [];
	/** Original blocks passed over since the last kept one: what the next edited blocks replace. */
	let replaced: number[] = [];
	let originalIndex = 0;
	let editedIndex = 0;

	const pushEdited = () => {
		const block = editedBlocks[editedIndex]!;
		const counterpart = replaced.shift();
		const original = counterpart === undefined ? undefined : originalBlocks[counterpart];
		pieces.push({ raw: withOriginalSpacing(withOriginalBullet(block, original), original), edited: block.raw });
		editedIndex += 1;
	};
	while (originalIndex < originalBlocks.length && editedIndex < editedBlocks.length) {
		if (originalFingerprints[originalIndex] === editedFingerprints[editedIndex]) {
			pieces.push({ raw: originalBlocks[originalIndex]!.raw, edited: editedBlocks[editedIndex]!.raw, original: originalIndex });
			originalIndex += 1;
			editedIndex += 1;
			replaced = [];
			continue;
		}
		if (lengths[originalIndex + 1]![editedIndex]! >= lengths[originalIndex]![editedIndex + 1]!) {
			replaced.push(originalIndex);
			originalIndex += 1;
		} else {
			pushEdited();
		}
	}
	while (originalIndex < originalBlocks.length) replaced.push(originalIndex++);
	while (editedIndex < editedBlocks.length) pushEdited();

	const merged = settle(pieces, meaning(editedBody), editedBody);
	return { ...merged, body: withOriginalEnds(merged.body, originalBody) };
}

const LEADING = /^(?:[ \t]*\r?\n)*/u;
const TRAILING = /(?:\r?\n[ \t]*)*$/u;

/** An edited block followed by the blank lines its original had before the next block. */
function withOriginalSpacing(raw: string, original: MarkdownBlockSlice | undefined): string {
	if (!original) return raw;
	return raw.replace(TRAILING, '') + TRAILING.exec(original.raw)![0];
}

/**
 * The blank lines before the first block and after the last, as the
 * original had them: they belong to no block, so an edited first or last
 * block would otherwise take the editor's (none between the frontmatter and
 * the body, say).
 */
function withOriginalEnds(body: string, originalBody: string): string {
	const leading = LEADING.exec(originalBody)![0];
	const trailing = TRAILING.exec(originalBody)![0];
	if (!body.trim()) return body;
	let kept = body;
	if (leading) kept = leading + kept.replace(LEADING, '');
	// A single final newline is the editor's to write; blank lines after it are the author's.
	if (/\n[^\n]*\n/u.test(trailing)) kept = kept.replace(TRAILING, '') + trailing;
	return kept;
}

const counts = (pieces: readonly Piece[]) => {
	const retainedBlocks = pieces.filter((piece) => piece.original !== undefined).length;
	return { retainedBlocks, changedBlocks: pieces.length - retainedBlocks };
};

/**
 * The merged body, once it means what the editor wrote. If it does not,
 * edited blocks first lose the bullets given back to them, then kept blocks
 * next to a change are written the editor's way, one ring at a time; at
 * worst the body is the editor's.
 */
function settle(pieces: Piece[], target: string, editedBody: string): MarkdownBodyMerge {
	let current = pieces;
	let body = joinBlocks(current);
	if (meaning(body) === target) return { body, ...counts(current) };

	current = current.map((piece) => (piece.original === undefined ? { ...piece, raw: piece.edited } : piece));
	for (;;) {
		body = joinBlocks(current);
		if (meaning(body) === target) return { body, ...counts(current) };
		const settled = (index: number) => {
			const piece = current[index];
			const next = current[index + 1];
			return piece?.original !== undefined && next?.original !== undefined && next.original === piece.original + 1;
		};
		let widened = false;
		current = current.map((piece, index) => {
			if (piece.original === undefined) return piece;
			// A kept block beside a change, or beside where a block was removed.
			const touched = (index > 0 && !settled(index - 1)) || (index < current.length - 1 && !settled(index));
			if (!touched) return piece;
			widened = true;
			return { raw: piece.edited, edited: piece.edited };
		});
		if (!widened) return { body: editedBody, retainedBlocks: 0, changedBlocks: current.length };
	}
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
