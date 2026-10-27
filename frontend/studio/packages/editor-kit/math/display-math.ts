import type { Ctx, MilkdownPlugin } from '@milkdown/ctx';
import { SchemaReady, nodeViewCtx, prosePluginsCtx } from '@milkdown/kit/core';
import type { Node as ProseMirrorNode } from '@milkdown/prose/model';
import { NodeSelection, Plugin, Selection, TextSelection } from '@milkdown/prose/state';
import type { Decoration, EditorView, NodeView, NodeViewConstructor } from '@milkdown/prose/view';

import { breakIntoLines } from '@blog/science/rendering/line-breaks.mjs';
import { renderMathHtml } from '@blog/science/rendering/math.ts';
import { equationLabels, equationNumbers, numberedSource, referencesKey } from './equation-numbers.ts';
import { isFormulaBlock } from './formula-block.ts';
import { renderWhileTyping } from './formula-typing.ts';
import { drawNow, drawWhenNear, drawsLater, isWaiting } from '../near-screen.ts';
import { SourcePopup } from './source-popup.ts';
import { createVisualMath, type VisualMath } from './visual-math.ts';
import { t } from '@blog/i18n/index.mjs';

const openBlocks = new Set<DisplayMathView>();
/** Each formula's view, by its element: ↩ or a key typed on one selected opens it. */
const formulaViews = new WeakMap<Node, DisplayMathView>();

function paintFormula(host: HTMLElement, source: string, emptyLabel: string, view: EditorView): void {
	host.classList.remove('is-empty', 'is-error');
	if (!source.trim()) {
		host.classList.add('is-empty');
		host.textContent = emptyLabel;
		return;
	}
	const labels = equationLabels(view.state);
	const result = renderMathHtml(source, true, labels);
	host.innerHTML = result.html;
	// As on the blog: its lines, hidden after it, shown when it is wider than the page (fit-formulas.ts).
	const lines = result.error ? null : breakIntoLines(source);
	const broken = lines ? renderMathHtml(lines, true, labels) : null;
	if (broken && !broken.error) {
		const holder = document.createElement('div');
		holder.innerHTML = broken.html;
		const display = holder.querySelector<HTMLElement>('.katex-display');
		if (display) {
			display.classList.add('katex-broken');
			display.hidden = true;
			host.append(display);
		}
	}
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

class DisplayMathView implements NodeView {
	readonly dom: HTMLElement;
	private node: ProseMirrorNode;
	private readonly view: EditorView;
	private readonly getPos: () => number | undefined;
	private readonly formula: HTMLElement;
	private popup: SourcePopup | null = null;
	/** Edited as it looks (visual-math.ts), in place of its drawing; `opening` while MathLive is being loaded. */
	private visual: VisualMath | null = null;
	private opening = false;
	/** 源码 asked for: edited as LaTeX till it is left. */
	private asSource = false;
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
		formulaViews.set(this.dom, this);
		// In a long article, or one being opened, drawn once near the screen; its LaTeX till then.
		if (drawsLater(view)) {
			this.formula.textContent = node.textContent;
			drawWhenNear(view.dom, this.dom, () => this.renderFormula());
		} else this.renderFormula();
	}

	update(node: ProseMirrorNode, decorations: readonly Decoration[]): boolean {
		if (node.type !== this.node.type || !isFormulaBlock(node)) return false;
		this.node = node;
		this.numbered = numberedSource(node, decorations);
		this.references = referencesKey(decorations);
		if (isWaiting(this.dom)) this.formula.textContent = node.textContent;
		else this.renderFormula();
		if (!this.writing) {
			this.popup?.setValue(node.textContent);
			this.visual?.set(node.textContent);
		}
		return true;
	}

	// Come to with the arrow keys (or by ⌫ beside it), it is a stop: marked,
	// not opened (as SiYuan has it); the next arrow goes on past it. A click,
	// ↩ or a key typed opens it.
	selectNode(): void {
		this.dom.classList.add('is-selected');
	}

	deselectNode(): void {
		this.dom.classList.remove('is-selected');
		this.teardown();
	}

	/** Opened from the keyboard: ↩, or a key typed (put at the end of its source). */
	edit(typed = ''): void {
		this.open(typed);
		if (!typed || !this.popup) return;
		const value = this.node.textContent + typed;
		this.popup.setValue(value);
		this.popup.input.setSelectionRange(value.length, value.length);
		this.writeSource(value);
	}

	setSelection(): void {
		this.open();
	}

	ignoreMutation(): boolean {
		return true;
	}

	/** What happens in the formula being edited as it looks is its own, not the editor's (⌫ would take the block). */
	stopEvent(event: Event): boolean {
		return Boolean(this.visual?.owns(event.target));
	}

	destroy(): void {
		this.dom.removeEventListener('mousedown', this.onMouseDown);
		this.teardown();
	}

	holds(selection: Selection): boolean {
		if (!this.popup && !this.visual && !this.opening) return false;
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
			paintFormula(this.formula, this.numbered, t('公式'), this.view);
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
		});
		this.formula.classList.remove('is-empty', 'is-error');
		this.formula.innerHTML = drawn.html;
		this.formula.querySelectorAll('.katex-mathml').forEach((node) => node.remove());
		this.formula.classList.toggle('is-stale', drawn.state === 'stale');
		if (drawn.state === 'ok' || drawn.state === 'typing') this.lastGood = this.formula.innerHTML;
	}

	private onMouseDown = (event: MouseEvent): void => {
		if (event.button !== 0 || this.popup?.contains(event.target as Node) || this.visual?.owns(event.target)) return;
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

	/**
	 * Opened: edited as it looks (MathLive), in place; as LaTeX in the popup under it when 源码 was asked for, or when
	 * MathLive does not know something in it. `typed`: the key that opened it.
	 */
	private open(typed = ''): void {
		if (this.popup || this.visual || this.opening) return;
		if (this.asSource) {
			this.openSource();
			return;
		}
		drawNow(this.dom);
		this.dom.classList.add('is-open');
		openBlocks.add(this);
		this.opening = true;
		void createVisualMath(this.dom, this.node.textContent, {
			input: (value) => this.writeSource(value),
			finish: () => this.finish(),
			exit: (side) => this.exit(side),
			remove: () => this.removeBlock(),
			source: () => {
				this.closeVisual();
				this.asSource = true;
				this.openSource();
			},
		}).then(
			(visual) => {
				this.opening = false;
				// Left meanwhile.
				if (!this.dom.classList.contains('is-open')) {
					visual?.destroy();
					return;
				}
				if (!visual) {
					this.openSource();
					return;
				}
				this.visual = visual;
				this.dom.classList.add('is-visual');
				document.addEventListener('pointerdown', this.onPointerDownOutside, true);
				visual.focus();
				if (typed) visual.type(typed);
			},
			() => {
				this.opening = false;
				this.openSource();
			},
		);
	}

	/** A press outside the formula and MathLive's menus: it is left. */
	private onPointerDownOutside = (event: PointerEvent): void => {
		if (this.visual?.owns(event.target) || this.dom.contains(event.target as Node)) return;
		this.teardown();
	};

	private closeVisual(): void {
		document.removeEventListener('pointerdown', this.onPointerDownOutside, true);
		// What was typed last, not told yet: written in, after whatever closed it (it may be the editor's own update).
		const typed = this.visual?.changed();
		if (typed != null && typed !== this.node.textContent) queueMicrotask(() => this.writeSource(typed, false));
		this.visual?.destroy();
		this.visual = null;
		this.dom.classList.remove('is-visual');
	}

	/** Edited as LaTeX, in the popup under it. */
	private openSource(): void {
		if (this.popup) return;
		drawNow(this.dom);
		// The formula stays where it is and follows the typing, so the text around it does not move.
		this.dom.classList.add('is-open');
		openBlocks.add(this);
		this.popup = new SourcePopup({
			label: t('行间公式'),
			placeholder: t('输入 LaTeX'),
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
			onExit: (side) => this.exit(side),
		});
		// Opening can happen inside a dispatch whose caller refocuses the editor afterwards.
		queueMicrotask(() => this.popup?.focus());
	}

	private teardown(): void {
		this.dom.classList.remove('is-open');
		this.closeVisual();
		this.asSource = false;
		this.popup?.destroy();
		this.popup = null;
		openBlocks.delete(this);
		// Left: drawn as it is, mistakes and all.
		this.formula.classList.remove('is-stale');
		this.renderFormula();
	}

	/** The formula's source made `value`; the formula selected after (not when written in as it is left). */
	private writeSource(value: string, select = true): void {
		const pos = this.getPos();
		if (pos === undefined) return;
		const current = this.view.state.doc.nodeAt(pos);
		if (!current || current.textContent === value) return;
		const next = current.type.create(current.attrs, value ? this.view.state.schema.text(value) : null);
		this.writing = true;
		const tr = this.view.state.tr.replaceWith(pos, pos + current.nodeSize, next);
		if (select) tr.setSelection(NodeSelection.create(tr.doc, pos));
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

	/** Out by an arrow key at the source's edge: the caret before or after the formula. */
	private exit(side: -1 | 1): void {
		const pos = this.getPos();
		const node = pos === undefined ? null : this.view.state.doc.nodeAt(pos);
		this.teardown();
		if (pos === undefined || !node) return;
		const $at = this.view.state.doc.resolve(side < 0 ? pos : pos + node.nodeSize);
		this.view.dispatch(this.view.state.tr.setSelection(Selection.near($at, side)).scrollIntoView());
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

const ARROWS: Record<string, { side: -1 | 1; dir: 'up' | 'down' | 'left' | 'right' }> = {
	ArrowUp: { side: -1, dir: 'up' },
	ArrowLeft: { side: -1, dir: 'left' },
	ArrowDown: { side: 1, dir: 'down' },
	ArrowRight: { side: 1, dir: 'right' },
};

/**
 * Where the formula next to the caret (at the edge of its line) or to the
 * block selected is, if one is there. The arrow key selects it whole: left to
 * ProseMirror, it would put the caret in its source, and open it.
 */
function formulaBeside(view: EditorView, side: -1 | 1, dir: 'up' | 'down' | 'left' | 'right'): number | null {
	const { selection, doc } = view.state;
	let edge: number;
	if (selection instanceof NodeSelection && selection.node.isBlock) edge = side < 0 ? selection.from : selection.to;
	else if (selection instanceof TextSelection && selection.empty && selection.$from.depth > 0 && view.endOfTextblock(dir)) {
		edge = side < 0 ? selection.$from.before() : selection.$from.after();
	} else return null;
	const $edge = doc.resolve(edge);
	const node = side < 0 ? $edge.nodeBefore : $edge.nodeAfter;
	if (!node || !isFormulaBlock(node)) return null;
	return side < 0 ? edge - node.nodeSize : edge;
}

/** A node's view, as Milkdown lists them (`nodeViewCtx`). */
type ViewEntry = [id: string, view: NodeViewConstructor];

const displayMathPlugin: MilkdownPlugin = (ctx: Ctx) => async () => {
	await ctx.wait(SchemaReady);
	let fallback: ((node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined) => NodeView | null | undefined) | undefined;
	ctx.update(nodeViewCtx, (views): ViewEntry[] => {
		const existing = views.filter(([id]) => id === 'code_block');
		fallback = existing[existing.length - 1]?.[1] as typeof fallback;
		return [
			...views.filter(([id]) => id !== 'code_block'),
			[
				'code_block',
				// None for a block of code that is not a formula, without a view before this one: ProseMirror draws it itself.
				((node, view, getPos, decorations) => {
					if (!isFormulaBlock(node)) return fallback?.(node, view, getPos as () => number | undefined);
					return new DisplayMathView(node, view, getPos as () => number | undefined, decorations);
				}) as NodeViewConstructor,
			],
		];
	});
	/** The formula selected whole, if one is. */
	const selectedFormula = (view: EditorView) => {
		const { selection } = view.state;
		if (!(selection instanceof NodeSelection) || !isFormulaBlock(selection.node)) return null;
		return formulaViews.get(view.nodeDOM(selection.from) as Node) ?? null;
	};
	const plugin = new Plugin({
		props: {
			handleKeyDown(view, event) {
				const arrow = ARROWS[event.key];
				if (arrow) {
					if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return false;
					const at = formulaBeside(view, arrow.side, arrow.dir);
					if (at == null) return false;
					view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, at)).scrollIntoView());
					return true;
				}
				if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey || event.isComposing) return false;
				const formula = selectedFormula(view);
				if (!formula) return false;
				formula.edit();
				return true;
			},
			handleTextInput(view, _from, _to, text) {
				const formula = selectedFormula(view);
				if (!formula) return false;
				formula.edit(text);
				return true;
			},
		},
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
		ctx.update(nodeViewCtx, (views): ViewEntry[] => {
			const rest = views.filter(([id]) => id !== 'code_block');
			return fallback ? [...rest, ['code_block', fallback as NodeViewConstructor]] : rest;
		});
	};
};

export const displayMathPlugins = [equationNumbers, displayMathPlugin];
