import type MarkdownIt from 'markdown-it';
import type { Node as ProseMirrorNode, NodeSpec } from 'prosemirror-model';
import type { MarkdownSerializerState, ParseSpec } from 'prosemirror-markdown';

/**
 * image, owned copy of the prosemirror-markdown 1.13.5 default.
 * Behavior is intentionally identical today; customize here instead of
 * relying on the library default so each block type has one home.
 */
export const imageSpec: NodeSpec = {
	inline: true,
	attrs: {
		src: {},
		alt: { default: null },
		title: { default: null },
	},
	group: 'inline',
	draggable: true,
	parseDOM: [
		{
			tag: 'img[src]',
			getAttrs: (dom: HTMLElement) => ({
				src: dom.getAttribute('src'),
				title: dom.getAttribute('title'),
				alt: dom.getAttribute('alt'),
			}),
		},
	],
	toDOM: (node: ProseMirrorNode) => ['img', node.attrs],
};

/** Markdown image token mapping. Mirrors the library default exactly. */
export const imageParseSpec: ParseSpec = {
	node: 'image',
	getAttrs: (tok: MarkdownIt.Token) => ({
		src: tok.attrGet('src'),
		title: tok.attrGet('title') || null,
		alt: (tok.children?.[0]?.content) || null,
	}),
};

/** Image serializer. Mirrors the library default exactly. */
export function serializeImage(state: MarkdownSerializerState, node: ProseMirrorNode): void {
	const title = node.attrs.title as string | null;
	state.write(
		`![${state.esc((node.attrs.alt as string) || '')}](${(node.attrs.src as string).replace(/[()]/g, '\\$&')}${
			title ? ` "${title.replace(/"/g, '\\"')}"` : ''
		})`,
	);
}
