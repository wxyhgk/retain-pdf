import type { Ctx, MilkdownPlugin } from '@milkdown/ctx';
import { SchemaReady, nodeViewCtx } from '@milkdown/kit/core';
import type { Node as ProseNode } from '@milkdown/prose/model';
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@milkdown/prose/state';
import { Decoration, DecorationSet, type EditorView, type NodeView, type NodeViewConstructor } from '@milkdown/prose/view';
import { $nodeSchema, $prose, $remark } from '@milkdown/utils';

import { BIBLIOGRAPHY_PATH, CITATION, authorList, numberRanges, parseCitation, plainTex, type BibEntry } from '@blog/markdown/references/bibtex.mjs';
import '@blog/markdown/references/references.css';
import { changedRange, editTouches } from '@blog/editor-kit/changed-range.ts';
import { t } from '@blog/i18n/index.mjs';

/**
 * Citations in the editor (`src/references/`): `[@becke1993]` is one piece
 * of the text, drawn as the blog numbers it (`[1]`, `[2,3]`), with the work
 * it cites on hover, and written back as it was. `[@` asks which work to
 * cite; a citation typed or pasted whole becomes one too.
 */

export const CITATION_TYPE = 'citation';

type MdastNode = { type: string; value?: string; children?: MdastNode[] };
type RemarkPlugin = ReturnType<Parameters<typeof $remark>[1]>;
type Library = Map<string, BibEntry>;

/** Containers whose text is not prose: no citations in them. */
const NOT_PROSE = new Set(['code', 'inlineCode', 'math', 'inlineMath', 'link', 'linkReference', 'html']);

/** The citations in a text, as `[text, citation, text, …]`; null when it holds none. */
function splitText(value: string): MdastNode[] | null {
	const pieces: MdastNode[] = [];
	let last = 0;
	for (const match of value.matchAll(CITATION)) {
		if (!parseCitation(match[1]!)) continue;
		if (match.index! > last) pieces.push({ type: 'text', value: value.slice(last, match.index) });
		pieces.push({ type: 'citation', value: match[0] });
		last = match.index! + match[0].length;
	}
	if (!pieces.length) return null;
	if (last < value.length) pieces.push({ type: 'text', value: value.slice(last) });
	return pieces;
}

function citationsIn(node: MdastNode): void {
	if (!node.children || NOT_PROSE.has(node.type)) return;
	node.children = node.children.flatMap((child) => (child.type === 'text' && child.value?.includes('[@') ? (splitText(child.value) ?? [child]) : [child]));
	node.children.forEach(citationsIn);
}

export const citationRemark = $remark('article-citations', () => function (this: { data(): Record<string, unknown> }) {
	const data = this.data();
	const extensions = (data.toMarkdownExtensions ??= []) as unknown[];
	// Written as it was: `[@key]`, its bracket not escaped.
	extensions.push({ handlers: { citation: (node: MdastNode) => node.value ?? '' } });
	return citationsIn;
} as unknown as RemarkPlugin);

export const citationSchema = $nodeSchema(CITATION_TYPE, () => ({
	group: 'inline',
	inline: true,
	atom: true,
	selectable: true,
	attrs: { value: { default: '' } },
	parseDOM: [{ tag: 'span.citation-chip', getAttrs: (dom) => ({ value: (dom as HTMLElement).dataset.value ?? '' }) }],
	toDOM: (node) => ['span', { class: 'citation-chip', 'data-value': node.attrs.value }, node.attrs.value],
	parseMarkdown: {
		match: (node) => node.type === 'citation',
		runner: (state, node, type) => {
			state.addNode(type, { value: (node as MdastNode).value ?? '' });
		},
	},
	toMarkdown: {
		match: (node) => node.type.name === CITATION_TYPE,
		runner: (state, node) => {
			state.addNode('citation', undefined, node.attrs.value);
		},
	},
}));

/** How a work is told on hover: `Becke, A. D. 1993. Density-functional thermochemistry…`. */
export function citedWork(entry: BibEntry): string {
	const first = authorList(entry.fields.author ?? entry.fields.editor).split('; ')[0] ?? '';
	const authors = /\sand\s/iu.test(entry.fields.author ?? '') ? t('{author} 等', { author: first }) : first;
	const year = plainTex(entry.fields.year ?? entry.fields.date ?? '').slice(0, 4);
	return [authors, year, plainTex(entry.fields.title)].filter(Boolean).join(' · ');
}

type Label = { label: string; title: string; missing: boolean };

/** Each citation's label, numbered as the blog numbers them; the citations as written while the library is not read. */
function labels(doc: ProseNode, library: Library | null): DecorationSet {
	const cited: string[] = [];
	const decorations: Decoration[] = [];
	doc.descendants((node, pos) => {
		if (node.type.name !== CITATION_TYPE) return;
		const value = String(node.attrs.value);
		const items = parseCitation(value.slice(1, -1)) ?? [];
		let spec: Label;
		if (!library) spec = { label: value, title: t('没有找到 {path}', { path: BIBLIOGRAPHY_PATH }), missing: true };
		else {
			const numbers: number[] = [];
			const titles: string[] = [];
			for (const { key, locator } of items) {
				const entry = library.get(key);
				if (!entry) {
					titles.push(t('找不到 @{key}', { key }));
					continue;
				}
				if (!cited.includes(key)) cited.push(key);
				numbers.push(cited.indexOf(key) + 1);
				titles.push(`[${cited.indexOf(key) + 1}] ${citedWork(entry)}${locator ? `，${locator}` : ''}`);
			}
			spec = { label: numbers.length ? `[${numberRanges(numbers)}]` : '[?]', title: titles.join('\n'), missing: numbers.length < items.length };
		}
		decorations.push(Decoration.node(pos, pos + node.nodeSize, {}, spec));
	});
	return DecorationSet.create(doc, decorations);
}

type LabelState = { library: Library | null; labels: DecorationSet };
const citationKey = new PluginKey<LabelState>('article-citations');

/**
 * Text that reads as a citation, made one: one typed to its closing
 * bracket, or left so by an edit. Prose only.
 */
function citationsFromText(state: EditorState, before: ProseNode): Transaction | null {
	const type = state.schema.nodes[CITATION_TYPE];
	if (!type) return null;
	// Only where the edit changed the text.
	const range = changedRange(before, state.doc);
	if (!range) return null;
	const found: { from: number; to: number; value: string }[] = [];
	state.doc.nodesBetween(range.from, Math.min(range.toAfter, state.doc.content.size), (node, pos, parent) => {
		if (node.type.spec.code || node.marks.some((mark) => mark.type.spec.code || mark.type.name === 'link')) return false;
		if (!node.isText || !parent?.isTextblock || parent.type.spec.code || !node.text?.includes('[@')) return;
		for (const match of node.text.matchAll(CITATION)) {
			if (parseCitation(match[1]!)) found.push({ from: pos + match.index!, to: pos + match.index! + match[0].length, value: match[0] });
		}
	});
	if (!found.length) return null;
	let tr = state.tr;
	for (const { from, to, value } of found.reverse()) tr = tr.replaceWith(from, to, type.create({ value }));
	return tr;
}

class CitationView implements NodeView {
	readonly dom: HTMLElement;

	constructor(node: ProseNode, decorations: readonly Decoration[]) {
		this.dom = document.createElement('span');
		this.dom.className = 'citation-chip';
		this.dom.dataset.value = String(node.attrs.value);
		this.draw(node, decorations);
	}

	update(node: ProseNode, decorations: readonly Decoration[]): boolean {
		if (node.type.name !== CITATION_TYPE) return false;
		this.dom.dataset.value = String(node.attrs.value);
		this.draw(node, decorations);
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

	private draw(node: ProseNode, decorations: readonly Decoration[]): void {
		const spec = decorations.find((decoration) => (decoration.spec as Partial<Label>).label !== undefined)?.spec as Label | undefined;
		this.dom.textContent = spec?.label ?? String(node.attrs.value);
		this.dom.title = `${spec?.title ?? ''}\n${node.attrs.value}`.trim();
		this.dom.classList.toggle('is-missing', Boolean(spec?.missing));
	}
}

/** What citing needs from the Studio around the editor. */
export type CitationHost = {
	/** Asks which work to cite: its key, or null when given up. */
	pickCitation(): Promise<string | null>;
};

/** Asks for a work and cites it at `at`; given up, `typed` goes back (the `[@` that asked). */
async function citeAt(view: EditorView, host: CitationHost, at: number, typed: string): Promise<void> {
	const key = await host.pickCitation();
	if (view.isDestroyed) return;
	const { state } = view;
	const type = state.schema.nodes[CITATION_TYPE];
	const pos = Math.min(at, state.doc.content.size);
	let tr = state.tr;
	if (key && type) {
		tr = tr.insert(pos, type.create({ value: `[@${key}]` }));
		tr = tr.setSelection(TextSelection.create(tr.doc, pos + 1));
	} else {
		tr = tr.insertText(typed, pos).setSelection(TextSelection.create(tr.doc, pos + typed.length));
	}
	view.dispatch(tr.scrollIntoView());
	view.focus();
}

const citationPlugin = (host: CitationHost) =>
	$prose(
		() =>
			new Plugin<LabelState>({
				key: citationKey,
				state: {
					init: (_config, state) => ({ library: null, labels: labels(state.doc, null) }),
					apply(tr, previous) {
						const given = tr.getMeta(citationKey) as { library: Library | null } | undefined;
						const library = given ? given.library : previous.library;
						if (!given && !tr.docChanged) return previous;
						// An edit that left the citations as they were (most: typing in a long article) moves their labels along.
						if (!given && !editTouches(tr.before, tr.doc, (node) => node.type.name === CITATION_TYPE)) return { library, labels: previous.labels.map(tr.mapping, tr.doc) };
						return { library, labels: labels(tr.doc, library) };
					},
				},
				appendTransaction: (transactions, old, state) => (transactions.some((tr) => tr.docChanged) ? citationsFromText(state, old.doc) : null),
				props: {
					decorations: (state) => citationKey.getState(state)?.labels,
					handleTextInput(view, from, to, text) {
						if (text !== '@' || from !== to || from < 1) return false;
						const { $from } = view.state.selection;
						if ($from.parent.type.spec.code || view.state.doc.textBetween(from - 1, from) !== '[') return false;
						// The `[` goes; the work asked for comes in its place.
						view.dispatch(view.state.tr.delete(from - 1, from));
						void citeAt(view, host, from - 1, '[@');
						return true;
					},
				},
			}),
	);

function citationView(): MilkdownPlugin {
	return (ctx: Ctx) => async () => {
		await ctx.wait(SchemaReady);
		const entry: [string, NodeViewConstructor] = [CITATION_TYPE, (node, _view, _getPos, decorations) => new CitationView(node, decorations)];
		ctx.update(nodeViewCtx, (all) => [...all.filter(([id]) => id !== CITATION_TYPE), entry]);
		return () => {
			ctx.update(nodeViewCtx, (all) => all.filter(([id]) => id !== CITATION_TYPE));
		};
	};
}

/** The article's library is now this (null: it has none), to number the citations by. */
export function setCitationLibrary(view: EditorView, library: Library | null): void {
	view.dispatch(view.state.tr.setMeta(citationKey, { library }).setMeta('addToHistory', false));
}

export function citationPlugins(host: CitationHost): MilkdownPlugin[] {
	return [citationRemark, ...citationSchema, citationPlugin(host), citationView()].flat();
}
