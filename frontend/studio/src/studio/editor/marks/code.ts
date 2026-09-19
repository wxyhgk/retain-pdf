import type { MarkSpec, Node as ProseMirrorNode } from 'prosemirror-model';
import type { ParseSpec } from 'prosemirror-markdown';

/**
 * code mark, owned copy of the prosemirror-markdown 1.13.5 default.
 * Behavior is intentionally identical today; customize here instead of
 * relying on the library default so each mark type has one home.
 */
export const codeMarkSpec: MarkSpec = {
	code: true,
	parseDOM: [{ tag: 'code' }],
	toDOM: () => ['code'],
};

/** Markdown code_inline token mapping. Mirrors the library default exactly. */
export const codeInlineParseSpec: ParseSpec = {
	mark: 'code',
	noCloseToken: true,
};

/** Copied default: grows backtick runs around code spans holding backticks. */
export function backticksFor(node: ProseMirrorNode, side: number): string {
	const ticks = /`+/g;
	let match: RegExpExecArray | null;
	let length = 0;
	if (node.isText) {
		while ((match = ticks.exec(node.text ?? '')) !== null) {
			length = Math.max(length, match[0].length);
		}
	}
	let result = length > 0 && side > 0 ? ' `' : '`';
	for (let i = 0; i < length; i += 1) {
		result += '`';
	}
	if (length > 0 && side < 0) result += ' ';
	return result;
}

/** Code mark serializer. Mirrors the library default exactly. */
export const codeMarkSerializer = {
	open: (
		_state: unknown,
		_mark: unknown,
		parent: ProseMirrorNode,
		index: number,
	) => backticksFor(parent.child(index), -1),
	close: (
		_state: unknown,
		_mark: unknown,
		parent: ProseMirrorNode,
		index: number,
	) => backticksFor(parent.child(index - 1), 1),
	escape: false,
};
