import type { Node as ProseMirrorNode, NodeSpec } from 'prosemirror-model';
import type { MarkdownSerializerState, ParseSpec } from 'prosemirror-markdown';

/**
 * hard_break, owned copy of the prosemirror-markdown 1.13.5 default.
 * Behavior is intentionally identical today; customize here instead of
 * relying on the library default so each block type has one home.
 */
export const hardBreakSpec: NodeSpec = {
	inline: true,
	group: 'inline',
	selectable: false,
	parseDOM: [{ tag: 'br' }],
	toDOM: () => ['br'],
};

/** Markdown hardbreak token mapping. Mirrors the library default exactly. */
export const hardBreakParseSpec: ParseSpec = {
	node: 'hard_break',
};

/**
 * Hard break serializer. Mirrors the library default exactly: a trailing
 * break with no following sibling renders as nothing.
 */
export function serializeHardBreak(
	state: MarkdownSerializerState,
	node: ProseMirrorNode,
	parent: ProseMirrorNode,
	index: number,
): void {
	for (let cursor = index + 1; cursor < parent.childCount; cursor += 1) {
		if (parent.child(cursor).type !== node.type) {
			state.write('\\\n');
			return;
		}
	}
}
