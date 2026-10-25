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

export function renderAiMarkdown(markdown: string): DocumentFragment {
	const tree = articleParser.runSync(articleParser.parse(markdown));
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
