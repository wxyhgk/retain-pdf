import { markdownParser } from './markdown-parser.ts';
import { parseMarkdownBodyBlocks, reparseBodyBlocks } from './parse.ts';
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

/**
 * What each block means, remembered: an edit changes a block or two, and
 * the editor writes the others the same each time, so a long article's
 * thousands of blocks are not parsed again at every edit.
 */
const meanings = new Map<string, string>();
const MEANINGS_KEPT = 50_000;

function semanticFingerprint(block: MarkdownBlockSlice): string {
	let known = meanings.get(block.raw);
	if (known === undefined) {
		if (meanings.size >= MEANINGS_KEPT) meanings.clear();
		known = meaning(block.raw);
		meanings.set(block.raw, known);
	}
	return known;
}

/**
 * Bodies' blocks, remembered: the original's, the same until the article is
 * saved or opened again, and the editor's last, which the next edit's are
 * cut from again only round the change.
 */
let lastOriginal: { body: string; blocks: MarkdownBlockSlice[] } | null = null;
let lastEdited: { body: string; blocks: MarkdownBlockSlice[] } | null = null;

function originalBlocksOf(body: string): MarkdownBlockSlice[] {
	if (lastOriginal?.body === body) return lastOriginal.blocks;
	// Just saved: cut again round what changed since the last original.
	lastOriginal = { body, blocks: lastOriginal ? reparseBodyBlocks(lastOriginal, body) : parseMarkdownBodyBlocks(body) };
	return lastOriginal.blocks;
}

function editedBlocksOf(body: string): MarkdownBlockSlice[] {
	const before = lastEdited ?? lastOriginal;
	lastEdited = { body, blocks: before ? reparseBodyBlocks(before, body) : parseMarkdownBodyBlocks(body) };
	return lastEdited.blocks;
}

/**
 * For each edited fingerprint, the original one it is lined up with (its
 * index there), or null: a longest run the two have in common, in order.
 * The start and the end they share are lined up as they are; only between
 * them is the table worked out, which is as big as the two lengths
 * multiplied (millions of entries for a book, when it was the whole).
 */
function align(original: readonly string[], edited: readonly string[]): (number | null)[] {
	const aligned: (number | null)[] = edited.map(() => null);
	let head = 0;
	while (head < original.length && head < edited.length && original[head] === edited[head]) {
		aligned[head] = head;
		head += 1;
	}
	let tail = 0;
	while (tail < original.length - head && tail < edited.length - head && original[original.length - 1 - tail] === edited[edited.length - 1 - tail]) {
		aligned[edited.length - 1 - tail] = original.length - 1 - tail;
		tail += 1;
	}
	const originalEnd = original.length - tail;
	const editedEnd = edited.length - tail;
	const width = editedEnd - head + 1;
	/** From each pair of positions on, how long the longest run in common is. */
	const lengths = new Uint32Array((originalEnd - head + 1) * width);
	const at = (originalIndex: number, editedIndex: number) => (originalIndex - head) * width + (editedIndex - head);
	for (let originalIndex = originalEnd - 1; originalIndex >= head; originalIndex -= 1) {
		for (let editedIndex = editedEnd - 1; editedIndex >= head; editedIndex -= 1) {
			const cell = at(originalIndex, editedIndex);
			lengths[cell] = original[originalIndex] === edited[editedIndex] ? lengths[cell + width + 1]! + 1 : Math.max(lengths[cell + width]!, lengths[cell + 1]!);
		}
	}
	let originalIndex = head;
	let editedIndex = head;
	while (originalIndex < originalEnd && editedIndex < editedEnd) {
		if (original[originalIndex] === edited[editedIndex]) {
			aligned[editedIndex] = originalIndex;
			originalIndex += 1;
			editedIndex += 1;
		} else if (lengths[at(originalIndex + 1, editedIndex)]! >= lengths[at(originalIndex, editedIndex + 1)]!) originalIndex += 1;
		else editedIndex += 1;
	}
	return aligned;
}

/**
 * For each of the edited body's blocks, the original block it means the
 * same as (its index there), or null for one that is new or changed: the
 * same lining up the merge below makes.
 */
export function alignBodyBlocks(originalBlocks: readonly MarkdownBlockSlice[], editedBlocks: readonly MarkdownBlockSlice[]): (number | null)[] {
	return align(originalBlocks.map(semanticFingerprint), editedBlocks.map(semanticFingerprint));
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
		return { body: originalBody, retainedBlocks: originalBlocksOf(originalBody).length, changedBlocks: 0 };
	}

	const originalBlocks = originalBlocksOf(originalBody);
	const editedBlocks = editedBlocksOf(editedBody);
	if (!originalBlocks.length || !editedBlocks.length) {
		return {
			body: editedBody,
			retainedBlocks: 0,
			changedBlocks: editedBlocks.length,
		};
	}

	const aligned = alignBodyBlocks(originalBlocks, editedBlocks);
	const pieces: Piece[] = [];
	/** Original blocks between two kept ones: what the edited blocks between them replace, in order. */
	let replaced: number[] = [];
	let nextOriginal = 0;
	for (const [editedIndex, block] of editedBlocks.entries()) {
		const kept = aligned[editedIndex];
		if (kept !== null && kept !== undefined) {
			pieces.push({ raw: originalBlocks[kept]!.raw, edited: block.raw, original: kept });
			nextOriginal = kept + 1;
			replaced = [];
			continue;
		}
		if (editedIndex === 0 || aligned[editedIndex - 1] !== null) {
			const until = aligned.slice(editedIndex).find((index) => index !== null) ?? originalBlocks.length;
			replaced = Array.from({ length: until - nextOriginal }, (_, index) => nextOriginal + index);
		}
		const counterpart = replaced.shift();
		const original = counterpart === undefined ? undefined : originalBlocks[counterpart];
		pieces.push({ raw: withOriginalSpacing(withOriginalBullet(block, original), original), edited: block.raw });
	}

	const merged = settle(pieces, originalBlocks.length, editedBody);
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
	// A single final newline is the editor's to write; blank lines after it are the author's. Without
	// those, no blank line is made at the end: a last block put where one from the middle was keeps the
	// blank line that one had before the next; the body ends in the original's one newline instead.
	if (/\n[^\n]*\n/u.test(trailing)) kept = kept.replace(TRAILING, '') + trailing;
	else if (/\n[^\n]*\n/u.test(TRAILING.exec(kept)![0])) kept = kept.replace(TRAILING, '') + (trailing || '\n');
	return kept;
}

const counts = (pieces: readonly Piece[]) => {
	const retainedBlocks = pieces.filter((piece) => piece.original !== undefined).length;
	return { retainedBlocks, changedBlocks: pieces.length - retainedBlocks };
};

/**
 * Whether the merged body means what the editor wrote. Only where it was
 * put together differently is it read again: from the piece before the
 * first one that is not the original's next block to the piece after the
 * last, each side as it is there. The rest is the original's blocks as they
 * were, each meaning what the editor wrote (that is how they were kept), so
 * a long article is not parsed whole twice at every edit.
 */
function meansTheSame(pieces: readonly Piece[], originalCount: number): boolean {
	const odd = (index: number) => {
		const piece = pieces[index]!;
		if (piece.original === undefined) return true;
		const before = index ? pieces[index - 1]!.original : -1;
		const after = index < pieces.length - 1 ? pieces[index + 1]!.original : originalCount;
		return before !== piece.original - 1 || after !== piece.original + 1;
	};
	let first = -1;
	let last = -1;
	for (let index = 0; index < pieces.length; index += 1) {
		if (!odd(index)) continue;
		if (first < 0) first = index;
		last = index;
	}
	if (first < 0) return true;
	const around = pieces.slice(Math.max(0, first - 1), last + 2);
	return meaning(joinBlocks(around)) === meaning(around.map((piece) => piece.edited).join(''));
}

/**
 * The merged body, once it means what the editor wrote. If it does not,
 * edited blocks first lose the bullets given back to them, then kept blocks
 * next to a change are written the editor's way, one ring at a time; at
 * worst the body is the editor's.
 */
function settle(pieces: Piece[], originalCount: number, editedBody: string): MarkdownBodyMerge {
	let current = pieces;
	if (meansTheSame(current, originalCount)) return { body: joinBlocks(current), ...counts(current) };

	current = current.map((piece) => (piece.original === undefined ? { ...piece, raw: piece.edited } : piece));
	for (;;) {
		if (meansTheSame(current, originalCount)) return { body: joinBlocks(current), ...counts(current) };
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
