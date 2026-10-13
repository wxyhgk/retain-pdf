import type { Ctx, MilkdownPlugin } from '@milkdown/ctx';
import { SchemaReady, nodeViewCtx, prosePluginsCtx } from '@milkdown/kit/core';
import type { Node as ProseMirrorNode } from '@milkdown/prose/model';
import { NodeSelection, Plugin, TextSelection, type Selection } from '@milkdown/prose/state';
import type { EditorView, NodeView } from '@milkdown/prose/view';

import { renderMathHtml } from '../../science/rendering/math.ts';
import { SourcePopup } from './source-popup.ts';

const openBlocks = new Set<DisplayMathView>();

function isLatex(node: ProseMirrorNode): boolean {
	return String(node.attrs.language ?? '').toLowerCase() === 'latex';
}

function paintFormula(host: HTMLElement, source: string, emptyLabel: string, showError: boolean): void {
	host.classList.remove('is-empty', 'is-error');
	if (!source.trim()) {
		host.classList.add('is-empty');
		host.textContent = emptyLabel;
		return;
	}
	const result = renderMathHtml(source, true);
	host.innerHTML = result.html;
	host.querySelectorAll('.katex-mathml').forEach((node) => node.remove());
	host.classList.toggle('is-error', Boolean(result.error));
	if (!showError || !result.error) return;
	const error = document.createElement('p');
	error.className = 'pm-source-popup-error';
	error.textContent = result.error;
	host.append(error);
}

class DisplayMathView implements NodeView {
	readonly dom: HTMLElement;
	private node: ProseMirrorNode;
	private readonly view: EditorView;
	private readonly getPos: () => number | undefined;
	private readonly formula: HTMLElement;
	private popup: SourcePopup | null = null;
	private writing = false;

	constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined) {
		this.node = node;
		this.view = view;
		this.getPos = getPos;
		this.dom = document.createElement('div');
		this.dom.className = 'pm-display-math';
		this.formula = document.createElement('div');
		this.formula.className = 'pm-display-math-formula';
		this.dom.append(this.formula);
		this.dom.addEventListener('mousedown', this.onMouseDown);
		this.renderFormula();
	}

	update(node: ProseMirrorNode): boolean {
		if (node.type !== this.node.type || !isLatex(node)) return false;
		this.node = node;
		this.renderFormula();
		if (!this.writing) this.popup?.setValue(node.textContent);
		return true;
	}

	selectNode(): void {
		this.open();
	}

	deselectNode(): void {
		this.teardown();
	}

	setSelection(): void {
		this.open();
	}

	ignoreMutation(): boolean {
		return true;
	}

	destroy(): void {
		this.dom.removeEventListener('mousedown', this.onMouseDown);
		this.teardown();
	}

	holds(selection: Selection): boolean {
		if (!this.popup) return false;
		const pos = this.getPos();
		if (pos === undefined) return false;
		const node = this.view.state.doc.nodeAt(pos);
		if (!node) return false;
		if (selection instanceof NodeSelection) return selection.from === pos;
		return selection.from > pos && selection.to < pos + node.nodeSize;
	}

	private renderFormula(): void {
		paintFormula(this.formula, this.node.textContent, '公式', false);
	}

	private onMouseDown = (event: MouseEvent): void => {
		if (event.button !== 0 || this.popup?.contains(event.target as Node)) return;
		event.preventDefault();
		event.stopPropagation();
		const pos = this.getPos();
		if (pos === undefined) return;
		const selected = this.view.state.selection;
		if (!(selected instanceof NodeSelection) || selected.from !== pos) {
			this.view.dispatch(this.view.state.tr.setSelection(NodeSelection.create(this.view.state.doc, pos)));
		}
		this.open();
	};

	private open(): void {
		if (this.popup) return;
		this.dom.classList.add('is-open');
		this.formula.setAttribute('aria-hidden', 'true');
		openBlocks.add(this);
		this.popup = new SourcePopup({
			label: '行间公式',
			placeholder: '输入 LaTeX',
			value: this.node.textContent,
			rows: 2,
			placement: 'over',
			owner: this.dom,
			// The in-document formula is hidden while the popup is open, so anchor on the block.
			anchor: () => {
				const block = this.dom.getBoundingClientRect();
				const host = this.dom.closest('.crepe-host')?.getBoundingClientRect();
				return block.width > 8 ? block : host ?? block;
			},
			width: () => 440,
			maxInputHeight: () => 160,
			preview: (host, value) => paintFormula(host, value, '预览', true),
			onInput: (value) => this.writeSource(value),
			onFinish: () => this.finish(),
			onRemove: () => this.removeBlock(),
			onDismiss: () => this.teardown(),
		});
		// Opening can happen inside a dispatch whose caller refocuses the editor afterwards.
		queueMicrotask(() => this.popup?.focus());
	}

	private teardown(): void {
		this.dom.classList.remove('is-open');
		this.formula.removeAttribute('aria-hidden');
		this.popup?.destroy();
		this.popup = null;
		openBlocks.delete(this);
	}

	private writeSource(value: string): void {
		const pos = this.getPos();
		if (pos === undefined) return;
		const current = this.view.state.doc.nodeAt(pos);
		if (!current || current.textContent === value) return;
		const next = current.type.create(current.attrs, value ? this.view.state.schema.text(value) : null);
		this.writing = true;
		const tr = this.view.state.tr.replaceWith(pos, pos + current.nodeSize, next);
		tr.setSelection(NodeSelection.create(tr.doc, pos));
		this.view.dispatch(tr);
		this.writing = false;
	}

	private finish(): void {
		const pos = this.getPos();
		const node = pos === undefined ? null : this.view.state.doc.nodeAt(pos);
		this.teardown();
		if (pos === undefined || !node) {
			this.view.focus();
			return;
		}
		const after = pos + node.nodeSize;
		const $after = this.view.state.doc.resolve(after);
		const next = $after.nodeAfter;
		const before = this.view.state.doc.resolve(pos).nodeBefore;
		let tr = this.view.state.tr;
		let cursor = after;
		if (next?.isTextblock && !next.type.spec.code) {
			cursor = after + 1;
		} else if (before?.isTextblock && !before.type.spec.code) {
			cursor = pos - 1;
		} else {
			const paragraph = this.view.state.schema.nodes.paragraph;
			if (!paragraph) {
				this.view.focus();
				return;
			}
			tr = tr.insert(after, paragraph.create());
			cursor = after + 1;
		}
		this.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, cursor)).scrollIntoView());
		this.view.focus();
	}

	private removeBlock(): void {
		const pos = this.getPos();
		if (pos === undefined) return;
		const node = this.view.state.doc.nodeAt(pos);
		const paragraph = this.view.state.schema.nodes.paragraph;
		if (!node || !paragraph) return;
		this.teardown();
		const tr = this.view.state.tr.replaceWith(pos, pos + node.nodeSize, paragraph.create());
		tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1), 1));
		this.view.dispatch(tr.scrollIntoView());
		this.view.focus();
	}
}

const displayMathPlugin: MilkdownPlugin = (ctx: Ctx) => async () => {
	await ctx.wait(SchemaReady);
	let fallback: ((node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined) => NodeView | null | undefined) | undefined;
	ctx.update(nodeViewCtx, (views) => {
		const existing = views.filter(([id]) => id === 'code_block');
		fallback = existing[existing.length - 1]?.[1] as typeof fallback;
		return [
			...views.filter(([id]) => id !== 'code_block'),
			[
				'code_block',
				(node, view, getPos) => {
					if (!isLatex(node)) return fallback?.(node, view, getPos as () => number | undefined);
					return new DisplayMathView(node, view, getPos as () => number | undefined);
				},
			],
		];
	});
	const plugin = new Plugin({
		view() {
			return {
				update(view) {
					const selection = view.state.selection;
					for (const block of openBlocks) {
						if (!block.holds(selection)) block.deselectNode();
					}
				},
			};
		},
	});
	ctx.update(prosePluginsCtx, (plugins) => [plugin, ...plugins]);
	return () => {
		ctx.update(prosePluginsCtx, (plugins) => plugins.filter((item) => item !== plugin));
		ctx.update(nodeViewCtx, (views) => {
			const rest = views.filter(([id]) => id !== 'code_block');
			return fallback ? [...rest, ['code_block', fallback]] : rest;
		});
	};
};

export const displayMathPlugins = [displayMathPlugin];
