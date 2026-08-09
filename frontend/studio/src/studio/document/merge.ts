import remarkMath from 'remark-math';
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

const semanticParser = unified().use(remarkParse).use(remarkMath);

function withoutPositions(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(withoutPositions);
	if (!value || typeof value !== 'object') return value;
	const clean: Record<string, unknown> = {};
	for (const [key, child] of Object.entries(value)) {
		if (key !== 'position') clean[key] = withoutPositions(child);
	}
	return clean;
}

function semanticFingerprint(block: MarkdownBlockSlice): string {
	try {
		const root = semanticParser.parse(block.raw) as { children?: unknown[] };
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
	const merged: string[] = [];
	let originalIndex = 0;
	let editedIndex = 0;
	let retainedBlocks = 0;
	let changedBlocks = 0;

	while (originalIndex < originalBlocks.length && editedIndex < editedBlocks.length) {
		if (originalFingerprints[originalIndex] === editedFingerprints[editedIndex]) {
			merged.push(originalBlocks[originalIndex]!.raw);
			originalIndex += 1;
			editedIndex += 1;
			retainedBlocks += 1;
			continue;
		}
		if (lengths[originalIndex + 1]![editedIndex]! >= lengths[originalIndex]![editedIndex + 1]!) {
			originalIndex += 1;
		} else {
			merged.push(editedBlocks[editedIndex]!.raw);
			editedIndex += 1;
			changedBlocks += 1;
		}
	}
	while (editedIndex < editedBlocks.length) {
		merged.push(editedBlocks[editedIndex]!.raw);
		editedIndex += 1;
		changedBlocks += 1;
	}

	return { body: merged.join(''), retainedBlocks, changedBlocks };
}
