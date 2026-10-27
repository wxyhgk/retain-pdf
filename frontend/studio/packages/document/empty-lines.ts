/** A line that is empty, or holds only the `<br />` the editor writes for an empty paragraph. */
const EMPTY_LINE = /^\s*(?:<br\s*\/?>)?\s*$/iu;

/**
 * The editor's Markdown without the empty paragraphs it ends with. The
 * editor writes an empty paragraph as `<br />` unless it is the very last
 * block, so a blank line or two left at the end (a click below the last
 * block, an Enter too many) would end the article with `<br />`; they mean
 * nothing there. Empty paragraphs between blocks are kept: a blank line
 * written on purpose.
 */
export function withoutTrailingEmptyLines(markdown: string): string {
	const lines = markdown.split('\n');
	let end = lines.length;
	while (end > 0 && EMPTY_LINE.test(lines[end - 1]!)) end -= 1;
	if (end === lines.length) return markdown;
	return end ? `${lines.slice(0, end).join('\n')}\n` : '';
}
