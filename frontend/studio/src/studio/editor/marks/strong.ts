import type { Mark, MarkSpec } from 'prosemirror-model';
import type { ParseSpec } from 'prosemirror-markdown';

/**
 * strong mark, owned copy of the prosemirror-markdown 1.13.5 default.
 * Behavior is intentionally identical today; customize here instead of
 * relying on the library default so each mark type has one home.
 */
export const strongSpec: MarkSpec = {
	parseDOM: [
		{ tag: 'strong' },
		{ tag: 'b', getAttrs: (dom: HTMLElement) => dom.style.fontWeight !== 'normal' && null },
		{ style: 'font-weight=400', clearMark: (mark: Mark) => mark.type.name === 'strong' },
		{
			style: 'font-weight',
			getAttrs: (value: string) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null,
		},
	],
	toDOM: () => ['strong'],
};

/** Markdown strong token mapping. Mirrors the library default exactly. */
export const strongParseSpec: ParseSpec = {
	mark: 'strong',
};

/** Strong mark serializer. Mirrors the library default exactly. */
export const strongMarkSerializer = {
	open: '**',
	close: '**',
	mixable: true,
	expelEnclosingWhitespace: true,
};
