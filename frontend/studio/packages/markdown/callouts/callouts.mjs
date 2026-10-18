/**
 * Callouts, as GitHub writes them (its "alerts"), shown as Notion shows a
 * callout: a tinted box with an icon. The blog (`remark-callouts.mjs`) and
 * the Studio (`callout-block.ts`) read and draw them by these rules.
 *
 *     > [!TIP]
 *     > 先用小基组跑通，再换大基组。
 */

/** Each kind of callout: what the icon is and what it means. */
export const CALLOUT_KINDS = Object.freeze({
	note: { icon: 'ℹ️', label: '说明' },
	tip: { icon: '💡', label: '提示' },
	important: { icon: '❗', label: '重要' },
	warning: { icon: '⚠️', label: '警告' },
	caution: { icon: '🛑', label: '小心' },
});

/** The kinds in the order clicking the icon goes through them. */
export const CALLOUT_ORDER = Object.freeze(Object.keys(CALLOUT_KINDS));

const MARKER = /^\[!(note|tip|important|warning|caution)\][ \t]*(?:\r?\n|$)/iu;

/**
 * The kind a blockquote's first text names (`[!TIP]` on its own line) and
 * what follows it on the next lines; null when it is no callout.
 * @param {string} text
 * @returns {{ kind: keyof typeof CALLOUT_KINDS; rest: string } | null}
 */
export function calloutMarker(text) {
	const match = MARKER.exec(text);
	if (!match) return null;
	return { kind: /** @type {keyof typeof CALLOUT_KINDS} */ (match[1].toLowerCase()), rest: text.slice(match[0].length) };
}

/**
 * Turns `blockquote` into a callout, if it is one: the marker taken out of
 * its first paragraph (and that paragraph too, if nothing else was in it).
 * Returns the kind, or null and leaves it be.
 * @param {{ children: Array<{ type: string; children?: Array<{ type: string; value?: string }> }> }} blockquote
 */
export function takeCalloutMarker(blockquote) {
	const first = blockquote.children[0];
	const text = first?.type === 'paragraph' ? first.children?.[0] : undefined;
	if (!first || text?.type !== 'text') return null;
	const marker = calloutMarker(text.value ?? '');
	if (!marker) return null;
	if (marker.rest) text.value = marker.rest;
	else first.children?.shift();
	// A soft break right after the marker starts the next line: it goes with the marker.
	if (first.children?.[0]?.type === 'break') first.children.shift();
	if (!first.children?.length) blockquote.children.shift();
	return marker.kind;
}
