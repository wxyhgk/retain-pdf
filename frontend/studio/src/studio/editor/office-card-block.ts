import type { Ctx, MilkdownPlugin } from '@milkdown/ctx';
import { SchemaReady, nodeViewCtx } from '@milkdown/kit/core';
import type { Node as ProseNode } from '@milkdown/prose/model';
import { Plugin, type EditorState, type Transaction } from '@milkdown/prose/state';
import type { NodeView, NodeViewConstructor } from '@milkdown/prose/view';
import { $nodeSchema, $prose, $remark } from '@milkdown/utils';

import { officeCardElement, watchOfficeCard } from '../../office/office-card';
import { officeFileOf, officeKind } from '../../office/office-kinds.mjs';

/**
 * Office files as cards in the editor, as the blog draws them
 * (remark-office-cards.mjs): a link alone in its paragraph to one of the
 * article's Word, PowerPoint or Excel files is one block, written back as
 * that link. A link made so (a file dropped or inserted, a link typed) becomes one.
 */

export const OFFICE_CARD_TYPE = 'office_card';

type MdastNode = { type: string; url?: string; value?: string; label?: string; children?: MdastNode[] };
type RemarkPlugin = ReturnType<Parameters<typeof $remark>[1]>;

/** Where a card can stand: as the blog makes them, in the body or a quote, not in a list item. */
const CARD_PARENTS = new Set(['root', 'blockquote']);

const textOf = (node: MdastNode): string => (node.type === 'text' || node.type === 'inlineCode' ? (node.value ?? '') : (node.children ?? []).map(textOf).join(''));

function cardsIn(node: MdastNode): void {
	if (!node.children) return;
	if (CARD_PARENTS.has(node.type)) {
		node.children = node.children.map((child) => {
			if (child.type !== 'paragraph') return child;
			const parts = (child.children ?? []).filter((part) => !(part.type === 'text' && !part.value?.trim()));
			const link = parts.length === 1 && parts[0]!.type === 'link' ? parts[0]! : null;
			if (!link || !officeFileOf(link.url ?? '')) return child;
			return { type: 'officeCard', url: link.url, label: textOf(link) };
		});
	}
	node.children.forEach(cardsIn);
}

export const officeCardRemark = $remark('office-cards', () => function (this: { data(): Record<string, unknown> }) {
	const data = this.data();
	const extensions = (data.toMarkdownExtensions ??= []) as unknown[];
	// Written back as the link it was, alone in its paragraph.
	extensions.push({
		handlers: {
			officeCard: (node: MdastNode, parent: unknown, state: { handle: (node: unknown, parent: unknown, state: unknown, info: unknown) => string }, info: unknown) =>
				state.handle({ type: 'paragraph', children: [{ type: 'link', url: node.url, children: [{ type: 'text', value: node.label }] }] }, parent, state, info),
		},
	});
	return cardsIn;
} as unknown as RemarkPlugin);

export const officeCardSchema = $nodeSchema(OFFICE_CARD_TYPE, () => ({
	group: 'block',
	atom: true,
	selectable: true,
	draggable: true,
	attrs: { url: { default: '' }, label: { default: '' } },
	parseDOM: [{ tag: 'div[data-office-card-url]', getAttrs: (dom) => ({ url: (dom as HTMLElement).dataset.officeCardUrl ?? '', label: (dom as HTMLElement).dataset.officeCardLabel ?? '' }) }],
	toDOM: (node) => ['div', { 'data-office-card-url': node.attrs.url, 'data-office-card-label': node.attrs.label }, node.attrs.label],
	parseMarkdown: {
		match: (node) => node.type === 'officeCard',
		runner: (state, node, type) => {
			state.addNode(type, { url: (node as MdastNode).url ?? '', label: (node as MdastNode).label ?? '' });
		},
	},
	toMarkdown: {
		match: (node) => node.type.name === OFFICE_CARD_TYPE,
		runner: (state, node) => {
			state.addNode('officeCard', undefined, undefined, { url: node.attrs.url, label: node.attrs.label });
		},
	},
}));

/** Paragraphs that are only a link to an office file, made cards: one dropped, inserted or typed. */
function cardsFromLinks(state: EditorState): Transaction | null {
	const type = state.schema.nodes[OFFICE_CARD_TYPE];
	const linkType = state.schema.marks.link;
	if (!type || !linkType) return null;
	const found: { from: number; to: number; url: string; label: string }[] = [];
	state.doc.descendants((node, pos, parent, index) => {
		if (node.type.name !== 'paragraph') return !node.isTextblock;
		if (!node.childCount || !parent) return false;
		let url: string | null = null;
		let whole = true;
		node.forEach((child) => {
			const mark = child.marks.find((each) => each.type === linkType);
			const href = mark ? String(mark.attrs.href ?? '') : null;
			if (!child.isText || href === null || (url !== null && href !== url)) whole = false;
			else url = href;
		});
		if (whole && url && officeFileOf(url) && parent.canReplaceWith(index, index + 1, type)) found.push({ from: pos, to: pos + node.nodeSize, url, label: node.textContent });
		return false;
	});
	if (!found.length) return null;
	let tr = state.tr;
	for (const { from, to, url, label } of found.reverse()) tr = tr.replaceWith(from, to, type.create({ url, label }));
	return tr;
}

const officeCardLinks = $prose(
	() =>
		new Plugin({
			appendTransaction: (transactions, _old, state) => (transactions.some((tr) => tr.docChanged) ? cardsFromLinks(state) : null),
		}),
);

class OfficeCardView implements NodeView {
	readonly dom: HTMLElement;
	private url = '';

	constructor(
		node: ProseNode,
		private readonly fileUrl: (written: string) => string,
	) {
		this.dom = document.createElement('div');
		this.dom.className = 'office-card-block';
		this.dom.contentEditable = 'false';
		this.draw(node);
	}

	private draw(node: ProseNode): void {
		const written = String(node.attrs.url);
		const label = String(node.attrs.label);
		if (written === this.url && this.dom.firstElementChild?.querySelector('.office-card-name')?.textContent === label) return;
		this.url = written;
		const path = officeFileOf(written) ?? written;
		const card = officeCardElement({ url: this.fileUrl(written), name: label || (path.split('/').pop() ?? ''), kind: officeKind(path) ?? 'old' });
		this.dom.replaceChildren(card);
		watchOfficeCard(card);
	}

	update(node: ProseNode): boolean {
		if (node.type.name !== OFFICE_CARD_TYPE) return false;
		this.draw(node);
		return true;
	}

	/** The card's own buttons and links act; the rest of it selects the block. */
	stopEvent(event: Event): boolean {
		return event.target instanceof Element && Boolean(event.target.closest('.office-card-thumb, .office-card-name, .office-card-actions'));
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
}

function officeCardView(fileUrl: (written: string) => string): MilkdownPlugin {
	return (ctx: Ctx) => async () => {
		await ctx.wait(SchemaReady);
		const entry: [string, NodeViewConstructor] = [OFFICE_CARD_TYPE, (node) => new OfficeCardView(node, fileUrl)];
		ctx.update(nodeViewCtx, (all) => [...all.filter(([id]) => id !== OFFICE_CARD_TYPE), entry]);
		return () => {
			ctx.update(nodeViewCtx, (all) => all.filter(([id]) => id !== OFFICE_CARD_TYPE));
		};
	};
}

/** Office cards in the editor; `fileUrl` is where a file the article names is read from. */
export function officeCardPlugins(fileUrl: (written: string) => string): MilkdownPlugin[] {
	return [officeCardRemark, ...officeCardSchema, officeCardLinks, officeCardView(fileUrl)].flat();
}
