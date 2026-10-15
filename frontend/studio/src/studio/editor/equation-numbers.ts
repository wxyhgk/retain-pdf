import type { Node as ProseMirrorNode } from '@milkdown/prose/model';
import { Plugin, PluginKey, type EditorState } from '@milkdown/prose/state';
import { Decoration, DecorationSet } from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';

import { numberEquations, type EquationLabel } from '../../science/rendering/equations.mjs';
import { isFormulaBlock } from './formula-block.ts';

/**
 * Equation numbers in the editor, as the blog gives them (`equations.mjs`):
 * every formula block in order, `\label` naming, `\eqref` showing them.
 * Each formula block gets a node decoration holding its source with its
 * number; an inline formula that refers to a label gets one holding what
 * the labels say. Both are plain strings, so a view redraws only when its
 * own number or references change.
 */

type EquationState = { labels: Map<string, EquationLabel>; decorations: DecorationSet };

const equationKey = new PluginKey<EquationState>('equation-numbers');
const REFERENCES = /\\(?:eq)?ref\s*\{/u;

/** What the article's labels stand for now. */
export function equationLabels(state: EditorState): Map<string, EquationLabel> {
	return equationKey.getState(state)?.labels ?? new Map();
}

/** A formula block's source with its number, from its decorations; the block's own text without them. */
export function numberedSource(node: ProseMirrorNode, decorations: readonly Decoration[]): string {
	for (const decoration of decorations) {
		const source = (decoration.spec as { equation?: string }).equation;
		if (source !== undefined) return source;
	}
	return node.textContent;
}

/** What the references a formula shows stand for, as one string to compare. */
export function referencesKey(decorations: readonly Decoration[]): string {
	for (const decoration of decorations) {
		const references = (decoration.spec as { references?: string }).references;
		if (references !== undefined) return references;
	}
	return '';
}

function number(doc: ProseMirrorNode): EquationState {
	const blocks: { pos: number; node: ProseMirrorNode }[] = [];
	const referring: { pos: number; node: ProseMirrorNode }[] = [];
	doc.descendants((node, pos) => {
		if (node.type.name === 'code_block') {
			if (isFormulaBlock(node)) blocks.push({ pos, node });
			return false;
		}
		if (node.type.name === 'math_inline' && REFERENCES.test(String(node.attrs.value ?? ''))) referring.push({ pos, node });
		return true;
	});
	const { equations, labels } = numberEquations(blocks.map((block) => block.node.textContent));
	const references = [...labels].map(([key, label]) => `${key}=${label.tag}`).join('\n');
	const decorations = [
		...blocks.map(({ pos, node }, index) =>
			Decoration.node(pos, pos + node.nodeSize, {}, {
				equation: equations[index]!.source,
				references: REFERENCES.test(node.textContent) ? references : '',
			}),
		),
		...referring.map(({ pos, node }) => Decoration.node(pos, pos + node.nodeSize, {}, { references })),
	];
	return { labels, decorations: DecorationSet.create(doc, decorations) };
}

export const equationNumbers = $prose(
	() =>
		new Plugin<EquationState>({
			key: equationKey,
			state: {
				init: (_config, state) => number(state.doc),
				apply: (tr, value) => (tr.docChanged ? number(tr.doc) : value),
			},
			props: {
				decorations: (state) => equationKey.getState(state)?.decorations,
			},
		}),
);
