import type { Ctx, MilkdownPlugin } from '@milkdown/ctx';
import { SchemaReady, nodeViewCtx, prosePluginsCtx } from '@milkdown/kit/core';
import type { Node as ProseMirrorNode } from '@milkdown/prose/model';
import { NodeSelection, Plugin, TextSelection, type Selection } from '@milkdown/prose/state';
import type { Decoration, EditorView, NodeView } from '@milkdown/prose/view';

import { renderMathHtml } from '../../science/rendering/math.ts';
import { equationLabels, equationNumbers, numberedSource, referencesKey } from './equation-numbers.ts';
import { isFormulaBlock } from './formula-block.ts';
import { renderWhileTyping } from './formula-typing.ts';
import { SourcePopup } from './source-popup.ts';

const openBlocks = new Set<DisplayMathView>();

function paintFormula(host: HTMLElement, source: string, emptyLabel: string, view: EditorView): void {
	host.classList.remove('is-empty', 'is-error');
	if (!source.trim()) {
		host.classList.add('is-empty');
		host.textContent = emptyLabel;
		return;
	}
	const result = renderMathHtml(source, true, equationLabels(view.state));
	host.innerHTML = result.html;
	host.querySelectorAll('.katex-mathml').forEach((node) => node.remove());
	host.classList.toggle('is-error', Boolean(result.error));
}

/**
 * The popup says what is wrong with the source, the formula itself showing
 * in place. What is still being typed at the caret is not wrong yet; a
 * mistake shows once the typing stops (the CSS waits).
 */
function paintError(host: HTMLElement, source: string, caret: number, view: EditorView): void {
	const drawn = renderWhileTyping({ source, typed: source, caret, display: true, labels: equationLabels(view.state), lastGood: null });
	const error = drawn.state === 'ok' || drawn.state === 'typing' ? undefined : drawn.error;
	host.hidden = !error;
	host.replaceChildren();
	if (!error) return;
	const message = document.createElement('p');
	message.className = 'pm-source-popup-error is-late';
	message.textContent = error;
	host.append(message);
}

/** The number written into a formula (`\tag{3}` at its end), put back on what is written so far. */
function keepNumber(numbered: string, typed: string): ((written: string) => string) | undefined {
	const tag = /\\tag\*?\{[^{}]*\}\s*$/.exec(numbered)?.[0];
	if (!tag || /\\tag/.test(typed)) return undefined;
	return (written) => `${written} ${tag.trim()}`;
}

class DisplayMathView implements NodeView {
	readonly dom: HTMLElement;
	private node: ProseMirrorNode;
	private readonly view: EditorView;
	private readonly getPos: () => number | undefined;
	private readonly formula: HTMLElement;
	private popup: SourcePopup | null = null;
	private writing = false;
	/** The source with its number, as drawn. */
	private numbered: string;
	/** What the references it shows stand for. */
	private references: string;
	private drawn: string | null = null;
	/** The last good drawing while the source is being typed. */
	private lastGood: string | null = null;

	constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined, decorations: readonly Decoration[]) {
		this.node = node;
		this.numbered = numberedSource(node, decorations);
		this.references = referencesKey(decorations);
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

	update(node: ProseMirrorNode, decorations: readonly Decoration[]): boolean {
		if (node.type !== this.node.type || !isFormulaBlock(node)) return false;
		this.node = node;
		this.numbered = numberedSource(node, decorations);
		this.references = referencesKey(decorations);
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
		const input = this.popup?.input;
		const caret = input ? input.selectionStart : -1;
		const key = `${this.numbered}\n${this.references}\n${caret}`;
		if (key === this.drawn) return;
		this.drawn = key;
		if (!input || !this.numbered.trim()) {
			this.lastGood = null;
			paintFormula(this.formula, this.numbered, '公式', this.view);
			return;
		}
		// Being typed: drawn as far as it is written, never red while the typing goes on.
		const typed = this.node.textContent;
		const drawn = renderWhileTyping({
			source: this.numbered,
			typed,
			caret,
			display: true,
			labels: equationLabels(this.view.state),
			lastGood: this.lastGood,
			decorate: keepNumber(this.numbered, typed),
		});
		this.formula.classList.remove('is-empty', 'is-error');
		this.formula.innerHTML = drawn.html;
		this.formula.querySelectorAll('.katex-mathml').forEach((node) => node.remove());
		this.formula.classList.toggle('is-stale', drawn.state === 'stale');
		if (drawn.state === 'ok' || drawn.state === 'typing') this.lastGood = this.formula.innerHTML;
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
		// The formula stays where it is and follows the typing, so the text around it does not move.
		this.dom.classList.add('is-open');
		openBlocks.add(this);
		this.popup = new SourcePopup({
			label: '行间公式',
			placeholder: '输入 LaTeX',
			value: this.node.textContent,
			rows: 2,
			variant: 'is-formula',
			placement: 'below',
			owner: this.dom,
			anchor: () => this.formula.getBoundingClientRect(),
			width: () => 440,
			maxInputHeight: () => 160,
			preview: (host, value) => paintError(host, value, this.popup?.input.selectionStart ?? value.length, this.view),
			latex: true,
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
		this.popup?.destroy();
		this.popup = null;
		openBlocks.delete(this);
		// Left: drawn as it is, mistakes and all.
		this.formula.classList.remove('is-stale');
		this.renderFormula();
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
				(node, view, getPos, decorations) => {
					if (!isFormulaBlock(node)) return fallback?.(node, view, getPos as () => number | undefined);
					return new DisplayMathView(node, view, getPos as () => number | undefined, decorations);
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

export const displayMathPlugins = [equationNumbers, displayMathPlugin];
