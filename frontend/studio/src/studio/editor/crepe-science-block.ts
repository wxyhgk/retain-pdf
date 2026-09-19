import { $node, $prose, $remark, $view } from '@milkdown/utils';
import { Plugin } from '@milkdown/prose/state';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { EditorView, NodeView } from 'prosemirror-view';

import { createSciencePreview } from '../../science/browser/science-renderer.ts';
import {
	SCIENCE_FENCE_TYPE,
	parseScienceFence,
	planScienceBlockConversion,
	runScienceBlockParse,
	runScienceBlockSerialize,
	scienceRetag,
} from './science-block.ts';

/**
 * Science fenced-code blocks as a first-class Crepe node.
 * Thin Milkdown glue over `./science-block.ts`, which owns recognition,
 * byte fidelity and conversion planning (all Node-tested there).
 *
 * Two creation paths, both deterministic:
 * - loaded/pasted Markdown: `scienceBlockRemark` retags scientific fences
 *   before Milkdown's generic `code` rule can claim them;
 * - typed mid-session: `scienceBlockSync` converts preset `code_block`
 *   nodes carrying scientific languages right after the transaction.
 * Either way `getMarkdown()` emits a plain fence via `toMarkdown`.
 */
export const scienceBlockSchema = $node(SCIENCE_FENCE_TYPE, () => ({
	content: 'text*',
	group: 'block',
	code: true,
	defining: true,
	marks: '',
	attrs: { info: { default: '' } },
	parseDOM: [
		{
			tag: 'pre[data-science-block]',
			preserveWhitespace: 'full',
			getAttrs: (dom: HTMLElement) => ({ info: dom.getAttribute('data-language') ?? '' }),
		},
	],
	toDOM: (node: ProseMirrorNode) => [
		'pre',
		{ 'data-science-block': '', 'data-language': node.attrs.info as string },
		['code', 0],
	],
	parseMarkdown: {
		match: (node) => node.type === SCIENCE_FENCE_TYPE,
		runner: (state, node, type) => runScienceBlockParse(state, node, type),
	},
	toMarkdown: {
		match: (node) => node.type.name === SCIENCE_FENCE_TYPE,
		runner: (state, node) => runScienceBlockSerialize(state, node),
	},
}));

const PREVIEW_DEBOUNCE_MS = 350;

export const scienceBlockView = $view(scienceBlockSchema.node, () => {
	return (initial: ProseMirrorNode, _view: EditorView): NodeView => {
		const dom = document.createElement('div');
		dom.className = 'science-block';
		const header = document.createElement('div');
		header.className = 'science-block-header';
		const preview = document.createElement('div');
		preview.className = 'science-block-preview';
		const source = document.createElement('div');
		source.className = 'science-block-source';
		dom.append(header, preview, source);

		let timer: ReturnType<typeof setTimeout> | undefined;
		const render = (current: ProseMirrorNode) => {
			const descriptor = parseScienceFence(String(current.attrs.info ?? ''), current.textContent);
			header.textContent = descriptor ? `science · ${descriptor.block?.language ?? ''}` : 'science';
			preview.replaceChildren();
			if (!descriptor || !descriptor.block) return;
			const element = createSciencePreview(descriptor.block.language, descriptor.source);
			if (element) preview.append(element);
		};
		render(initial);

		return {
			dom,
			contentDOM: source,
			update: (updated: ProseMirrorNode) => {
				if (updated.type.name !== SCIENCE_FENCE_TYPE) return false;
				clearTimeout(timer);
				timer = setTimeout(() => render(updated), PREVIEW_DEBOUNCE_MS);
				return true;
			},
			destroy: () => clearTimeout(timer),
		};
	};
});

export const scienceBlockRemark = $remark('science-block-retag', () => scienceRetag());

export const scienceBlockSync = $prose(
	() =>
		new Plugin({
			appendTransaction(_transactions, _oldState, state) {
				const scienceType = state.schema.nodes[SCIENCE_FENCE_TYPE];
				if (!scienceType) return null;
				const conversions = planScienceBlockConversion(state.doc);
				if (!conversions.length) return null;
				const first = conversions[0];
				return state.tr.replaceWith(
					first.pos,
					first.end,
					scienceType.create({ info: first.info }, state.schema.text(first.text)),
				);
			},
		}),
);

/** Register all four in `mountEditor` via `crepe.editor.use(...)`. */
export const scienceBlockPlugins = [scienceBlockRemark, scienceBlockSchema, scienceBlockView, scienceBlockSync];
