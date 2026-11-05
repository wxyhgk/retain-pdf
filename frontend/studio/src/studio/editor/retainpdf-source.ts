import type { Ctx, MilkdownPlugin } from '@milkdown/ctx';
import { SchemaReady, nodeViewCtx } from '@milkdown/kit/core';
import type { Node as ProseNode } from '@milkdown/prose/model';
import type { NodeView, NodeViewConstructor } from '@milkdown/prose/view';
import { $nodeSchema, $remark } from '@milkdown/utils';

import { t } from '@blog/i18n/index.mjs';
import logo from './retainpdf-logo.svg?raw';
import { labelBook, parseQuote, parseSourceHref, QUOTE_LANGUAGE, quoteMarkdown, quoteTarget, SOURCE_SCHEME, sourceMarkdown } from './retainpdf-quote';

/**
 * Where a passage quoted from RetainPDF is (retainpdf-quote.ts): the `[书 · 第 12 页](retainpdf:…)` link before it is
 * one piece of the text, drawn as RetainPDF's mark in the top right corner of its paragraph (studio-page.css); the
 * passage itself is the note's own paragraphs. The mark shows the passage in 翻译 (followQuoteOpens); written back as
 * the link it was. A block quoted before (```retainpdf) is read as the same: its translation after the link.
 */

export const SOURCE_TYPE = 'retainpdf_source';
/** How much of a book's title the mark shows (the rest on hover). */
const BOOK_SHOWN = 10;

type MdastNode = { type: string; value?: string; url?: string; lang?: string | null; label?: string; children?: MdastNode[] };
type RemarkPlugin = ReturnType<Parameters<typeof $remark>[1]>;
type Processor = { data(): Record<string, unknown>; parse(markdown: string): MdastNode };

const words = (node: MdastNode): string => node.value ?? (node.children ?? []).map(words).join('');

/** The links to RetainPDF made marks, and the blocks quoted before made paragraphs; in every container. */
function sourcesIn(node: MdastNode, processor: Processor): void {
	if (!node.children) return;
	node.children = node.children.flatMap((child) => {
		if (child.type === 'code' && child.lang?.toLowerCase() === QUOTE_LANGUAGE) {
			const quote = parseQuote(child.value ?? '');
			return quote ? (processor.parse(quoteMarkdown(quote)).children ?? []) : [child];
		}
		if (child.type === 'link' && child.url?.startsWith(SOURCE_SCHEME) && parseSourceHref(child.url)) {
			return [{ type: 'retainpdfSource', url: child.url, label: words(child) }];
		}
		return [child];
	});
	// The space after the link is the link's (written back with it): the mark is out of the line, the text starts at its start.
	node.children.forEach((child, index) => {
		const next = node.children![index + 1];
		if (child.type === 'retainpdfSource' && next?.type === 'text') next.value = next.value!.replace(/^[ \t]+/u, '');
	});
	for (const child of node.children) sourcesIn(child, processor);
}

export const sourceRemark = $remark('retainpdf-sources', () => function (this: Processor) {
	const processor = this;
	const extensions = (processor.data().toMarkdownExtensions ??= []) as unknown[];
	// Written as the link it was, with the space after it.
	extensions.push({ handlers: { retainpdfSource: (node: MdastNode) => `${sourceMarkdown(node.label ?? '', node.url ?? '')} ` } });
	return (tree: MdastNode) => sourcesIn(tree, processor);
} as unknown as RemarkPlugin);

export const sourceSchema = $nodeSchema(SOURCE_TYPE, () => ({
	group: 'inline',
	inline: true,
	atom: true,
	selectable: true,
	attrs: { href: { default: '' }, label: { default: '' } },
	parseDOM: [{ tag: 'span.retainpdf-source', getAttrs: (dom) => ({ href: (dom as HTMLElement).dataset.href ?? '', label: (dom as HTMLElement).dataset.label ?? '' }) }],
	toDOM: (node) => ['span', { class: 'retainpdf-source', 'data-href': node.attrs.href, 'data-label': node.attrs.label }, node.attrs.label],
	parseMarkdown: {
		match: (node) => node.type === 'retainpdfSource',
		runner: (state, node, type) => {
			state.addNode(type, { href: (node as MdastNode).url ?? '', label: (node as MdastNode).label ?? '' });
		},
	},
	toMarkdown: {
		match: (node) => node.type.name === SOURCE_TYPE,
		runner: (state, node) => {
			state.addNode('retainpdfSource', undefined, undefined, { url: node.attrs.href, label: node.attrs.label });
		},
	},
}));

/**
 * The mark: RetainPDF's logo and, small after it, the book and page (a note quotes several books: which passage is of
 * which seen at a glance, not on hover only); which book and page, for the page read to pick it out (wiring/book-places.ts).
 */
class SourceView implements NodeView {
	readonly dom: HTMLElement;

	constructor(node: ProseNode) {
		this.dom = document.createElement('span');
		this.dom.className = 'retainpdf-source retainpdf-quote-open';
		this.dom.contentEditable = 'false';
		this.dom.innerHTML = logo;
		this.draw(node);
	}

	update(node: ProseNode): boolean {
		if (node.type.name !== SOURCE_TYPE) return false;
		this.draw(node);
		return true;
	}

	ignoreMutation(): boolean {
		return true;
	}

	selectNode(): void {
		this.dom.classList.add('is-selected');
	}

	deselectNode(): void {
		this.dom.classList.remove('is-selected');
	}

	private draw(node: ProseNode): void {
		const source = parseSourceHref(String(node.attrs.href));
		const label = String(node.attrs.label);
		this.dom.title = label ? t('{label} · 在 RetainPDF 中打开', { label }) : t('在 RetainPDF 中打开');
		this.dom.setAttribute('aria-label', this.dom.title);
		this.dom.dataset.target = source ? JSON.stringify(quoteTarget(source)) : '';
		this.dom.dataset.job = source?.job ?? '';
		if (source?.document) this.dom.dataset.document = source.document;
		else delete this.dom.dataset.document;
		if (source?.page) this.dom.dataset.page = String(source.page);
		else delete this.dom.dataset.page;
		const book = labelBook(label);
		if (book) this.dom.dataset.book = book;
		else delete this.dom.dataset.book;
		// Drawn by the page's CSS (`data-shown`), not text of the paragraph (its words, as found and copied, are the passage's).
		const shown = [book ? (book.length > BOOK_SHOWN ? `${book.slice(0, BOOK_SHOWN)}…` : book) : '', source?.page ? String(source.page) : ''].filter(Boolean).join(' · ');
		if (shown) this.dom.dataset.shown = shown;
		else delete this.dom.dataset.shown;
	}
}

function sourceView(): MilkdownPlugin {
	return (ctx: Ctx) => async () => {
		await ctx.wait(SchemaReady);
		const entry: [string, NodeViewConstructor] = [SOURCE_TYPE, (node) => new SourceView(node)];
		ctx.update(nodeViewCtx, (all) => [...all.filter(([id]) => id !== SOURCE_TYPE), entry]);
		return () => {
			ctx.update(nodeViewCtx, (all) => all.filter(([id]) => id !== SOURCE_TYPE));
		};
	};
}

/** The books a note quotes, each once, in the order first quoted: its job, its id and title as the marks say them. */
export function citedBooks(doc: ProseNode): Array<{ job_id: string; document_id: string | null; title: string | null }> {
	const books = new Map<string, { job_id: string; document_id: string | null; title: string | null }>();
	doc.descendants((node) => {
		if (node.type.name !== SOURCE_TYPE) return true;
		const source = parseSourceHref(String(node.attrs.href));
		if (source && !books.has(source.job)) books.set(source.job, { job_id: source.job, document_id: source.document, title: labelBook(String(node.attrs.label)) });
		return false;
	});
	return [...books.values()];
}

/** A passage of a book quoted in a note: where its blocks are (`from`–`to`), where it is in the book, its first words. */
export type QuotedPassage = { from: number; to: number; job: string; block: string; page: number | null; text: string };

/**
 * The passages a note quotes of `book` (its job, or its id), in order: each from the block with its mark up to the next
 * passage quoted (of any book) or heading, so that what came with it (a formula, its other paragraphs) and what the
 * author wrote after it are its; its words the first there are (the mark's block is only the mark when a formula is quoted).
 */
export function bookPassages(doc: ProseNode, book: { job_id: string; document_id: string | null }): QuotedPassage[] {
	const sourceOf = (node: ProseNode) => {
		let found: ReturnType<typeof parseSourceHref> = null;
		node.descendants((inner) => {
			if (found) return false;
			if (inner.type.name !== SOURCE_TYPE) return true;
			found = parseSourceHref(String(inner.attrs.href));
			return false;
		});
		return found as ReturnType<typeof parseSourceHref>;
	};
	const passages: QuotedPassage[] = [];
	let open: QuotedPassage | null = null;
	let pos = 0;
	for (let index = 0; index < doc.childCount; index += 1) {
		const node = doc.child(index);
		const source = sourceOf(node);
		if (source || node.type.name === 'heading') open = null;
		if (source && (source.job === book.job_id || (book.document_id && source.document === book.document_id))) {
			open = { from: pos, to: pos + node.nodeSize, job: source.job, block: source.block, page: source.page, text: node.textContent.trim() };
			passages.push(open);
		} else if (open && !(node.type.name === 'paragraph' && !node.content.size)) {
			// Its (an empty paragraph, the one left at the end to write on, is not).
			open.to = pos + node.nodeSize;
			if (!open.text) open.text = node.textContent.trim();
		}
		pos += node.nodeSize;
	}
	for (const passage of passages) passage.text = passage.text.replace(/\s+/gu, ' ').slice(0, 160);
	return passages;
}

export function sourcePlugins(): MilkdownPlugin[] {
	return [sourceRemark, ...sourceSchema, sourceView()].flat();
}
