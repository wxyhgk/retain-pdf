import type { Node as ProseMirrorNode, NodeSpec } from 'prosemirror-model';
import type { MarkdownSerializerState, ParseSpec } from 'prosemirror-markdown';

/**
 * paragraph, owned copy of the prosemirror-markdown 1.13.5 default.
 * Behavior is intentionally identical today; customize here instead of
 * relying on the library default so each block type has one home.
 */
export const paragraphSpec: NodeSpec = {
	content: 'inline*',
	group: 'block',
	parseDOM: [{ tag: 'p' }],
	toDOM: () => ['p', 0],
};

/** Markdown paragraph token mapping. Mirrors the library default exactly. */
export const paragraphParseSpec: ParseSpec = {
	block: 'paragraph',
};

/** Paragraph serializer. Mirrors the library default exactly. */
export function serializeParagraph(state: MarkdownSerializerState, node: ProseMirrorNode): void {
	state.renderInline(node);
	state.closeBlock(node);
}
