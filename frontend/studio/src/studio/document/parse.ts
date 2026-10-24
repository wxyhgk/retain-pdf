import { markdownParser } from './markdown-parser.ts';
import type { FrontmatterSlice, MarkdownBlockSlice, StudioDocument } from './types.ts';

type SourceLine = {
	start: number;
	contentEnd: number;
	end: number;
};

type PositionedNode = {
	type?: unknown;
	position?: {
		start?: { offset?: number };
		end?: { offset?: number };
	};
};

function readLines(source: string, start: number): SourceLine[] {
	const lines: SourceLine[] = [];
	let cursor = start;

	while (cursor < source.length) {
		const lineStart = cursor;
		while (cursor < source.length && source[cursor] !== '\n' && source[cursor] !== '\r') cursor += 1;
		const contentEnd = cursor;

		if (source[cursor] === '\r' && source[cursor + 1] === '\n') cursor += 2;
		else if (source[cursor] === '\r' || source[cursor] === '\n') cursor += 1;

		lines.push({ start: lineStart, contentEnd, end: cursor });
	}

	return lines;
}

function markerForLine(source: string, line: SourceLine): string {
	return source.slice(line.start, line.contentEnd).trimEnd();
}

function splitFrontmatter(source: string, contentStart: number): FrontmatterSlice | null {
	const lines = readLines(source, contentStart);
	const opening = lines[0];
	if (!opening || markerForLine(source, opening) !== '---' || opening.end === opening.contentEnd) return null;

	const closing = lines.slice(1).find((line) => {
		const marker = markerForLine(source, line);
		return marker === '---' || marker === '...';
	});
	if (!closing) return null;

	return {
		start: opening.start,
		end: closing.end,
		raw: source.slice(opening.start, closing.end),
		openingRaw: source.slice(opening.start, opening.end),
		yamlRaw: source.slice(opening.end, closing.start),
		closingRaw: source.slice(closing.start, closing.end),
	};
}

function fallbackBlock(bodyRaw: string, bodyStart: number): MarkdownBlockSlice[] {
	if (bodyRaw.length === 0) return [];
	return [{
		kind: /^\s*$/u.test(bodyRaw) ? 'whitespace' : 'unknown',
		start: bodyStart,
		end: bodyStart + bodyRaw.length,
		raw: bodyRaw,
	}];
}

function sliceBody(bodyRaw: string, bodyStart: number): MarkdownBlockSlice[] {
	if (bodyRaw.length === 0) return [];

	let root: { children?: PositionedNode[] };
	try {
		// Run the parser's transforms too: a display formula on its own lines is a block of its own.
		root = markdownParser.runSync(markdownParser.parse(bodyRaw)) as { children?: PositionedNode[] };
	} catch {
		return fallbackBlock(bodyRaw, bodyStart);
	}

	const nodes = (root.children ?? []).filter((node) => (
		typeof node.position?.start?.offset === 'number'
		&& typeof node.position?.end?.offset === 'number'
	));
	if (nodes.length === 0) return fallbackBlock(bodyRaw, bodyStart);

	return nodes.map((node, index) => {
		const start = index === 0 ? 0 : node.position!.start!.offset!;
		const next = nodes[index + 1];
		const end = next ? next.position!.start!.offset! : bodyRaw.length;

		return {
			kind: typeof node.type === 'string' ? node.type : 'unknown',
			start: bodyStart + start,
			end: bodyStart + end,
			raw: bodyRaw.slice(start, end),
		};
	});
}

/** Parses a body without treating a leading thematic break as frontmatter. */
export function parseMarkdownBodyBlocks(body: string): MarkdownBlockSlice[] {
	return sliceBody(body, 0);
}

/** The first index in `blocks` whose block ends past `offset` (or at it, with `orAt`). */
function blockAt(blocks: readonly MarkdownBlockSlice[], offset: number, orAt: boolean): number {
	let low = 0;
	let high = blocks.length - 1;
	while (low < high) {
		const middle = (low + high) >> 1;
		if (orAt ? blocks[middle]!.end >= offset : blocks[middle]!.end > offset) high = middle;
		else low = middle + 1;
	}
	return low;
}

/**
 * A body's blocks, from those of the body before an edit to it: only from
 * the block before the change to the block after it is cut again; the rest
 * are the ones before, moved by what the edit added or took away. The block
 * after the change has to come out as it was, or the change reaches further
 * (a fence opened, say) and the whole is cut again. As parseMarkdownBodyBlocks.
 */
export function reparseBodyBlocks(before: { body: string; blocks: readonly MarkdownBlockSlice[] }, body: string): MarkdownBlockSlice[] {
	const old = before.body;
	const blocks = before.blocks;
	if (old === body) return [...blocks];
	if (!blocks.length || !body.length) return parseMarkdownBodyBlocks(body);
	let head = 0;
	const shorter = Math.min(old.length, body.length);
	while (head < shorter && old.charCodeAt(head) === body.charCodeAt(head)) head += 1;
	let tail = 0;
	while (tail < shorter - head && old.charCodeAt(old.length - 1 - tail) === body.charCodeAt(body.length - 1 - tail)) tail += 1;
	const moved = body.length - old.length;
	const from = Math.max(0, blockAt(blocks, head, false) - 1);
	const until = Math.min(blocks.length - 1, blockAt(blocks, old.length - tail, true) + 1);
	const start = blocks[from]!.start;
	const lastBlock = blocks[until]!;
	const end = lastBlock.end + moved;
	const cut = sliceBody(body.slice(start, end), start);
	if (until < blocks.length - 1) {
		const last = cut.at(-1);
		if (!last || last.start !== lastBlock.start + moved || last.raw !== lastBlock.raw || last.kind !== lastBlock.kind) return parseMarkdownBodyBlocks(body);
	}
	const after = blocks.slice(until + 1).map((block) => ({ ...block, start: block.start + moved, end: block.end + moved }));
	return [...blocks.slice(0, from), ...cut, ...after];
}

/**
 * Creates a lossless, raw-first document view. Parsing records source ranges but
 * never normalizes Markdown, YAML, HTML, whitespace, or line endings.
 */
export function parseStudioDocument(source: string): StudioDocument {
	const preambleRaw = source.startsWith('\uFEFF') ? '\uFEFF' : '';
	const contentStart = preambleRaw.length;
	const frontmatter = splitFrontmatter(source, contentStart);
	const bodyStart = frontmatter?.end ?? contentStart;
	const bodyRaw = source.slice(bodyStart);

	let blocks: MarkdownBlockSlice[] | undefined;
	return {
		preambleRaw,
		frontmatter,
		body: {
			start: bodyStart,
			end: source.length,
			raw: bodyRaw,
			// Cut when asked for: most callers want the frontmatter or the body as text, and parsing a long body takes a while.
			get blocks() {
				blocks ??= sliceBody(bodyRaw, bodyStart);
				return blocks;
			},
		},
	};
}
