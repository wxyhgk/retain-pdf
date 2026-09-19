import type MarkdownIt from 'markdown-it';
import type { Node as ProseMirrorNode, NodeSpec } from 'prosemirror-model';
import type { MarkdownSerializerState, ParseSpec } from 'prosemirror-markdown';

/**
 * List family, owned copies of the prosemirror-markdown 1.13.5 defaults.
 * The three specs stay in one module because they share list machinery
 * (tight detection, item rendering). Behavior is intentionally identical
 * today; customize here instead of relying on the library default.
 */
export const bulletListSpec: NodeSpec = {
	content: 'list_item+',
	group: 'block',
	attrs: { tight: { default: false } },
	parseDOM: [
		{
			tag: 'ul',
			getAttrs: (dom: HTMLElement) => ({ tight: dom.hasAttribute('data-tight') }),
		},
	],
	toDOM: (node: ProseMirrorNode) => [
		'ul',
		{ 'data-tight': (node.attrs.tight as boolean) ? 'true' : null },
		0,
	],
};

export const orderedListSpec: NodeSpec = {
	content: 'list_item+',
	group: 'block',
	attrs: { order: { default: 1 }, tight: { default: false } },
	parseDOM: [
		{
			tag: 'ol',
			getAttrs: (dom: HTMLElement) => ({
				order: dom.hasAttribute('start') ? Number(dom.getAttribute('start')) : 1,
				tight: dom.hasAttribute('data-tight'),
			}),
		},
	],
	toDOM: (node: ProseMirrorNode) => [
		'ol',
		{
			start: (node.attrs.order as number) === 1 ? null : (node.attrs.order as number),
			'data-tight': (node.attrs.tight as boolean) ? 'true' : null,
		},
		0,
	],
};

export const listItemSpec: NodeSpec = {
	content: 'block+',
	defining: true,
	parseDOM: [{ tag: 'li' }],
	toDOM: () => ['li', 0],
};

/** Copied default: a list is tight when no blank line separates items. */
export function isListTight(tokens: MarkdownIt.Token[], index: number): boolean {
	let cursor = index;
	while (++cursor < tokens.length) {
		if (tokens[cursor].type !== 'list_item_open') return tokens[cursor].hidden;
	}
	return false;
}

/** Markdown list token mappings. Mirror the library defaults exactly. */
export const bulletListParseSpec: ParseSpec = {
	block: 'bullet_list',
	getAttrs: (_tok: MarkdownIt.Token, tokens: MarkdownIt.Token[], index: number) => ({
		tight: isListTight(tokens, index),
	}),
};

export const orderedListParseSpec: ParseSpec = {
	block: 'ordered_list',
	getAttrs: (tok: MarkdownIt.Token, tokens: MarkdownIt.Token[], index: number) => ({
		order: Number(tok.attrGet('start')) || 1,
		tight: isListTight(tokens, index),
	}),
};

export const listItemParseSpec: ParseSpec = {
	block: 'list_item',
};

/** List serializers. Mirror the library defaults exactly. */
export function serializeBulletList(state: MarkdownSerializerState, node: ProseMirrorNode): void {
	state.renderList(node, '  ', () => `${(node.attrs.bullet as string) || '*'} `);
}

export function serializeOrderedList(state: MarkdownSerializerState, node: ProseMirrorNode): void {
	const start = (node.attrs.order as number) ?? 1;
	const maxWidth = String(start + node.childCount - 1).length;
	const space = state.repeat(' ', maxWidth + 2);
	state.renderList(node, space, (itemIndex: number) => {
		const numeral = String(start + itemIndex);
		return `${state.repeat(' ', maxWidth - numeral.length)}${numeral}. `;
	});
}

export function serializeListItem(state: MarkdownSerializerState, node: ProseMirrorNode): void {
	state.renderContent(node);
}
