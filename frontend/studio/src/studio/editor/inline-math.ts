import type { Ctx, MilkdownPlugin } from '@milkdown/ctx';
import { SchemaReady, nodeViewCtx, prosePluginsCtx } from '@milkdown/kit/core';
import { Fragment, type Node as ProseMirrorNode } from '@milkdown/prose/model';
import { NodeSelection, Plugin, PluginKey, TextSelection } from '@milkdown/prose/state';
import { Decoration, DecorationSet, type EditorView, type NodeView } from '@milkdown/prose/view';

import { renderMathHtml } from '../../science/rendering/math.ts';

export type InlineMathKeyAction = 'commit' | 'exit-before' | 'exit-after' | 'delete' | 'promote';

type CaretPlace = 'all' | 'start' | 'end';

type EditState = { pos: number | null; caret: CaretPlace };

const inlineMathEditKey = new PluginKey<EditState>('inline-math-edit');

export type DollarPlan = { kind: 'math'; from: number; to: number; value: string } | { kind: 'literal'; from: number; to: number };

function escapingBackslash(parent: ProseMirrorNode, offset: number): number | null {
	let count = 0;
	while (offset - count > 0 && parent.textBetween(offset - count - 1, offset - count) === '\\') count += 1;
	if (count % 2 === 0) return null;
	return offset - 1;
}

/** Text in the run that ends at the caret. An inline atom starts a new run, so a pair cannot cross a formula. */
function textBeforeCaret(parent: ProseMirrorNode, offset: number): { text: string; fromOffset: number } {
	let text = '';
	let seen = 0;
	let fromOffset = 0;
	for (let index = 0; index < parent.childCount; index += 1) {
		const child = parent.child(index);
		if (seen >= offset) break;
		if (!child.isText) {
			text = '';
			seen += child.nodeSize;
			fromOffset = seen;
			continue;
		}
		if (seen + child.nodeSize > offset) {
			return { text: text + child.textBetween(0, offset - seen), fromOffset };
		}
		text += child.text ?? '';
		seen += child.nodeSize;
	}
	return { text, fromOffset };
}

/**
 * A `$` stays as text. It becomes inline math only when it closes a pair
 * such as `$x$`: no spaces against either delimiter, and no digit after the closer.
 * `\$` inserts a plain dollar and does not close a pair.
 */
export function planDollarMath(doc: ProseMirrorNode, from: number, to: number): DollarPlan | null {
	if (from < 0 || to < from || to > doc.content.size) return null;
	const $from = doc.resolve(from);
	const $to = doc.resolve(to);
	if (!$from.sameParent($to) || !$from.parent.isTextblock || $from.parent.type.spec.code) return null;
	if ($from.marks().some((mark) => mark.type.spec.code || mark.type.name === 'code')) return null;
	const slash = escapingBackslash($from.parent, $from.parentOffset);
	if (slash != null) return { kind: 'literal', from: $from.pos - ($from.parentOffset - slash), to };
	if (from !== to) return { kind: 'literal', from, to };
	const before = textBeforeCaret($from.parent, $from.parentOffset);
	if (!before.text) return { kind: 'literal', from, to };
	const prev = before.text[before.text.length - 1];
	if (prev === ' ' || prev === '\t' || prev === '\\' || prev === '$') return { kind: 'literal', from, to };
	const next =
		$from.parentOffset < $from.parent.content.size
			? $from.parent.textBetween($from.parentOffset, $from.parentOffset + 1)
			: '';
	if (next >= '0' && next <= '9') return { kind: 'literal', from, to };
	for (let index = before.text.length - 1; index >= 0; index -= 1) {
		if (before.text[index] !== '$') continue;
		let slashes = 0;
		for (let slashIndex = index - 1; slashIndex >= 0 && before.text[slashIndex] === '\\'; slashIndex -= 1) slashes += 1;
		if (slashes % 2 === 1) continue;
		const value = before.text.slice(index + 1);
		if (!value || value[0] === ' ' || value[0] === '\t') continue;
		return { kind: 'math', from: $from.pos - $from.parentOffset + before.fromOffset + index, to, value };
	}
	return { kind: 'literal', from, to };
}

/** Esc right after one `$` opens an inline formula. `$$` stays as text. */
export function planDollarEscape(doc: ProseMirrorNode, pos: number): { from: number; to: number } | null {
	if (pos < 0 || pos > doc.content.size) return null;
	const $pos = doc.resolve(pos);
	if (!$pos.parent.isTextblock || $pos.parent.type.spec.code) return null;
	if ($pos.marks().some((mark) => mark.type.spec.code || mark.type.name === 'code')) return null;
	const offset = $pos.parentOffset;
	if (offset < 1 || $pos.parent.textBetween(offset - 1, offset) !== '$') return null;
	if (offset >= 2 && $pos.parent.textBetween(offset - 2, offset - 1) === '$') return null;
	if (offset < $pos.parent.content.size && $pos.parent.textBetween(offset, offset + 1) === '$') return null;
	if (escapingBackslash($pos.parent, offset - 1) != null) return null;
	return { from: pos - 1, to: pos };
}

/** Enter at the end of a paragraph whose text is `$$` turns it into a LaTeX block. */
export function planDollarBlock(
	doc: ProseMirrorNode,
	pos: number,
): { from: number; to: number; nodes: ProseMirrorNode[]; cursor: number } | null {
	if (pos < 0 || pos > doc.content.size) return null;
	const $pos = doc.resolve(pos);
	if (!$pos.parent.isTextblock || $pos.parent.type.spec.code) return null;
	if ($pos.parent.textContent !== '$$' || $pos.parentOffset !== $pos.parent.content.size) return null;
	const code = doc.type.schema.nodes.code_block;
	if (!code) return null;
	const block = code.create(code.spec.attrs && 'language' in code.spec.attrs ? { language: 'LaTeX' } : null);
	const container = $pos.node($pos.depth - 1);
	const index = $pos.index($pos.depth - 1);
	let nodes: ProseMirrorNode[] = [block];
	if (!container.canReplace(index, index + 1, Fragment.from(nodes))) {
		nodes = [$pos.parent.type.create($pos.parent.attrs), block];
		if (!container.canReplace(index, index + 1, Fragment.from(nodes))) return null;
	}
	const from = $pos.before($pos.depth);
	let cursor = from;
	for (const node of nodes) {
		if (node.type === code) {
			cursor += 1;
			break;
		}
		cursor += node.nodeSize;
	}
	return { from, to: from + $pos.parent.nodeSize, nodes, cursor };
}

/** A paragraph whose text is only `$$` keeps a following space instead of becoming a formula block. */
export function planLiteralDollarChar(
	doc: ProseMirrorNode,
	from: number,
	to: number,
	text: string,
): { from: number; to: number; text: string } | null {
	if ((text !== ' ' && text !== '\n') || from !== to) return null;
	const $from = doc.resolve(from);
	if (!$from.parent.isTextblock || $from.parent.type.spec.code) return null;
	if ($from.parent.textContent !== '$$' || $from.parentOffset !== $from.parent.content.size) return null;
	return { from, to, text };
}

/**
 * An empty inline formula followed by `$` becomes a LaTeX block.
 * Surrounding text stays in its own paragraphs. A list item keeps a paragraph in front.
 */
export function planPromoteInlineMath(
	doc: ProseMirrorNode,
	pos: number,
): { from: number; to: number; nodes: ProseMirrorNode[]; cursor: number } | null {
	if (pos < 0 || pos > doc.content.size) return null;
	const math = doc.nodeAt(pos);
	if (!math || math.type.name !== 'math_inline') return null;
	const $pos = doc.resolve(pos);
	if ($pos.depth < 1 || !$pos.parent.isTextblock) return null;
	const code = doc.type.schema.nodes.code_block;
	if (!code) return null;
	const block = code.create(code.spec.attrs && 'language' in code.spec.attrs ? { language: 'LaTeX' } : null);
	const start = $pos.parentOffset;
	const before = $pos.parent.content.cut(0, start);
	const after = $pos.parent.content.cut(start + math.nodeSize);
	const nodes: ProseMirrorNode[] = [];
	if (before.size) nodes.push($pos.parent.type.create($pos.parent.attrs, before));
	nodes.push(block);
	if (after.size) nodes.push($pos.parent.type.create($pos.parent.attrs, after));
	const container = $pos.node($pos.depth - 1);
	const index = $pos.index($pos.depth - 1);
	let replacement = nodes;
	if (!container.canReplace(index, index + 1, Fragment.from(replacement))) {
		if (before.size || after.size) return null;
		replacement = [$pos.parent.type.create($pos.parent.attrs), block];
		if (!container.canReplace(index, index + 1, Fragment.from(replacement))) return null;
	}
	const from = $pos.before($pos.depth);
	let cursor = from;
	for (const node of replacement) {
		if (node.type === code) {
			cursor += 1;
			break;
		}
		cursor += node.nodeSize;
	}
	return { from, to: from + $pos.parent.nodeSize, nodes: replacement, cursor };
}

/** Keys handled by the in-place source field. A backslash keeps the following `$` in the source. `$` finishes the formula. */
export function inlineMathKeyAction(value: string, start: number, end: number, key: string): InlineMathKeyAction | null {
	if (key === 'Enter' || key === 'Escape') return 'commit';
	if (key === '$') {
		if (start === end && start > 0 && value[start - 1] === '\\') return null;
		return 'commit';
	}
	if (key === 'Backspace' || key === 'Delete') {
		if (value.length === 0 || (start === 0 && end === value.length)) return 'delete';
		return null;
	}
	if (key === 'ArrowLeft' && start === 0 && end === 0) return 'exit-before';
	if (key === 'ArrowRight' && start === value.length && end === value.length) return 'exit-after';
	return null;
}

class InlineMathView implements NodeView {
	readonly dom: HTMLElement;
	private node: ProseMirrorNode;
	private readonly view: EditorView;
	private readonly getPos: () => number | undefined;
	private input: HTMLInputElement | null = null;
	private preview: HTMLElement | null = null;
	private editing = false;
	private placed = false;
	private closing = false;
	private dead = false;
	private suppressBlur = false;

	constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined) {
		this.node = node;
		this.view = view;
		this.getPos = getPos;
		this.dom = document.createElement('span');
		this.dom.className = 'pm-inline-math';
		this.dom.addEventListener('mousedown', this.onMouseDown);
		this.dom.addEventListener('dragstart', this.onDragStart);
		if (this.editState()) this.openEditor();
		else this.renderFormula();
	}

	update(node: ProseMirrorNode): boolean {
		if (node.type !== this.node.type) return false;
		this.node = node;
		if (this.editState()) {
			if (!this.editing) this.openEditor();
			else this.renderPreview();
			return true;
		}
		if (this.editing) this.closeEditor();
		this.renderFormula();
		return true;
	}

	ignoreMutation(): boolean {
		return true;
	}

	stopEvent(event: Event): boolean {
		const target = event.target;
		return this.editing && target instanceof Node && this.dom.contains(target);
	}

	destroy(): void {
		this.dead = true;
		this.dom.removeEventListener('mousedown', this.onMouseDown);
		this.dom.removeEventListener('dragstart', this.onDragStart);
		this.detachInput();
	}

	private editState(): EditState | null {
		const state = inlineMathEditKey.getState(this.view.state);
		const pos = this.getPos();
		if (!state || state.pos == null || pos === undefined || state.pos !== pos) return null;
		return state;
	}

	private onDragStart = (event: DragEvent): void => {
		event.preventDefault();
	};

	private onMouseDown = (event: MouseEvent): void => {
		if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
		if (this.editing && event.target === this.input) {
			event.stopPropagation();
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		const pos = this.getPos();
		if (pos === undefined) return;
		if (this.editState()) {
			this.input?.focus();
			return;
		}
		// mouseup can move focus back to the editor before the field is ready.
		this.holdBlurUntilClickEnds();
		this.view.dispatch(this.view.state.tr.setMeta(inlineMathEditKey, { pos, caret: 'all' }));
		if (!this.editing) this.openEditor();
	};

	private holdBlurUntilClickEnds(): void {
		this.suppressBlur = true;
		const release = (): void => {
			document.removeEventListener('mouseup', release, true);
			window.setTimeout(() => {
				this.suppressBlur = false;
				if (this.dead || this.closing || this.view.isDestroyed || !this.editing || !this.input) return;
				if (document.activeElement !== this.input) this.input.focus();
			}, 0);
		};
		document.addEventListener('mouseup', release, true);
	}

	private onInput = (): void => {
		if (!this.input || this.closing) return;
		this.resize();
		this.renderPreview();
		const pos = this.getPos();
		if (pos === undefined) return;
		const value = this.input.value;
		const current = this.view.state.doc.nodeAt(pos);
		if (!current || current.attrs.value === value) return;
		const caret = this.editState()?.caret ?? 'all';
		this.view.dispatch(
			this.view.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, value }).setMeta(inlineMathEditKey, { pos, caret }),
		);
	};

	private onKeyDown = (event: KeyboardEvent): void => {
		if (!this.input || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
		const action = inlineMathKeyAction(this.input.value, this.input.selectionStart ?? 0, this.input.selectionEnd ?? 0, event.key);
		if (!action) return;
		event.preventDefault();
		event.stopPropagation();
		if (action === 'promote') this.promote();
		else if (action === 'delete') this.removeNode();
		else if (action === 'exit-before') this.finish(-1);
		else this.finish(1);
	};

	private onBlur = (): void => {
		window.setTimeout(() => {
			if (this.suppressBlur || this.closing || this.dead || this.view.isDestroyed || !this.editing) return;
			if (this.input && this.dom.contains(document.activeElement)) return;
			if (!this.editState()) return;
			this.finish(1);
		}, 0);
	};

	private openEditor(): void {
		if (this.editing) return;
		this.editing = true;
		this.closing = false;
		this.placed = false;
		this.dom.classList.add('is-editing');
		this.dom.classList.remove('is-error');
		const input = document.createElement('input');
		input.type = 'text';
		input.className = 'pm-inline-math-source';
		input.setAttribute('aria-label', '行内公式');
		input.spellcheck = false;
		input.autocomplete = 'off';
		input.value = String(this.node.attrs.value ?? '');
		input.addEventListener('input', this.onInput);
		input.addEventListener('keydown', this.onKeyDown);
		input.addEventListener('blur', this.onBlur);
		const preview = document.createElement('span');
		preview.className = 'pm-inline-math-preview';
		this.input = input;
		this.preview = preview;
		this.dom.replaceChildren(input, preview);
		this.resize();
		this.renderPreview();
		this.focusInput();
	}

	private focusInput(): void {
		queueMicrotask(() => {
			if (this.dead || this.closing || this.view.isDestroyed || !this.input || !this.editing) return;
			this.input.focus();
			if (this.placed) return;
			this.placed = true;
			const caret = this.editState()?.caret ?? 'all';
			const length = this.input.value.length;
			if (caret === 'start') this.input.setSelectionRange(0, 0);
			else if (caret === 'end') this.input.setSelectionRange(length, length);
			else this.input.select();
		});
	}

	private closeEditor(): void {
		this.editing = false;
		this.placed = false;
		this.dom.classList.remove('is-editing');
		this.detachInput();
		this.preview = null;
	}

	private detachInput(): void {
		this.input?.removeEventListener('input', this.onInput);
		this.input?.removeEventListener('keydown', this.onKeyDown);
		this.input?.removeEventListener('blur', this.onBlur);
		this.input = null;
	}

	private resize(): void {
		if (!this.input) return;
		this.input.style.width = `${Math.max(this.input.value.length, 1)}ch`;
	}

	private renderPreview(): void {
		if (!this.preview || !this.input) return;
		const value = this.input.value;
		if (!value) {
			this.preview.classList.add('is-empty');
			this.preview.textContent = '输入 LaTeX';
			return;
		}
		this.preview.classList.remove('is-empty');
		const result = renderMathHtml(value, false);
		this.preview.innerHTML = result.html;
		if (!result.error) return;
		const note = document.createElement('span');
		note.className = 'pm-inline-math-error';
		note.textContent = result.error;
		this.preview.append(note);
	}

	private renderFormula(): void {
		const value = String(this.node.attrs.value ?? '');
		this.dom.classList.remove('is-editing');
		if (!value) {
			const placeholder = document.createElement('span');
			placeholder.className = 'pm-inline-math-placeholder';
			placeholder.textContent = '公式';
			this.dom.replaceChildren(placeholder);
			this.dom.classList.remove('is-error');
			this.dom.removeAttribute('title');
			return;
		}
		const result = renderMathHtml(value, false);
		this.dom.innerHTML = result.html;
		this.dom.classList.toggle('is-error', Boolean(result.error));
		if (result.error) this.dom.title = result.error;
		else this.dom.removeAttribute('title');
	}

	private finish(bias: -1 | 1): void {
		if (this.closing) return;
		const pos = this.getPos();
		if (pos === undefined) return;
		const value = this.input?.value ?? String(this.node.attrs.value ?? '');
		if (!value) {
			this.removeNode();
			return;
		}
		this.closing = true;
		let tr = this.view.state.tr;
		const current = tr.doc.nodeAt(pos);
		if (current && current.attrs.value !== value) tr = tr.setNodeMarkup(pos, undefined, { ...current.attrs, value });
		const near = bias < 0 ? pos : pos + 1;
		tr = tr.setMeta(inlineMathEditKey, null).setSelection(TextSelection.near(tr.doc.resolve(near), bias)).scrollIntoView();
		this.view.dispatch(tr);
		this.view.focus();
	}

	private removeNode(): void {
		if (this.closing) return;
		const pos = this.getPos();
		if (pos === undefined) return;
		this.closing = true;
		let tr = this.view.state.tr.delete(pos, pos + 1).setMeta(inlineMathEditKey, null);
		const near = Math.max(0, Math.min(pos, tr.doc.content.size));
		tr = tr.setSelection(TextSelection.near(tr.doc.resolve(near), -1)).scrollIntoView();
		this.view.dispatch(tr);
		this.view.focus();
	}

	private promote(): void {
		if (this.closing) return;
		const pos = this.getPos();
		if (pos === undefined) return;
		const plan = planPromoteInlineMath(this.view.state.doc, pos);
		if (!plan) {
			this.removeNode();
			return;
		}
		this.closing = true;
		let tr = this.view.state.tr.replaceWith(plan.from, plan.to, plan.nodes).setMeta(inlineMathEditKey, null);
		const cursor = Math.max(0, Math.min(plan.cursor, tr.doc.content.size));
		tr = tr.setSelection(TextSelection.near(tr.doc.resolve(cursor), 1)).scrollIntoView();
		this.view.dispatch(tr);
		this.view.focus();
	}
}

function editRequest(tr: { getMeta: (key: PluginKey<EditState>) => unknown }): { pos: number; caret: CaretPlace } | null | undefined {
	const meta = tr.getMeta(inlineMathEditKey);
	if (meta === undefined) return undefined;
	if (meta === null) return null;
	if (typeof meta === 'object' && meta && 'pos' in meta && typeof meta.pos === 'number') {
		const caret = 'caret' in meta && (meta.caret === 'start' || meta.caret === 'end' || meta.caret === 'all') ? meta.caret : 'all';
		return { pos: meta.pos, caret };
	}
	return undefined;
}

const inlineMathEditPlugin: MilkdownPlugin = (ctx: Ctx) => async () => {
	await ctx.wait(SchemaReady);
	const plugin = new Plugin<EditState>({
		key: inlineMathEditKey,
		state: {
			init: () => ({ pos: null, caret: 'all' }),
			apply(tr, value) {
				const request = editRequest(tr);
				if (request === null) return { pos: null, caret: 'all' };
				if (request) return request;
				if (value.pos == null || !tr.docChanged) return value;
				const mapped = tr.mapping.mapResult(value.pos);
				if (mapped.deleted) return { pos: null, caret: 'all' };
				const node = tr.doc.nodeAt(mapped.pos);
				if (!node || node.type.name !== 'math_inline') return { pos: null, caret: 'all' };
				return { pos: mapped.pos, caret: value.caret };
			},
		},
		props: {
			decorations(state) {
				const editing = inlineMathEditKey.getState(state);
				if (!editing || editing.pos == null) return DecorationSet.empty;
				const node = state.doc.nodeAt(editing.pos);
				if (!node || node.type.name !== 'math_inline') return DecorationSet.empty;
				return DecorationSet.create(state.doc, [
					Decoration.node(editing.pos, editing.pos + node.nodeSize, { class: 'pm-inline-math-active' }),
				]);
			},
			handleTextInput(view, from, to, text) {
				if (view.composing) return false;
				const literalChar = planLiteralDollarChar(view.state.doc, from, to, text);
				if (literalChar) {
					view.dispatch(view.state.tr.insertText(literalChar.text, literalChar.from, literalChar.to).scrollIntoView());
					return true;
				}
				if (text !== '$') return false;
				const plan = planDollarMath(view.state.doc, from, to);
				if (!plan) return false;
				if (plan.kind === 'literal') {
					view.dispatch(view.state.tr.insertText('$', plan.from, plan.to).scrollIntoView());
					return true;
				}
				const math = view.state.schema.nodes.math_inline;
				if (!math) return false;
				const node = math.create({ value: plan.value });
				let tr = view.state.tr.replaceWith(plan.from, plan.to, node);
				const cursor = Math.min(plan.from + node.nodeSize, tr.doc.content.size);
				tr = tr.setSelection(TextSelection.near(tr.doc.resolve(cursor), 1)).scrollIntoView();
				view.dispatch(tr);
				return true;
			},
			handleKeyDown(view, event) {
				if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey || event.isComposing) return false;
				const selection = view.state.selection;
				if (!(selection instanceof TextSelection) || !selection.empty) return false;
				if (event.key === 'Escape') {
					const escapePlan = planDollarEscape(view.state.doc, selection.from);
					const math = view.state.schema.nodes.math_inline;
					if (!escapePlan || !math) return false;
					const node = math.create({ value: '' });
					let tr = view.state.tr.replaceWith(escapePlan.from, escapePlan.to, node);
					tr = tr.setMeta(inlineMathEditKey, { pos: escapePlan.from, caret: 'start' }).scrollIntoView();
					view.dispatch(tr);
					return true;
				}
				if (event.key === 'Enter') {
					const blockPlan = planDollarBlock(view.state.doc, selection.from);
					if (!blockPlan) return false;
					let tr = view.state.tr.replaceWith(blockPlan.from, blockPlan.to, blockPlan.nodes);
					const cursor = Math.max(0, Math.min(blockPlan.cursor, tr.doc.content.size));
					tr = tr.setSelection(TextSelection.near(tr.doc.resolve(cursor), 1)).scrollIntoView();
					view.dispatch(tr);
					return true;
				}
				if (event.key === 'ArrowRight' && selection.$from.nodeAfter?.type.name === 'math_inline') {
					view.dispatch(view.state.tr.setMeta(inlineMathEditKey, { pos: selection.$from.pos, caret: 'start' }));
					return true;
				}
				const before = selection.$from.nodeBefore;
				if (event.key === 'ArrowLeft' && before?.type.name === 'math_inline') {
					view.dispatch(view.state.tr.setMeta(inlineMathEditKey, { pos: selection.$from.pos - before.nodeSize, caret: 'end' }));
					return true;
				}
				return false;
			},
		},
		view(editorView) {
			return {
				update(view) {
					const selection = view.state.selection;
					if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'math_inline') return;
					if (inlineMathEditKey.getState(view.state)?.pos === selection.from) return;
					const pos = selection.from;
					queueMicrotask(() => {
						if (editorView.isDestroyed) return;
						const current = editorView.state.selection;
						if (!(current instanceof NodeSelection) || current.from !== pos || current.node.type.name !== 'math_inline') return;
						editorView.dispatch(
							editorView.state.tr
								.setMeta(inlineMathEditKey, { pos, caret: 'all' })
								.setSelection(TextSelection.near(editorView.state.doc.resolve(pos), -1)),
						);
					});
				},
			};
		},
	});
	ctx.update(prosePluginsCtx, (plugins) => [plugin, ...plugins]);
	return () => {
		ctx.update(prosePluginsCtx, (plugins) => plugins.filter((item) => item !== plugin));
	};
};

const inlineMathViewPlugin: MilkdownPlugin = (ctx: Ctx) => async () => {
	await ctx.wait(SchemaReady);
	ctx.update(nodeViewCtx, (views) => [
		...views.filter(([id]) => id !== 'math_inline'),
		['math_inline', (node, view, getPos) => new InlineMathView(node, view, getPos)],
	]);
	return () => {
		ctx.update(nodeViewCtx, (views) => views.filter(([id]) => id !== 'math_inline'));
	};
};

export const inlineMathPlugins = [inlineMathEditPlugin, inlineMathViewPlugin];
