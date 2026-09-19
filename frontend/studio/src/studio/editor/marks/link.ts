import type MarkdownIt from 'markdown-it';
import type { Mark as ProseMirrorMark, MarkSpec, Node as ProseMirrorNode } from 'prosemirror-model';
import type { MarkdownSerializerState, ParseSpec } from 'prosemirror-markdown';

/**
 * link mark, owned copy of the prosemirror-markdown 1.13.5 default.
 * Behavior is intentionally identical today; customize here instead of
 * relying on the library default so each mark type has one home.
 */
export const linkSpec: MarkSpec = {
	attrs: {
		href: {},
		title: { default: null },
	},
	inclusive: false,
	parseDOM: [
		{
			tag: 'a[href]',
			getAttrs: (dom: HTMLElement) => ({
				href: dom.getAttribute('href'),
				title: dom.getAttribute('title'),
			}),
		},
	],
	toDOM: (mark: ProseMirrorMark) => ['a', mark.attrs],
};

/** Markdown link token mapping. Mirrors the library default exactly. */
export const linkParseSpec: ParseSpec = {
	mark: 'link',
	getAttrs: (tok: MarkdownIt.Token) => ({
		href: tok.attrGet('href'),
		title: tok.attrGet('title') || null,
	}),
};

/** Copied default: detects bare URLs eligible for autolink output. */
export function isPlainUrl(link: ProseMirrorMark, parent: ProseMirrorNode, index: number): boolean {
	const href = link.attrs.href as string;
	const title = link.attrs.title as string | null;
	if (title || !/^\w+:/.test(href)) return false;
	const content = parent.child(index);
	if (!content.isText || content.text !== href) return false;
	if (content.marks[content.marks.length - 1] !== link) return false;
	return index === parent.childCount - 1 || !link.isInSet(parent.child(index + 1).marks);
}
/** Link mark serializer. Mirrors the library default exactly. */
export const linkMarkSerializer = {
	open: (state: MarkdownSerializerState, mark: ProseMirrorMark, parent: ProseMirrorNode, index: number) => {
		state.inAutolink = isPlainUrl(mark, parent, index);
		return state.inAutolink ? '<' : '[';
	},
	close: (state: MarkdownSerializerState, mark: ProseMirrorMark) => {
		const inAutolink = state.inAutolink;
		state.inAutolink = undefined;
		if (inAutolink) return '>';
		const href = mark.attrs.href as string;
		const title = mark.attrs.title as string | null;
		return `](${href.replace(/[()"]/g, '\\$&')}${title ? ` "${title.replace(/"/g, '\\"')}"` : ''})`;
	},
	mixable: true,
};
