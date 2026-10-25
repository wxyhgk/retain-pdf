import rehypeStringify from 'rehype-stringify';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { articleParser } from '@blog/markdown/syntax.mjs';
import { renderMathHtml } from '@blog/science/rendering/math.ts';

import { codeBlockPreview } from '../plugins';

/**
 * What an AI says in the AI panel, drawn: its Markdown read as articles are (GFM, formulas), formulas drawn with
 * KaTeX as in the editor, the plugins' blocks (an energy diagram, a molecule) as they draw them there, pictures on
 * this machine shown by their path. Raw HTML in it is dropped, and links go only to the web or within the page,
 * opened elsewhere.
 */

const toHtml = unified().use(remarkRehype).use(rehypeStringify).freeze();

/** A picture on this machine, by its path (absolute, or from blog/), as the Studio shows it. */
export function pictureUrl(path: string): string {
	return `/api/studio/conversations/picture?path=${encodeURIComponent(path)}`;
}

/** Whether a path is of a picture the panel shows. */
export const isPicture = (path: string): boolean => /\.(png|jpe?g|gif|webp|svg)$/iu.test(path);

/** A path as written in Markdown (spaces as %20), as it is on disk. */
function decoded(path: string): string {
	try {
		return decodeURI(path);
	} catch {
		return path;
	}
}

type Tree = ReturnType<typeof articleParser.parse>;
type TopNode = Tree['children'][number];

/**
 * `blocks`: each block of it (a paragraph, each item of a list, a formula, a code block, a table…) in its own
 * `.ai-block`, as the editor has them, with the Markdown it was written as in `data-markdown`, to be put in an
 * article as it is.
 */
export function renderAiMarkdown(markdown: string, { blocks = false }: { blocks?: boolean } = {}): DocumentFragment {
	const tree = articleParser.runSync(articleParser.parse(markdown)) as Tree;
	if (!blocks) return drawn(tree);
	const fragment = document.createDocumentFragment();
	// Link definitions drawn with each block, as its links may need them.
	const definitions = tree.children.filter((node) => node.type === 'definition');
	const block = (node: TopNode, className = 'ai-block'): HTMLElement => {
		const holder = document.createElement('div');
		holder.className = className;
		const source = sourceOf(markdown, node);
		if (source) holder.dataset.markdown = source;
		holder.append(drawn({ ...tree, children: [node, ...definitions] }));
		return holder;
	};
	for (const node of tree.children) {
		if (node.type === 'definition') continue;
		if (node.type !== 'list') {
			fragment.append(block(node));
			continue;
		}
		// A list, an item a block: each a list of one, numbered on from where it is (2. for the second).
		node.children.forEach((item, at) => {
			const one = { ...node, start: node.ordered ? (node.start ?? 1) + at : node.start, children: [item], position: item.position } as TopNode;
			fragment.append(block(one, `ai-block is-item${at === node.children.length - 1 ? ' is-last-item' : ''}`));
		});
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
	// A picture on this machine (a plot the AI drew: ai/work/plot.png, by its path) through the Studio.
	for (const image of fragment.querySelectorAll('img')) {
		const src = image.getAttribute('src') ?? '';
		if (/^https?:\/\//iu.test(src)) continue;
		if (/^[a-z][a-z0-9+.-]*:/iu.test(src) && !src.startsWith('file://')) image.replaceWith(document.createTextNode(image.alt ? `[${image.alt}]` : ''));
		else image.src = pictureUrl(decoded(src));
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
	// A plugin's block (```energy, ```smiles, ```widget…) drawn as the editor draws it.
	for (const code of fragment.querySelectorAll('pre > code[class*="language-"]')) {
		const language = /language-([\w+-]+)/u.exec(code.className)?.[1];
		const drawn = language ? codeBlockPreview(language, (code.textContent ?? '').replace(/\n$/u, '')) : null;
		if (!drawn) continue;
		const holder = document.createElement('div');
		holder.className = 'ai-preview';
		holder.append(drawn);
		code.parentElement!.replaceWith(holder);
	}
	return fragment;
}
