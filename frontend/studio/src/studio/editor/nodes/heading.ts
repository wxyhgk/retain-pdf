import type MarkdownIt from 'markdown-it';
import type { Node as ProseMirrorNode, NodeSpec } from 'prosemirror-model';
import type { MarkdownSerializerState, ParseSpec } from 'prosemirror-markdown';

/**
 * heading, owned copy of the prosemirror-markdown 1.13.5 default.
 * Behavior is intentionally identical today; customize here instead of
 * relying on the library default so each block type has one home.
 *
 * TODO(TOC): title nodes will need a stable id/slug attr for the table
 * of contents. Add it here (spec + getAttrs + serializer) when that
 * work starts; keep the default output untouched until then.
 */
export const headingSpec: NodeSpec = {
	attrs: { level: { default: 1 } },
	content: '(text | image)*',
	group: 'block',
	defining: true,
	parseDOM: [
		{ tag: 'h1', attrs: { level: 1 } },
		{ tag: 'h2', attrs: { level: 2 } },
		{ tag: 'h3', attrs: { level: 3 } },
		{ tag: 'h4', attrs: { level: 4 } },
		{ tag: 'h5', attrs: { level: 5 } },
		{ tag: 'h6', attrs: { level: 6 } },
	],
	toDOM: (node: ProseMirrorNode) => [`h${node.attrs.level as number}`, 0],
};

/** Markdown heading token mapping. Mirrors the library default exactly. */
export const headingParseSpec: ParseSpec = {
	block: 'heading',
	getAttrs: (tok: MarkdownIt.Token) => ({ level: Number(tok.tag.slice(1)) }),
};

/** Heading serializer. Mirrors the library default exactly. */
export function serializeHeading(state: MarkdownSerializerState, node: ProseMirrorNode): void {
	state.write(`${state.repeat('#', node.attrs.level as number)} `);
	state.renderInline(node, false);
	state.closeBlock(node);
}
