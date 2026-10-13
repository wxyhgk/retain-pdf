import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { addBlockTypeCommand, clearTextInCurrentBlockCommand, htmlSchema } from '@milkdown/kit/preset/commonmark';
import type { Node as ProseMirrorNode } from '@milkdown/prose/model';
import { NodeSelection, Plugin, TextSelection } from '@milkdown/prose/state';
import type { EditorView, NodeView } from '@milkdown/prose/view';
import { $node, $prose, $remark, $view } from '@milkdown/utils';

import { droppedHtmlTags, isUnsafeUrl } from '../../plugins/article-html-policy.mjs';
import {
	HTML_BLOCK_STARTER,
	HTML_BLOCK_TYPE,
	isLineBreakHtml,
	liftHtmlBlocks,
	planHtmlBlockLift,
} from './article-html.ts';

let editNextHtmlBlock = false;

function mountSanitized(host: HTMLElement, source: string): void {
	const template = document.createElement('template');
	template.innerHTML = source;
	const fragment = template.content;
	fragment.querySelectorAll([...droppedHtmlTags].join(',')).forEach((node) => node.remove());
	fragment.querySelectorAll('*').forEach((element) => {
		for (const attr of [...element.attributes]) {
			const name = attr.name.toLowerCase();
			if (name.startsWith('on') || name === 'srcdoc') {
				element.removeAttribute(attr.name);
				continue;
			}
			if (['href', 'src', 'action', 'poster'].includes(name) && isUnsafeUrl(attr.value)) {
				element.removeAttribute(attr.name);
			}
		}
	});
	host.replaceChildren(fragment);
	if (host.childNodes.length === 0 && /<script[\s>/]/i.test(source)) {
		const note = document.createElement('p');
		note.className = 'pm-html-omitted';
		note.textContent = '脚本不会在页面中运行';
		host.append(note);
	}
}

export const htmlBlockSchema = $node(HTML_BLOCK_TYPE, () => ({
	atom: true,
	group: 'block',
	selectable: true,
	attrs: { value: { default: '' } },
	parseDOM: [
		{
			tag: 'div[data-html-block]',
			getAttrs: (dom: HTMLElement) => ({ value: dom.dataset.value ?? '' }),
		},
	],
	toDOM: (node: ProseMirrorNode) => [
		'div',
		{ 'data-html-block': '', 'data-value': String(node.attrs.value ?? '') },
	],
	parseMarkdown: {
		match: (node: { type?: string }) => node.type === HTML_BLOCK_TYPE,
		runner: (state: { addNode: (type: unknown, attrs: { value: string }) => void }, node: { value?: unknown }, type: unknown) => {
			state.addNode(type, { value: typeof node.value === 'string' ? node.value : '' });
		},
	},
	toMarkdown: {
		match: (node: ProseMirrorNode) => node.type.name === HTML_BLOCK_TYPE,
		runner: (state: { addNode: (type: string, attrs: undefined, value: string) => void }, node: ProseMirrorNode) => {
			state.addNode('html', undefined, String(node.attrs.value ?? ''));
		},
	},
}));

class HtmlBlockView implements NodeView {
	readonly dom: HTMLElement;
	private node: ProseMirrorNode;
	private readonly view: EditorView;
	private readonly getPos: () => number | undefined;
	private readonly renderHost: HTMLElement;
	private readonly editButton: HTMLButtonElement;
	private source: HTMLTextAreaElement | null = null;
	private writing = false;

	constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined) {
		this.node = node;
		this.view = view;
		this.getPos = getPos;
		this.dom = document.createElement('div');
		this.dom.className = 'pm-html-block article-html';
		this.dom.dataset.htmlBlock = '';
		this.dom.dataset.value = String(node.attrs.value ?? '');
		this.renderHost = document.createElement('div');
		this.renderHost.className = 'pm-html-render';
		this.editButton = document.createElement('button');
		this.editButton.type = 'button';
		this.editButton.className = 'pm-html-edit';
		this.editButton.textContent = '编辑';
		this.dom.append(this.renderHost, this.editButton);
		this.editButton.addEventListener('mousedown', (event) => {
			event.preventDefault();
			event.stopPropagation();
		});
		this.editButton.addEventListener('click', () => {
			if (this.source) this.closeSource();
			else this.openSource();
		});
		this.dom.addEventListener('mousedown', (event) => {
			if (event.button !== 0 || this.source) return;
			if (event.target instanceof Node && this.editButton.contains(event.target)) return;
			event.preventDefault();
			const pos = this.getPos();
			if (pos === undefined) return;
			const selected = this.view.state.selection;
			if (!(selected instanceof NodeSelection) || selected.from !== pos) {
				this.view.dispatch(this.view.state.tr.setSelection(NodeSelection.create(this.view.state.doc, pos)));
			}
		});
		this.paint(String(node.attrs.value ?? ''));
		if (editNextHtmlBlock) {
			editNextHtmlBlock = false;
			queueMicrotask(() => this.openSource());
		}
	}

	update(node: ProseMirrorNode): boolean {
		if (node.type !== this.node.type) return false;
		this.node = node;
		const value = String(node.attrs.value ?? '');
		this.dom.dataset.value = value;
		if (this.writing) return true;
		if (this.source && this.source.value !== value) {
			this.source.value = value;
			this.fitSource();
		}
		if (!this.source) this.paint(value);
		return true;
	}

	ignoreMutation(): boolean {
		return true;
	}

	stopEvent(event: Event): boolean {
		const target = event.target;
		if (!(target instanceof Node)) return false;
		return Boolean(this.source?.contains(target) || this.editButton.contains(target));
	}

	destroy(): void {
		this.source?.remove();
		this.source = null;
	}

	private paint(value: string): void {
		mountSanitized(this.renderHost, value);
	}

	private openSource(): void {
		if (this.source) return;
		const source = document.createElement('textarea');
		source.className = 'pm-html-source';
		source.spellcheck = false;
		source.setAttribute('aria-label', 'HTML 源码');
		source.value = String(this.node.attrs.value ?? '');
		this.dom.classList.add('is-editing');
		this.editButton.textContent = '完成';
		this.dom.append(source);
		this.source = source;
		source.addEventListener('input', this.onInput);
		source.addEventListener('keydown', this.onKeyDown);
		this.fitSource();
		source.focus();
		const end = source.value.length;
		source.setSelectionRange(end, end);
	}

	private closeSource(): void {
		const source = this.source;
		if (!source) return;
		const value = source.value;
		source.removeEventListener('input', this.onInput);
		source.removeEventListener('keydown', this.onKeyDown);
		source.remove();
		this.source = null;
		this.dom.classList.remove('is-editing');
		this.editButton.textContent = '编辑';
		this.writeSource(value, false);
		this.paint(value);
		this.view.focus();
	}

	private onInput = (): void => {
		if (!this.source) return;
		this.fitSource();
		this.writeSource(this.source.value, true);
	};

	private onKeyDown = (event: KeyboardEvent): void => {
		if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) {
			event.preventDefault();
			event.stopPropagation();
			this.closeSource();
			return;
		}
		if (
			event.key === 'Backspace' &&
			this.source &&
			this.source.value === '' &&
			this.source.selectionStart === 0 &&
			this.source.selectionEnd === 0
		) {
			event.preventDefault();
			this.removeBlock();
		}
	};

	private fitSource(): void {
		const source = this.source;
		if (!source) return;
		source.style.height = 'auto';
		source.style.height = `${Math.min(source.scrollHeight, 280)}px`;
	}

	private writeSource(value: string, keepSelection: boolean): void {
		const pos = this.getPos();
		if (pos === undefined) return;
		const current = this.view.state.doc.nodeAt(pos);
		if (!current || String(current.attrs.value ?? '') === value) return;
		const next = current.type.create({ ...current.attrs, value });
		this.writing = true;
		let tr = this.view.state.tr.replaceWith(pos, pos + current.nodeSize, next);
		if (keepSelection) tr = tr.setSelection(NodeSelection.create(tr.doc, pos));
		this.view.dispatch(tr);
		this.writing = false;
	}

	private removeBlock(): void {
		const pos = this.getPos();
		if (pos === undefined) return;
		const node = this.view.state.doc.nodeAt(pos);
		const paragraph = this.view.state.schema.nodes.paragraph;
		if (!node || !paragraph) return;
		this.source?.remove();
		this.source = null;
		const tr = this.view.state.tr.replaceWith(pos, pos + node.nodeSize, paragraph.create());
		tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1), 1));
		this.view.dispatch(tr.scrollIntoView());
		this.view.focus();
	}
}

function inlineHtmlView(node: ProseMirrorNode): NodeView {
	const value = String(node.attrs.value ?? '');
	if (isLineBreakHtml(value)) {
		const dom = document.createElement('br');
		return {
			dom,
			update: (next) => next.type === node.type && isLineBreakHtml(String(next.attrs.value ?? '')),
			ignoreMutation: () => true,
		};
	}
	const dom = document.createElement('span');
	dom.className = 'pm-html-inline';
	mountSanitized(dom, value);
	return {
		dom,
		update: (next) => {
			if (next.type !== node.type || isLineBreakHtml(String(next.attrs.value ?? ''))) return false;
			mountSanitized(dom, String(next.attrs.value ?? ''));
			return true;
		},
		ignoreMutation: () => true,
	};
}

export const htmlBlockView = $view(htmlBlockSchema, () => {
	return (node, view, getPos) => new HtmlBlockView(node, view, getPos as () => number | undefined);
});

export const inlineHtmlViewPlugin = $view(htmlSchema, () => {
	return (node) => inlineHtmlView(node);
});

export const htmlBlockRemark = $remark('html-block-lift', () => liftHtmlBlocks());

export const htmlBlockSync = $prose(
	() =>
		new Plugin({
			appendTransaction(_transactions, _oldState, state) {
				const htmlBlock = state.schema.nodes[HTML_BLOCK_TYPE];
				if (!htmlBlock) return null;
				const lifts = planHtmlBlockLift(state.doc);
				if (!lifts.length) return null;
				let tr = state.tr;
				for (const lift of lifts.reverse()) {
					tr = tr.replaceWith(lift.from, lift.to, htmlBlock.create({ value: lift.value }));
				}
				return tr;
			},
		}),
);

const htmlSlashIcon =
	'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m8 8-4 4 4 4M16 8l4 4-4 4"/></svg>';

type SlashMenuBuilder = {
	addGroup: (
		key: string,
		label: string,
	) => {
		addItem: (key: string, item: { label: string; icon: string; onRun: (ctx: never) => void }) => unknown;
	};
};

/** Slash entry that inserts a rendered HTML block and opens its source. */
export function buildHtmlSlashMenu(builder: SlashMenuBuilder): void {
	const group = builder.addGroup('html', 'HTML');
	group.addItem('html-block', {
		label: 'HTML',
		icon: htmlSlashIcon,
		onRun: (ctx) => {
			editNextHtmlBlock = true;
			queueMicrotask(() => {
				editNextHtmlBlock = false;
			});
			const context = ctx as { get: (slice: unknown) => never };
			const commands = context.get(commandsCtx) as { call: (key: unknown, payload?: unknown) => void };
			commands.call(clearTextInCurrentBlockCommand.key);
			commands.call(addBlockTypeCommand.key, {
				nodeType: htmlBlockSchema.type(ctx as Parameters<typeof htmlBlockSchema.type>[0]),
				attrs: { value: HTML_BLOCK_STARTER },
			});
		},
	});
}
