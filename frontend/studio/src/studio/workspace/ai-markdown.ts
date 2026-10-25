import rehypeStringify from 'rehype-stringify';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { articleParser } from '@blog/markdown/syntax.mjs';
import { renderMathHtml } from '@blog/science/rendering/math.ts';

/**
 * What an AI says in the AI panel, drawn: its Markdown read as articles are (GFM, formulas), formulas drawn with
 * KaTeX as in the editor. Raw HTML in it is dropped, and links go only to the web or within the page, opened
 * elsewhere: it is text from a model, which may have read anything.
 */

const toHtml = unified().use(remarkRehype).use(rehypeStringify).freeze();

type Tree = ReturnType<typeof articleParser.parse>;
type TopNode = Tree['children'][number];

/**
 * `blocks`: each block of it (a paragraph, a list, a formula, a code block, a table…) in its own `.ai-block`, with
 * the Markdown it was written as in `data-markdown`, to be put in an article as it is.
 */
export function renderAiMarkdown(markdown: string, { blocks = false }: { blocks?: boolean } = {}): DocumentFragment {
	const tree = articleParser.runSync(articleParser.parse(markdown)) as Tree;
	if (!blocks) return drawn(tree);
	const fragment = document.createDocumentFragment();
	// Link definitions drawn with each block, as its links may need them.
	const definitions = tree.children.filter((node) => node.type === 'definition');
	for (const node of tree.children) {
		if (node.type === 'definition') continue;
		const block = document.createElement('div');
		block.className = 'ai-block';
		const source = sourceOf(markdown, node);
		if (source) block.dataset.markdown = source;
		block.append(drawn({ ...tree, children: [node, ...definitions] }));
		fragment.append(block);
	}
	return fragment;
}

function sourceOf(markdown: string, node: TopNode): string {
	const { start, end } = node.position ?? {};
	return start?.offset === undefined || end?.offset === undefined ? '' : markdown.slice(start.offset, end.offset).trim();
}

function drawn(tree: Tree): DocumentFragment {
	const template = document.createElement('template');
	template.innerHTML = toHtml.stringify(toHtml.runSync(tree as never) as never);
	const fragment = template.content;
	for (const link of fragment.querySelectorAll('a')) {
		const href = link.getAttribute('href') ?? '';
		if (/^https?:\/\//iu.test(href)) {
			link.target = '_blank';
			link.rel = 'noopener noreferrer';
		} else if (!href.startsWith('#')) {
			link.removeAttribute('href');
		}
	}
	for (const image of fragment.querySelectorAll('img')) {
		if (!/^https?:\/\//iu.test(image.getAttribute('src') ?? '')) image.replaceWith(document.createTextNode(image.alt ? `[${image.alt}]` : ''));
	}
	for (const code of fragment.querySelectorAll('code.language-math')) {
		const display = code.classList.contains('math-display');
		const drawn = renderMathHtml(code.textContent ?? '', display);
		const holder = document.createElement(display ? 'div' : 'span');
		holder.className = display ? 'ai-math-display' : 'ai-math';
		if (drawn.error) {
			holder.textContent = code.textContent ?? '';
			holder.title = drawn.error;
		} else {
			holder.innerHTML = drawn.html;
		}
		(display && code.parentElement?.tagName === 'PRE' ? code.parentElement : code).replaceWith(holder);
	}
	return fragment;
}
