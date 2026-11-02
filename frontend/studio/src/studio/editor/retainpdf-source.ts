import type { Ctx, MilkdownPlugin } from '@milkdown/ctx';
import { SchemaReady, nodeViewCtx } from '@milkdown/kit/core';
import type { Node as ProseNode } from '@milkdown/prose/model';
import type { NodeView, NodeViewConstructor } from '@milkdown/prose/view';
import { $nodeSchema, $remark } from '@milkdown/utils';

import { t } from '@blog/i18n/index.mjs';
import logo from './retainpdf-logo.svg?raw';
import { parseQuote, parseSourceHref, QUOTE_LANGUAGE, quoteMarkdown, quoteTarget, SOURCE_SCHEME, sourceMarkdown } from './retainpdf-quote';

/**
 * Where a passage quoted from RetainPDF is (retainpdf-quote.ts): the `[书 · 第 12 页](retainpdf:…)` link before it is
 * one piece of the text, drawn as RetainPDF's mark in the top right corner of its paragraph (studio-page.css); the
 * passage itself is the note's own paragraphs. The mark shows the passage in 翻译 (followQuoteOpens); written back as
 * the link it was. A block quoted before (```retainpdf) is read as the same: its translation after the link.
 */

export const SOURCE_TYPE = 'retainpdf_source';

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

/** The mark: RetainPDF's logo, the book and page said on hover; which book and page, for the page read to pick it out (wiring/book-places.ts). */
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

export function sourcePlugins(): MilkdownPlugin[] {
	return [sourceRemark, ...sourceSchema, sourceView()].flat();
}
