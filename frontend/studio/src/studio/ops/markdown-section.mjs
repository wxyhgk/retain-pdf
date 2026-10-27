import { parseArticle } from '@blog/markdown/syntax.mjs';

/** A node's words. */
function words(node) {
	if (typeof node.value === 'string') return node.value;
	return (node.children ?? []).map(words).join('');
}

/**
 * The section of `markdown` a heading begins (one at the top level, not in a
 * list or quote, whose words are `heading`, the first so): from it to the next
 * heading as high or higher, or the end. `from`, `to`: where it is in
 * `markdown`; `text`: what follows the heading in it.
 * @param {string} markdown
 * @param {string} heading
 * @returns {{ from: number, to: number, title: string, text: string } | null}
 */
export function markdownSection(markdown, heading) {
	const wanted = heading.trim();
	const blocks = parseArticle(markdown).children;
	const index = blocks.findIndex((node) => node.type === 'heading' && words(node).trim() === wanted);
	if (index < 0) return null;
	const start = blocks[index];
	const next = blocks.slice(index + 1).find((node) => node.type === 'heading' && node.depth <= start.depth);
	const from = start.position.start.offset;
	const to = next ? next.position.start.offset : markdown.length;
	return { from, to, title: wanted, text: markdown.slice(start.position.end.offset, to).trim() };
}

/**
 * The headings of `markdown` at its top level (not in a list or quote), in order: how deep each is, its words, the
 * line it is on (from 1) and where it is (`offset`).
 * @param {string} markdown
 * @returns {Array<{ depth: number, title: string, line: number, offset: number }>}
 */
export function markdownOutline(markdown) {
	return parseArticle(markdown)
		.children.filter((node) => node.type === 'heading')
		.map((node) => ({ depth: node.depth, title: words(node).trim(), line: node.position.start.line, offset: node.position.start.offset }));
}
