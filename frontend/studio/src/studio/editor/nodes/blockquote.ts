import type { Node as ProseMirrorNode, NodeSpec } from 'prosemirror-model';
import type { MarkdownSerializerState, ParseSpec } from 'prosemirror-markdown';

/**
 * blockquote, owned copy of the prosemirror-markdown 1.13.5 default.
 * Behavior is intentionally identical today; customize here instead of
 * relying on the library default so each block type has one home.
 */
export const blockquoteSpec: NodeSpec = {
	content: 'block+',
	group: 'block',
	parseDOM: [{ tag: 'blockquote' }],
	toDOM: () => ['blockquote', 0],
};

/** Markdown blockquote token mapping. Mirrors the library default exactly. */
export const blockquoteParseSpec: ParseSpec = {
	block: 'blockquote',
};

/** Blockquote serializer. Mirrors the library default exactly. */
export function serializeBlockquote(state: MarkdownSerializerState, node: ProseMirrorNode): void {
	state.wrapBlock('> ', null, node, () => state.renderContent(node));
}
