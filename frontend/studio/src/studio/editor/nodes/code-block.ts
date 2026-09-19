import type MarkdownIt from 'markdown-it';
import type { Node as ProseMirrorNode, NodeSpec } from 'prosemirror-model';
import type { MarkdownSerializerState, ParseSpec } from 'prosemirror-markdown';

/**
 * code_block, owned copy of the prosemirror-markdown 1.13.5 default.
 * Behavior is intentionally identical today; customize here instead of
 * relying on the library default so each block type has one home.
 */
export const codeBlockSpec: NodeSpec = {
	content: 'text*',
	group: 'block',
	code: true,
	defining: true,
	marks: '',
	attrs: { params: { default: '' } },
	parseDOM: [
		{
			tag: 'pre',
			preserveWhitespace: 'full',
			getAttrs: (dom: HTMLElement) => ({ params: dom.getAttribute('data-params') || '' }),
		},
	],
	toDOM: (node: ProseMirrorNode) => [
		'pre',
		node.attrs.params ? { 'data-params': node.attrs.params as string } : {},
		['code', 0],
	],
};

/** Markdown indented-code token mapping. Mirrors the library default exactly. */
export const codeBlockIndentedParseSpec: ParseSpec = {
	block: 'code_block',
	noCloseToken: true,
};

/** Markdown fence token mapping. Mirrors the library default exactly. */
export const codeBlockFenceParseSpec: ParseSpec = {
	block: 'code_block',
	getAttrs: (tok: MarkdownIt.Token) => ({ params: tok.info || '' }),
	noCloseToken: true,
};

/** Fenced serializer. Mirrors the library default, including fence lengthening. */
export function serializeCodeBlock(state: MarkdownSerializerState, node: ProseMirrorNode): void {
	const backticks = node.textContent.match(/`{3,}/gm);
	const fence = backticks ? `${backticks.sort().slice(-1)[0]}\`` : '```';
	state.write(`${fence}${(node.attrs.params as string) || ''}\n`);
	state.text(node.textContent, false);
	state.write('\n');
	state.write(fence);
	state.closeBlock(node);
}

/**
 * Fenced languages treated as scientific data blocks across Studio.
 * Single source of truth; previously duplicated inline in the Crepe setup.
 */
export const SCIENCE_LANGUAGES: readonly string[] = [
	'smiles',
	'sdf',
	'mol',
	'xyz',
	'gjf',
	'com',
	'pdb',
	'mol2',
	'cif',
	'cube',
	'sdf-2d',
	'mol-2d',
	'sdf-3d',
	'mol-3d',
	'xyz-3d',
	'pdb-3d',
	'mol2-3d',
	'cif-3d',
	'cube-3d',
];

export function isScienceLanguage(language: string): boolean {
	return SCIENCE_LANGUAGES.includes(language);
}

/** Trims fence info strings; matching against aliases stays exact. */
export function normalizeInfoString(info: string): string {
	return info.trim();
}
