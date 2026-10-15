import { TextSelection } from '@milkdown/prose/state';
import { Decoration, DecorationSet } from '@milkdown/prose/view';
import type { EditorView } from '@milkdown/prose/view';
import { Plugin } from '@milkdown/prose/state';
import { $prose } from '@milkdown/utils';

import { BlockRangeSelection, blockRangeKey, selectableBlock } from './block-range.ts';

const BLANK_SNAP_PX = 24;

const IGNORED_TARGET = [
	'.document-header',
	'.milkdown-block-handle',
	'.milkdown-block-menu',
	'.milkdown-slash-menu',
	'.milkdown-toolbar',
	'.cm-editor',
	'.pm-inline-math',
	'.pm-math-preview',
	'.chem-stage',
	// Formula and chemistry blocks select themselves and open their source popup.
	'.pm-display-math',
	'.science-block',
	'button',
	'a',
	'input',
	'textarea',
	'select',
].join(', ');

type Press = { x: number; y: number; anchor: number; moved: boolean };

function contentBox(view: EditorView) {
	const rect = view.dom.getBoundingClientRect();
	const style = getComputedStyle(view.dom);
	return {
		top: rect.top,
		bottom: rect.bottom,
		contentLeft: rect.left + (parseFloat(style.paddingLeft) || 0),
		contentRight: rect.right - (parseFloat(style.paddingRight) || 0),
		contentTop: rect.top + (parseFloat(style.paddingTop) || 0),
		contentBottom: rect.bottom - (parseFloat(style.paddingBottom) || 0),
	};
}

function caretPoint(x: number, y: number): { x: number; y: number; height: number } | null {
	const doc = document as Document & {
		caretRangeFromPoint?: (x: number, y: number) => Range | null;
		caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
	};
	let range: Range | null = null;
	if (doc.caretRangeFromPoint) range = doc.caretRangeFromPoint(x, y);
	else if (doc.caretPositionFromPoint) {
		const position = doc.caretPositionFromPoint(x, y);
		if (position) {
			const node = position.offsetNode;
			const max = node.nodeType === Node.TEXT_NODE ? (node.textContent?.length ?? 0) : node.childNodes.length;
			range = document.createRange();
			range.setStart(node, Math.min(position.offset, max));
			range.collapse(true);
		}
	}
	if (!range) return null;
	const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
	if (!rect || rect.height === 0) return null;
	return { x: rect.left, y: rect.top + rect.height / 2, height: rect.height };
}

function ignoredTarget(event: MouseEvent): boolean {
	return event.composedPath().some((node) => node instanceof Element && node.matches(IGNORED_TARGET));
}

/** True when the pointer is in the margin or on blank space beside a line, not on glyphs. */
export function isBlockPointer(view: EditorView, event: MouseEvent): boolean {
	if (event.button !== 0 || ignoredTarget(event)) return false;
	const scroll = view.dom.closest('.editor-scroll');
	const onEditor = event.composedPath().includes(view.dom);
	const onScroll = scroll ? event.composedPath().includes(scroll) : onEditor;
	if (!onScroll) return false;
	const box = contentBox(view);
	if (event.clientY < box.top || event.clientY > box.bottom) return false;
	if (event.clientX < box.contentLeft || event.clientX > box.contentRight) return true;
	if (event.clientY < box.contentTop || event.clientY > box.contentBottom) return true;
	if (!onEditor) return false;
	const caret = caretPoint(event.clientX, event.clientY);
	if (!caret) return true;
	const dx = Math.abs(event.clientX - caret.x);
	const dy = Math.abs(event.clientY - caret.y);
	return dx > BLANK_SNAP_PX || dy > Math.max(BLANK_SNAP_PX, caret.height);
}

function pointerCoords(view: EditorView, clientX: number, clientY: number) {
	const box = contentBox(view);
	const x = Math.min(Math.max(clientX, box.contentLeft + 4), Math.max(box.contentLeft + 4, box.contentRight - 4));
	const y = Math.min(Math.max(clientY, box.contentTop + 2), Math.max(box.contentTop + 2, box.contentBottom - 2));
	return view.posAtCoords({ left: x, top: y });
}

function blockPosAt(view: EditorView, clientX: number, clientY: number): number | null {
	const doc = view.state.doc;
	if (!doc.lastChild) return null;
	const rect = view.dom.getBoundingClientRect();
	if (clientY <= rect.top) return selectableBlock(doc, 0)?.pos ?? 0;
	if (clientY >= rect.bottom) return selectableBlock(doc, doc.content.size)?.pos ?? doc.content.size - doc.lastChild.nodeSize;
	const coords = pointerCoords(view, clientX, clientY);
	if (!coords) return selectableBlock(doc, doc.content.size)?.pos ?? null;
	return selectableBlock(doc, coords.pos)?.pos ?? null;
}

class BlockRangeDrag {
	readonly root: HTMLElement;
	readonly view: EditorView;
	private press: Press | null = null;

	constructor(view: EditorView) {
		this.view = view;
		this.root = view.dom.closest('.editor-scroll') ?? view.dom.parentElement ?? view.dom;
		this.root.addEventListener('mousedown', this.onMouseDown, true);
	}

	destroy(): void {
		this.root.removeEventListener('mousedown', this.onMouseDown, true);
		this.stop();
	}

	private onMouseDown = (event: MouseEvent): void => {
		if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return;
		if (!isBlockPointer(this.view, event)) return;
		const anchor = blockPosAt(this.view, event.clientX, event.clientY);
		if (anchor == null) return;
		event.preventDefault();
		event.stopPropagation();
		this.press = { x: event.clientX, y: event.clientY, anchor, moved: false };
		this.root.classList.add('pm-block-dragging');
		document.addEventListener('mousemove', this.onMouseMove, true);
		document.addEventListener('mouseup', this.onMouseUp, true);
		document.addEventListener('selectstart', this.onSelectStart, true);
		this.view.focus();
	};

	private onMouseMove = (event: MouseEvent): void => {
		const press = this.press;
		if (!press) return;
		if (!press.moved && Math.hypot(event.clientX - press.x, event.clientY - press.y) < 5) return;
		press.moved = true;
		event.preventDefault();
		const head = blockPosAt(this.view, event.clientX, event.clientY);
		if (head == null) return;
		const next = BlockRangeSelection.tryCreate(this.view.state.doc, press.anchor, head);
		if (!next || this.view.state.selection.eq(next)) return;
		this.view.dispatch(this.view.state.tr.setSelection(next));
		this.nudgeScroll(event.clientY);
	};

	private onMouseUp = (event: MouseEvent): void => {
		const press = this.press;
		this.stop();
		if (!press || press.moved) {
			this.view.focus();
			return;
		}
		const coords = pointerCoords(this.view, event.clientX, event.clientY);
		if (coords) {
			const box = contentBox(this.view);
			const bias = event.clientX < box.contentLeft ? -1 : 1;
			const selection = TextSelection.near(this.view.state.doc.resolve(coords.pos), bias);
			this.view.dispatch(this.view.state.tr.setSelection(selection));
		}
		this.view.focus();
	};

	private onSelectStart = (event: Event): void => {
		if (this.press) event.preventDefault();
	};

	private stop(): void {
		this.press = null;
		this.root.classList.remove('pm-block-dragging');
		document.removeEventListener('mousemove', this.onMouseMove, true);
		document.removeEventListener('mouseup', this.onMouseUp, true);
		document.removeEventListener('selectstart', this.onSelectStart, true);
	}

	private nudgeScroll(clientY: number): void {
		const scroller = this.root.classList.contains('editor-scroll') ? this.root : this.view.dom.closest('.editor-scroll');
		if (!(scroller instanceof HTMLElement)) return;
		const box = scroller.getBoundingClientRect();
		if (clientY < box.top + 28) scroller.scrollTop -= 18;
		else if (clientY > box.bottom - 28) scroller.scrollTop += 18;
	}
}

function blockDecorations(state: EditorView['state']): DecorationSet | null {
	const selection = state.selection;
	if (!(selection instanceof BlockRangeSelection)) return null;
	const decorations: Decoration[] = [];
	state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
		if (!node.isBlock || pos < selection.from || pos + node.nodeSize > selection.to) return;
		if (node.type.name === 'bullet_list' || node.type.name === 'ordered_list') return;
		decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'pm-block-range' }));
		return false;
	});
	return DecorationSet.create(state.doc, decorations);
}

/** Dragging from the margin or from blank space selects blocks instead of glyphs. */
export const blockRangePlugin = $prose(
	() =>
		new Plugin({
			props: {
				decorations: blockDecorations,
				handleKeyDown(view, event) {
					return blockRangeKey(view.state, event, (tr) => view.dispatch(tr));
				},
				handleTextInput(view, _from, _to, text) {
					return blockRangeKey(view.state, { key: text, text }, (tr) => view.dispatch(tr));
				},
				handleDOMEvents: {
					compositionstart(view) {
						if (!(view.state.selection instanceof BlockRangeSelection)) return false;
						blockRangeKey(view.state, { key: 'Enter' }, (tr) => view.dispatch(tr));
						return false;
					},
				},
			},
			view(editorView) {
				const drag = new BlockRangeDrag(editorView);
				return { destroy: () => drag.destroy() };
			},
		}),
);
