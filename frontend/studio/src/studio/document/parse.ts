import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkMathBrackets from '../../plugins/remark-math-brackets.mjs';
import { unified } from 'unified';

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

const markdownParser = unified().use(remarkParse).use(remarkMath).use(remarkMathBrackets);

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

	return {
		preambleRaw,
		frontmatter,
		body: {
			start: bodyStart,
			end: source.length,
			raw: bodyRaw,
			blocks: sliceBody(bodyRaw, bodyStart),
		},
	};
}
