import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { Plugin as UnifiedPlugin, Transformer } from 'unified';
import { visitParents } from 'unist-util-visit-parents';

import type { MoleculeBlock } from '../../science/model.ts';
import { parseMoleculeBlock } from '../../science/parsers/molecule-block.ts';

/**
 * Science fenced-code blocks as first-class editor citizens.
 * Pure and DOM-free: parsing, classification and fence emission live here
 * so Node tests guard byte fidelity; the Milkdown glue stays thin in
 * `./crepe-science-block.ts`.
 */

/** mdast type our remark retag assigns to scientific fences. */
export const SCIENCE_FENCE_TYPE = 'science-block';

export type ScienceBlockDescriptor = {
	/** Verbatim fence info string, preserved for byte-identical output. */
	info: string;
	/** Verbatim fence body. */
	source: string;
	/** Molecule classification; null only when recognition fails. */
	block: MoleculeBlock | null;
};

/**
 * Describe a fence. Returns null when the language is not scientific,
 * so callers keep a single source of truth for recognition.
 */
export function parseScienceFence(infoInput: string, source: string): ScienceBlockDescriptor | null {
	const block = parseMoleculeBlock(infoInput, source);
	if (!block) return null;
	return { info: infoInput, source, block };
}

/** Emit the canonical fence for a descriptor. */
export function scienceFenceMarkdown(descriptor: ScienceBlockDescriptor): string {
	return `\`\`\`${descriptor.info}\n${descriptor.source}\n\`\`\``;
}

type MdastCodeNode = {
	type: string;
	lang?: string | null;
	meta?: string | null;
	value?: string;
};

/**
 * unified remark plugin: retag scientific `code` nodes to
 * `science-block`, leaving lang/value/meta untouched. Runs before
 * Milkdown's mdast matching, so the generic code rule never claims them.
 */
export function scienceRetag(): UnifiedPlugin {
	const transform: Transformer = (tree) => {
		visitParents(tree as Parameters<typeof visitParents>[0], 'code', (node) => {
			const code = node as unknown as MdastCodeNode;
			if (typeof code.lang === 'string' && parseMoleculeBlock(code.lang, code.value ?? '')) {
				code.type = SCIENCE_FENCE_TYPE;
			}
		});
		return tree;
	};
	return () => transform;
}

export type ScienceConversion = {
	pos: number;
	end: number;
	info: string;
	text: string;
};

/**
 * Plan conversions of preset `code_block` nodes carrying scientific
 * languages (typed or pasted mid-session) into `science-block` nodes.
 * Pure over the doc; the ProseMirror plugin in `crepe-science-block.ts`
 * only applies the plan.
 */
export function planScienceBlockConversion(document: ProseMirrorNode): ScienceConversion[] {
	const conversions: ScienceConversion[] = [];
	document.descendants((node, pos) => {
		if (node.type.name !== 'code_block') return true;
		const info = (node.attrs.params as string) ?? '';
		if (!parseScienceFence(info, node.textContent)) return true;
		conversions.push({ pos, end: pos + node.nodeSize, info, text: node.textContent });
		return false;
	});
	return conversions;
}

/**
 * Minimal structural types for the Milkdown runner slots. Intentionally
 * decoupled from `@milkdown/transformer` type layout; behavior is what
 * the tests pin.
 */
export type ScienceParserState = {
	openNode: (type: unknown, attrs?: Record<string, unknown>) => void;
	addText: (text: string) => void;
	closeNode: () => void;
};

export type ScienceSerializerState = {
	addNode: (type: string, children?: unknown, value?: string, data?: Record<string, unknown>) => void;
};

/** Milkdown parseMarkdown runner: retagged fence to typed node. */
export function runScienceBlockParse(
	state: ScienceParserState,
	node: { lang?: string | null; value?: string },
	type: unknown,
): void {
	state.openNode(type, { info: node.lang ?? '' });
	if (node.value) state.addText(node.value);
	state.closeNode();
}

/** Milkdown toMarkdown runner: typed node back to a plain fence. */
export function runScienceBlockSerialize(
	state: ScienceSerializerState,
	node: { attrs: { info?: unknown }; textContent: string },
): void {
	state.addNode('code', undefined, node.textContent, { lang: (node.attrs.info as string) ?? '' });
}
