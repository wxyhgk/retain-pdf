import { t } from '@blog/i18n/index.mjs';

/**
 * A page made under another, linked from it where it belongs (as Notion's page block): a line of the page above that is
 * only a link to it. Where: after the paragraph a line of it (`after`, words of that line) is in, or at the end of the
 * section a heading of it (`after`, its words, with or without its #s) begins; given nothing, at the end.
 */

/** A page's link as a line of its own: what the editor shows as a page block. */
export function pageLinkLine(slug, title) {
	return `[${String(title).replace(/[[\]\\]/gu, '\\$&')}](/blog/${slug}/)`;
}

/** Each line's heading level (0: none), the lines in code blocks and formulas none. */
function headingLevels(lines) {
	let fence = '';
	return lines.map((line) => {
		const opening = /^\s{0,3}(`{3,}|~{3,}|\$\$)/u.exec(line)?.[1];
		if (fence) {
			if (opening && opening[0] === fence[0] && opening.length >= fence.length) fence = '';
			return 0;
		}
		if (opening) {
			fence = opening;
			return 0;
		}
		return /^(#{1,6})\s/u.exec(line)?.[1].length ?? 0;
	});
}

/**
 * The body (the text after the properties) with `line` put in it as a paragraph of its own, `after` as said above.
 * Words of `after` found nowhere: an error, said to the AI (it is to give words of the page above).
 * @param {string} body
 * @param {string} line
 * @param {string} [after]
 */
export function withLinkAt(body, line, after = '') {
	// The blank lines it begins with (after the properties) kept as they are.
	const lead = /^\n*/u.exec(body)[0];
	const text = body.slice(lead.length).replace(/\s*$/u, '');
	const lines = text ? text.split('\n') : [];
	let at = lines.length;
	const wanted = after.trim();
	if (wanted) {
		const levels = headingLevels(lines);
		const named = wanted.replace(/^#+\s*/u, '');
		const heading = lines.findIndex((text, index) => levels[index] > 0 && text.replace(/^#+\s*/u, '').trim() === named);
		if (heading >= 0) {
			// The end of its section: the next heading of its level or above.
			const next = levels.findIndex((level, index) => index > heading && level > 0 && level <= levels[heading]);
			at = next < 0 ? lines.length : next;
		} else {
			const found = lines.findIndex((text) => text.includes(wanted));
			if (found < 0) throw new Error(t('上级页面里没有「{after}」这句或这个标题：link_after 要写上级页面里有的一句话或标题', { after: wanted }));
			// The end of its paragraph (or list): the next blank line.
			const blank = lines.findIndex((text, index) => index > found && !text.trim());
			at = blank < 0 ? lines.length : blank;
		}
		while (at > 0 && !lines[at - 1].trim()) at -= 1;
	}
	const before = lines.slice(0, at);
	const rest = lines.slice(at);
	while (rest.length && !rest[0].trim()) rest.shift();
	return `${lead}${[...before, ...(before.length ? [''] : []), line, ...(rest.length ? ['', ...rest] : [])].join('\n')}\n`;
}
