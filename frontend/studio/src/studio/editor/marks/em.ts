import type { MarkSpec } from 'prosemirror-model';
import type { ParseSpec } from 'prosemirror-markdown';

/**
 * em mark, owned copy of the prosemirror-markdown 1.13.5 default.
 * Behavior is intentionally identical today; customize here instead of
 * relying on the library default so each mark type has one home.
 */
export const emSpec: MarkSpec = {
	parseDOM: [
		{ tag: 'i' },
		{ tag: 'em' },
		{ style: 'font-style=italic' },
		{ style: 'font-style=normal', clearMark: (mark) => mark.type.name === 'em' },
	],
	toDOM: () => ['em'],
};

/** Markdown em token mapping. Mirrors the library default exactly. */
export const emParseSpec: ParseSpec = {
	mark: 'em',
};

/** Em mark serializer. Mirrors the library default exactly. */
export const emMarkSerializer = {
	open: '*',
	close: '*',
	mixable: true,
	expelEnclosingWhitespace: true,
};
