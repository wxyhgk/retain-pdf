import rehypeStringify from 'rehype-stringify';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { ARTICLE_ADDRESS } from '@blog/markdown/articles/rules.mjs';
import { articleParser } from '@blog/markdown/syntax.mjs';
import { renderMathHtml } from '@blog/science/rendering/math.ts';

import { codeBlockPreview } from '../plugins';

/**
 * What an AI says in the AI panel, drawn: its Markdown read as articles are (GFM, formulas), formulas drawn with
 * KaTeX as in the editor, the plugins' blocks (an energy diagram, a molecule) as they draw them there, pictures on
 * this machine shown by their path. Raw HTML in it is dropped, and links go only to the web or within the page,
 * opened elsewhere. The blog's articles it names (《标题》, a link to one, its index.md) are links to them, as Notion's
 * page mentions: `[data-page]`, opened and previewed by the panel.
 */

/** An article of the blog as the panel names it. */
export type PageRef = { slug: string; title: string; icon?: string };

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
export function renderAiMarkdown(markdown: string, { blocks = false, pages = [] }: { blocks?: boolean; pages?: PageRef[] } = {}): DocumentFragment {
	const tree = articleParser.runSync(articleParser.parse(markdown)) as Tree;
	const drawn = (shown: Tree) => {
		const fragment = drawnTree(shown);
		if (pages.length) linkPages(fragment, indexOf(pages));
		return fragment;
	};
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

function drawnTree(tree: Tree): DocumentFragment {
	const template = document.createElement('template');
	template.innerHTML = toHtml.stringify(toHtml.runSync(tree as never) as never);
	const fragment = template.content;
	for (const link of fragment.querySelectorAll('a')) {
		const href = link.getAttribute('href') ?? '';
		if (/^https?:\/\//iu.test(href)) {
			link.target = '_blank';
			link.rel = 'noopener noreferrer';
		} else if (!href.startsWith('#')) {
			// Kept to be read: it may be one of the blog's articles (linkPages).
			link.dataset.target = href;
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
		// As written, for what is quoted of it (markdownOfSelection).
		holder.dataset.tex = code.textContent ?? '';
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
		holder.dataset.source = `\`\`\`${code.className.match(/language-([\w+-]+)/u)?.[1] ?? ''}\n${(code.textContent ?? '').replace(/\n$/u, '')}\n\`\`\``;
		holder.append(drawn);
		code.parentElement!.replaceWith(holder);
	}
	return fragment;
}

type PageIndex = { bySlug: Map<string, PageRef>; byTitle: Map<string, PageRef> };
const indexes = new WeakMap<PageRef[], PageIndex>();

function indexOf(pages: PageRef[]): PageIndex {
	let index = indexes.get(pages);
	if (!index) {
		index = { bySlug: new Map(pages.map((page) => [page.slug, page])), byTitle: new Map() };
		for (const page of pages) if (!index.byTitle.has(page.title)) index.byTitle.set(page.title, page);
		indexes.set(pages, index);
	}
	return index;
}

/**
 * The article an address or a path is of: `/blog/<slug>/`, its folder (`<slug>/`, `../<slug>`, `blog/<slug>`), its
 * index.md from wherever; null for anything else.
 */
export function pageAt(target: string, index: PageIndex): PageRef | null {
	const address = ARTICLE_ADDRESS.exec(target);
	if (address) return index.bySlug.get(address[2]!) ?? null;
	const path = decoded(target.replace(/^file:\/\//u, '')).replace(/[#?].*$/u, '');
	const file = /(?:^|\/)([^/]+)\/index\.md$/u.exec(path);
	if (file) return index.bySlug.get(file[1]!) ?? null;
	const folder = /^(?:\.{1,2}\/)?(?:blog\/)?([^/]+)\/?$/u.exec(path);
	return folder ? (index.bySlug.get(folder[1]!) ?? null) : null;
}

/** A link to an article, as the panel shows one: its icon (unless not `marked`), then `words` (its title, unless given). */
function pageLink(page: PageRef, words?: Node, marked = true): HTMLAnchorElement {
	const link = document.createElement('a');
	link.className = 'ai-page-link';
	link.dataset.page = page.slug;
	link.tabIndex = 0;
	link.setAttribute('role', 'link');
	const title = document.createElement('span');
	title.className = 'ai-page-title';
	title.append(words ?? page.title);
	if (marked) {
		const icon = document.createElement('span');
		icon.className = 'ai-page-icon';
		icon.setAttribute('aria-hidden', 'true');
		if (page.icon) icon.textContent = page.icon;
		link.append(icon);
	}
	link.append(title);
	return link;
}

/** In what was drawn: links to articles, their paths in code, 《title》 of one, each a link to it. */
function linkPages(fragment: DocumentFragment, index: PageIndex): void {
	for (const link of fragment.querySelectorAll<HTMLAnchorElement>('a:not([data-page])')) {
		const page = pageAt(link.getAttribute('href') ?? link.dataset.target ?? '', index);
		if (page) link.replaceWith(pageLink(page, wordsOf(link)));
	}
	for (const code of fragment.querySelectorAll('code:not(pre code)')) {
		const page = code.closest('a') ? null : pageAt((code.textContent ?? '').trim(), index);
		if (page && /index\.md$|^\/(?:blog|wiki)\//u.test((code.textContent ?? '').trim())) code.replaceWith(pageLink(page, code.cloneNode(true)));
	}
	const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT, {
		acceptNode: (node) => (node.parentElement?.closest('a, code, pre, .ai-math, .ai-math-display, .ai-preview') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
	});
	const texts: Text[] = [];
	for (let node = walker.nextNode(); node; node = walker.nextNode()) if ((node.textContent ?? '').includes('《')) texts.push(node as Text);
	for (const text of texts) {
		const value = text.data;
		const parts: Node[] = [];
		let last = 0;
		// The title linked, its 《》 kept: as said, no icon in them.
		for (const found of value.matchAll(/《([^《》\n]+)》/gu)) {
			const page = index.byTitle.get(found[1]!.trim());
			if (!page) continue;
			parts.push(document.createTextNode(value.slice(last, found.index + 1)));
			parts.push(pageLink(page, document.createTextNode(found[1]!), false));
			last = found.index + found[0].length - 1;
		}
		if (!parts.length) continue;
		if (last < value.length) parts.push(document.createTextNode(value.slice(last)));
		text.replaceWith(...parts);
	}
}

/** A link's words, as they are (formatting kept). */
function wordsOf(link: HTMLElement): DocumentFragment {
	const words = document.createDocumentFragment();
	words.append(...link.childNodes);
	return words;
}

/**
 * What is selected of what the AI said (`range`, within `root`), as Markdown: each block selected whole as it was
 * written (its `data-markdown`), a part of one from what is drawn, a formula always whole and as written ($…$).
 */
export function markdownOfSelection(range: Range, root: Element): string {
	const within = range.cloneRange();
	// A formula or a drawn block the selection starts or ends in: taken whole.
	const whole = (node: Node) => (node instanceof Element ? node : node.parentElement)?.closest('.ai-math, .ai-math-display, .ai-preview');
	const first = whole(within.startContainer);
	if (first) within.setStartBefore(first);
	const last = whole(within.endContainer);
	if (last) within.setEndAfter(last);
	const parts: string[] = [];
	for (const block of root.querySelectorAll<HTMLElement>('.ai-block')) {
		if (!within.intersectsNode(block)) continue;
		const all = document.createRange();
		all.selectNodeContents(block);
		const over = within.compareBoundaryPoints(Range.START_TO_START, all) <= 0 && within.compareBoundaryPoints(Range.END_TO_END, all) >= 0;
		if (over && block.dataset.markdown) {
			parts.push(block.dataset.markdown);
			continue;
		}
		const part = all.cloneRange();
		if (within.compareBoundaryPoints(Range.START_TO_START, all) > 0) part.setStart(within.startContainer, within.startOffset);
		if (within.compareBoundaryPoints(Range.END_TO_END, all) < 0) part.setEnd(within.endContainer, within.endOffset);
		parts.push(markdownOf(part.cloneContents()).replace(/\n{3,}/gu, '\n\n'));
	}
	// Words not in blocks (a tool's text): drawn back as they are.
	if (!parts.length) parts.push(markdownOf(within.cloneContents()));
	return parts.map((part) => part.trim()).filter(Boolean).join('\n\n');
}

/** Drawn Markdown read back as Markdown: formulas and plugins' blocks as written, the rest by what it is. */
function markdownOf(node: Node): string {
	if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
	if (!(node instanceof Element) && !(node instanceof DocumentFragment)) return '';
	if (node instanceof Element) {
		if (node.matches('.ai-block-handle, button')) return '';
		if (node.matches('.ai-math')) return `$${node.getAttribute('data-tex') ?? ''}$`;
		if (node.matches('.ai-math-display')) return `\n\n$$\n${node.getAttribute('data-tex') ?? ''}\n$$\n\n`;
		if (node.matches('.ai-preview')) return `\n\n${node.getAttribute('data-source') ?? ''}\n\n`;
	}
	const inner = [...node.childNodes].map(markdownOf).join('');
	if (!(node instanceof Element)) return inner;
	switch (node.tagName) {
		case 'STRONG':
		case 'B':
			return inner.trim() ? `**${inner}**` : inner;
		case 'EM':
		case 'I':
			return inner.trim() ? `*${inner}*` : inner;
		case 'CODE':
			return node.closest('pre') ? inner : `\`${inner}\``;
		case 'PRE':
			return `\n\n\`\`\`\n${inner.replace(/\n$/u, '')}\n\`\`\`\n\n`;
		case 'BR':
			return '\n';
		case 'LI':
			return `\n- ${inner.trim()}`;
		case 'P':
		case 'DIV':
		case 'H1':
		case 'H2':
		case 'H3':
		case 'H4':
		case 'BLOCKQUOTE':
		case 'TR':
		case 'UL':
		case 'OL':
			return `\n\n${inner}\n\n`;
		default:
			return inner;
	}
}
