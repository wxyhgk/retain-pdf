import type { Node as ProseMirrorNode, NodeSpec } from 'prosemirror-model';
import type { MarkdownSerializerState, ParseSpec } from 'prosemirror-markdown';

/**
 * horizontal_rule, owned copy of the prosemirror-markdown 1.13.5 default.
 * Behavior is intentionally identical today; customize here instead of
 * relying on the library default so each block type has one home.
 *
 * Note: the serializer honors a `markup` attr but the spec defines none,
 * so every `***`, `---`, `___` normalizes to `---`. The document layer
 * treats a leading `---` as a frontmatter fence; these node-layer tests
 * cover Markdown mapping only.
 */
export const horizontalRuleSpec: NodeSpec = {
	group: 'block',
	parseDOM: [{ tag: 'hr' }],
	toDOM: () => ['div', ['hr']],
};

/** Markdown hr token mapping. Mirrors the library default exactly. */
export const horizontalRuleParseSpec: ParseSpec = {
	node: 'horizontal_rule',
};

/** Horizontal rule serializer. Mirrors the library default exactly. */
export function serializeHorizontalRule(state: MarkdownSerializerState, node: ProseMirrorNode): void {
	state.write((node.attrs.markup as string) || '---');
	state.closeBlock(node);
}
