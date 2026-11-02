import { visit } from 'unist-util-visit';

/**
 * A passage quoted from a book in RetainPDF (the Studio's 读书笔记): the note's own paragraphs, a link to where it is
 * before them (`[书 · 第 12 页](retainpdf:<job>/<block>?page=12)`). The Studio shows the link as RetainPDF's mark; a
 * page has no RetainPDF to open, so the link becomes where the passage is from, said at the end of its paragraph
 * (`<cite>`), or where it stood when the paragraph holds nothing else.
 */

const SCHEME = 'retainpdf:';
const textOf = (node) => (node.type === 'text' || node.type === 'inlineCode' ? node.value : (node.children ?? []).map(textOf).join(''));
const cite = (words) => ({ type: 'retainpdfSource', data: { hName: 'cite', hProperties: { className: ['retainpdf-source'] } }, children: [{ type: 'text', value: words }] });

export default function remarkRetainpdfSources() {
	return (tree) => {
		visit(tree, 'paragraph', (paragraph) => {
			const sources = paragraph.children.filter((child) => child.type === 'link' && child.url.startsWith(SCHEME));
			if (!sources.length) return;
			const rest = paragraph.children.filter((child) => !sources.includes(child));
			// The space the link left before the text.
			if (rest[0]?.type === 'text') rest[0] = { ...rest[0], value: rest[0].value.replace(/^\s+/u, '') };
			const said = sources.map((link) => cite(textOf(link)));
			paragraph.children = rest.some((child) => child.type !== 'text' || child.value.trim()) ? [...rest, { type: 'text', value: ' ' }, ...said] : said;
		});
	};
}
