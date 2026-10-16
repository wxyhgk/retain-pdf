import type { Ctx, MilkdownPlugin } from '@milkdown/ctx';
import { SchemaReady, nodeViewCtx } from '@milkdown/kit/core';
import type { Node as ProseNode } from '@milkdown/prose/model';
import { TextSelection } from '@milkdown/prose/state';
import type { EditorView, NodeView, NodeViewConstructor, ViewMutationRecord } from '@milkdown/prose/view';
import { $nodeSchema, $remark } from '@milkdown/utils';

/**
 * Toggles, as Notion has them and GitHub writes them:
 *
 *     <details>
 *     <summary>推导过程</summary>
 *
 *     内容……
 *
 *     </details>
 *
 * The blog draws the HTML as it is; here the HTML around the blocks becomes
 * one block, its title typed in place, folded and unfolded with its
 * triangle (in the editor only: the file keeps whether it starts open).
 */

export const TOGGLE_TYPE = 'toggle';

type MdastNode = { type: string; value?: string; summary?: string; open?: boolean; children?: MdastNode[] };
type RemarkPlugin = ReturnType<Parameters<typeof $remark>[1]>;
type MarkdownState = { containerFlow(node: unknown, info: unknown): string };

const OPENING = /^<details(\s+open)?\s*>\s*(?:<summary>([\s\S]*?)<\/summary>)?\s*$/iu;
const CLOSING = /^<\/details>\s*$/iu;

function decodeHtml(text: string): string {
	return text.replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&quot;/gu, '"').replace(/&#39;/gu, "'").replace(/&amp;/gu, '&');
}

function encodeHtml(text: string): string {
	return text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
}

/**
 * The HTML a block is: an `html` node, or a paragraph holding only one,
 * as Milkdown wraps HTML in a paragraph before this runs.
 */
function htmlOf(node: MdastNode): string | null {
	if (node.type === 'html') return node.value ?? '';
	if (node.type === 'paragraph' && node.children?.length === 1 && node.children[0].type === 'html') return node.children[0].value ?? '';
	return null;
}

/** The blocks between `<details>` and its `</details>`, made one toggle; inner ones too. */
export function groupToggles(node: MdastNode): void {
	const children = node.children;
	if (!children) return;
	for (let index = 0; index < children.length; index += 1) {
		const child = children[index];
		const opening = OPENING.exec(htmlOf(child) ?? '');
		if (!opening) continue;
		let depth = 1;
		let end = index + 1;
		for (; end < children.length; end += 1) {
			const value = htmlOf(children[end]) ?? '';
			if (OPENING.test(value)) depth += 1;
			else if (CLOSING.test(value) && --depth === 0) break;
		}
		if (end >= children.length) continue;
		const inner = children.slice(index + 1, end);
		const toggle: MdastNode = {
			type: 'toggle',
			summary: decodeHtml((opening[2] ?? '').trim()),
			open: Boolean(opening[1]),
			children: inner.length ? inner : [{ type: 'paragraph', children: [] }],
		};
		children.splice(index, end - index + 1, toggle);
	}
	children.forEach(groupToggles);
}

function writeToggle(node: MdastNode, _parent: unknown, state: MarkdownState, info: unknown): string {
	const inner = state.containerFlow(node, info);
	const head = `<details${node.open ? ' open' : ''}>\n<summary>${encodeHtml(node.summary ?? '')}</summary>`;
	return inner ? `${head}\n\n${inner}\n\n</details>` : `${head}\n\n</details>`;
}

export const toggleRemark = $remark('article-toggles', () => function (this: { data(): Record<string, unknown> }) {
	const data = this.data();
	const extensions = (data.toMarkdownExtensions ??= []) as unknown[];
	extensions.push({ handlers: { toggle: writeToggle } });
	return groupToggles;
} as unknown as RemarkPlugin);

export const toggleSchema = $nodeSchema(TOGGLE_TYPE, () => ({
	group: 'block',
	content: 'block+',
	defining: true,
	attrs: { summary: { default: '' }, open: { default: false } },
	parseDOM: [
		{
			tag: 'details',
			getAttrs: (dom) => ({
				summary: (dom as HTMLElement).querySelector('summary')?.textContent ?? '',
				open: (dom as HTMLDetailsElement).open,
			}),
			contentElement: (dom) => (dom as HTMLElement).querySelector('.toggle-body') ?? dom,
		},
	],
	toDOM: (node) => [
		'details',
		{ class: 'toggle', open: node.attrs.open ? '' : null },
		['summary', node.attrs.summary],
		['div', { class: 'toggle-body' }, 0],
	],
	parseMarkdown: {
		match: (node) => node.type === 'toggle',
		runner: (state, node, type) => {
			const toggle = node as MdastNode;
			state.openNode(type, { summary: toggle.summary ?? '', open: Boolean(toggle.open) });
			state.next(node.children);
			state.closeNode();
		},
	},
	toMarkdown: {
		match: (node) => node.type.name === TOGGLE_TYPE,
		runner: (state, node) => {
			state.openNode('toggle', undefined, { summary: node.attrs.summary, open: node.attrs.open });
			state.next(node.content);
			state.closeNode();
		},
	},
}));

class ToggleView implements NodeView {
	readonly dom: HTMLElement;
	readonly contentDOM: HTMLElement;
	private node: ProseNode;
	private readonly view: EditorView;
	private readonly getPos: () => number | undefined;
	private readonly summary: HTMLInputElement;
	private readonly arrow: HTMLButtonElement;

	constructor(node: ProseNode, view: EditorView, getPos: () => number | undefined) {
		this.node = node;
		this.view = view;
		this.getPos = getPos;
		this.dom = document.createElement('div');
		this.dom.className = 'toggle-block';
		const head = document.createElement('div');
		head.className = 'toggle-head';
		head.contentEditable = 'false';
		this.arrow = document.createElement('button');
		this.arrow.type = 'button';
		this.arrow.className = 'toggle-arrow';
		this.arrow.textContent = '▸';
		this.arrow.addEventListener('mousedown', (event) => event.preventDefault());
		this.arrow.addEventListener('click', () => this.fold(!this.dom.classList.contains('is-folded')));
		this.summary = document.createElement('input');
		this.summary.className = 'toggle-summary';
		this.summary.placeholder = '折叠块';
		this.summary.setAttribute('aria-label', '折叠块的标题');
		this.summary.addEventListener('input', () => this.setSummary(this.summary.value));
		this.summary.addEventListener('keydown', this.onSummaryKey);
		head.append(this.arrow, this.summary);
		this.contentDOM = document.createElement('div');
		this.contentDOM.className = 'toggle-body';
		this.dom.append(head, this.contentDOM);
		this.draw();
		this.fold(false);
	}

	update(node: ProseNode): boolean {
		if (node.type !== this.node.type) return false;
		this.node = node;
		this.draw();
		return true;
	}

	/** Typing in the title and clicking the triangle are the toggle's own. */
	stopEvent(event: Event): boolean {
		return Boolean((event.target as Element | null)?.closest?.('.toggle-head'));
	}

	ignoreMutation(mutation: ViewMutationRecord): boolean {
		return !this.contentDOM.contains(mutation.target);
	}

	/** Focuses the title, for a toggle just made. */
	focusSummary(): void {
		this.summary.focus();
	}

	private draw(): void {
		if (document.activeElement !== this.summary && this.summary.value !== this.node.attrs.summary) this.summary.value = this.node.attrs.summary;
	}

	private fold(folded: boolean): void {
		this.dom.classList.toggle('is-folded', folded);
		this.arrow.setAttribute('aria-expanded', String(!folded));
		this.arrow.setAttribute('aria-label', folded ? '展开' : '折叠');
	}

	private setSummary(summary: string): void {
		const pos = this.getPos();
		if (pos === undefined) return;
		this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, summary }));
	}

	/** Enter or ↓ in the title: into the toggle, opening it. */
	private onSummaryKey = (event: KeyboardEvent): void => {
		if (event.isComposing || (event.key !== 'Enter' && event.key !== 'ArrowDown')) return;
		event.preventDefault();
		const pos = this.getPos();
		if (pos === undefined) return;
		this.fold(false);
		const { state } = this.view;
		this.view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(pos + 1), 1)).scrollIntoView());
		this.view.focus();
	};
}

const views = new WeakMap<HTMLElement, ToggleView>();

function toggleView(): MilkdownPlugin {
	return (ctx: Ctx) => async () => {
		await ctx.wait(SchemaReady);
		const entry: [string, NodeViewConstructor] = [
			TOGGLE_TYPE,
			(node, view, getPos) => {
				const toggle = new ToggleView(node, view, getPos);
				views.set(toggle.dom, toggle);
				return toggle;
			},
		];
		ctx.update(nodeViewCtx, (all) => [...all.filter(([id]) => id !== TOGGLE_TYPE), entry]);
		return () => {
			ctx.update(nodeViewCtx, (all) => all.filter(([id]) => id !== TOGGLE_TYPE));
		};
	};
}

/** Turns the block at the caret into a toggle's first block, and puts the caret in the toggle's title. */
export function wrapInToggle(view: EditorView): boolean {
	const type = view.state.schema.nodes[TOGGLE_TYPE];
	const range = view.state.selection.$from.blockRange();
	if (!type || !range) return false;
	const start = range.start;
	view.dispatch(view.state.tr.wrap(range, [{ type, attrs: { summary: '', open: false } }]).scrollIntoView());
	const dom = view.nodeDOM(start);
	const toggle = dom instanceof HTMLElement ? views.get(dom) : undefined;
	toggle?.focusSummary();
	return true;
}

export function togglePlugins(): MilkdownPlugin[] {
	return [toggleRemark, ...toggleSchema, toggleView()].flat();
}
