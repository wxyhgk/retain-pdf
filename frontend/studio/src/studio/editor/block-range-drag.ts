import { blockMenuAPI } from '@milkdown/crepe/feature/block-edit';
import { TextSelection } from '@milkdown/prose/state';
import { Decoration, DecorationSet } from '@milkdown/prose/view';
import type { Node as ProseNode } from '@milkdown/prose/model';
import type { EditorView } from '@milkdown/prose/view';
import { Plugin } from '@milkdown/prose/state';
import { $prose } from '@milkdown/utils';

import { writeAtEnd } from './block-keys.ts';
import { BlockRangeSelection, blockRangeKey, selectableBlock } from './block-range.ts';

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
	// The gap between columns is pressed to make one wider (columns-block.ts).
	'.columns-block.is-over-gap',
	'.science-block',
	'button',
	'a',
	'input',
	'textarea',
	'select',
].join(', ');

/** How near the top or bottom of the editor a selecting drag scrolls it, and how fast at the edge (px a second). */
const EDGE_PX = 32;
const EDGE_SPEED = 720;

/** A press in the margin; `end` when it was below the last block. */
type Press = { x: number; y: number; anchor: number; moved: boolean; end: boolean };

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

function ignoredTarget(event: MouseEvent): boolean {
	return event.composedPath().some((node) => node instanceof Element && node.matches(IGNORED_TARGET));
}

/**
 * True when the pointer is in the margin round the blocks, not among them. A
 * press among the blocks (on text, or the blank beside a short line) is the
 * browser's: the caret goes there at once, a drag selects text (as SiYuan has
 * it; Esc then makes blocks of what is selected).
 */
export function isBlockPointer(view: EditorView, event: MouseEvent): boolean {
	if (event.button !== 0 || ignoredTarget(event)) return false;
	const scroll = view.dom.closest('.editor-scroll');
	const onEditor = event.composedPath().includes(view.dom);
	const onScroll = scroll ? event.composedPath().includes(scroll) : onEditor;
	if (!onScroll) return false;
	const box = contentBox(view);
	if (event.clientY < box.top || event.clientY > box.bottom) return false;
	if (event.clientX < box.contentLeft || event.clientX > box.contentRight) return true;
	return event.clientY < box.contentTop || event.clientY > box.contentBottom;
}

/** Whether the pointer is in the blank space below the last block (in the editor's scrolling area). */
export function isBelowLastBlock(view: EditorView, event: MouseEvent): boolean {
	if (event.button !== 0 || ignoredTarget(event)) return false;
	const scroll = view.dom.closest('.editor-scroll');
	if (!(scroll ? event.composedPath().includes(scroll) : event.composedPath().includes(view.dom))) return false;
	const { doc } = view.state;
	if (!doc.lastChild) return false;
	const last = view.nodeDOM(doc.content.size - doc.lastChild.nodeSize);
	if (!(last instanceof HTMLElement)) return false;
	return event.clientY > last.getBoundingClientRect().bottom + 2;
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

/** What holds blocks one after another, whose blocks a drag can select on their own. */
const HOLDS_BLOCKS = new Set(['doc', 'column', 'callout', 'toggle', 'blockquote', 'bullet_list', 'ordered_list']);

/** A place as deep in the blocks at (x, y) as it goes: in the text of a line, or before a block with none (a figure). */
function deepPosAt(view: EditorView, clientX: number, clientY: number): number | null {
	const { doc } = view.state;
	const rect = view.dom.getBoundingClientRect();
	if (clientY <= rect.top) return 0;
	if (clientY >= rect.bottom) return doc.content.size;
	const coords = pointerCoords(view, clientX, clientY);
	if (!coords) return null;
	const node = coords.inside >= 0 ? doc.nodeAt(coords.inside) : null;
	return node && (node.isAtom || node.isLeaf) ? coords.inside : coords.pos;
}

/**
 * Where a drag from the margin starts in the blocks: at the press (the edge of
 * the blocks) or, when that is the edge of a callout or quote (between its
 * blocks), further in on that line, where the drag has gone (the inner edge
 * of the box it spans): the block there. Not if further in is another block
 * altogether (the next column): the drag spans both.
 */
function anchorPosAt(view: EditorView, pressX: number, innerX: number, y: number): number | null {
	const edge = deepPosAt(view, pressX, y);
	const inner = deepPosAt(view, innerX, y);
	if (edge == null || inner == null) return edge ?? inner;
	const $edge = view.state.doc.resolve(edge);
	return $edge.parent.isTextblock || view.state.doc.resolve(inner).sharedDepth(edge) < $edge.depth ? edge : inner;
}

/** The blocks from the one at `a` to the one at `b`, at the deepest level that holds both (HOLDS_BLOCKS). */
export function blocksBetween(doc: ProseNode, a: number, b: number): BlockRangeSelection | null {
	const $a = doc.resolve(a);
	const $b = doc.resolve(b);
	let depth = $a.sharedDepth(b);
	while (depth > 0 && !HOLDS_BLOCKS.has($a.node(depth).type.name)) depth -= 1;
	const anchor = depth < $a.depth ? $a.before(depth + 1) : a;
	const head = depth < $b.depth ? $b.before(depth + 1) : b;
	return BlockRangeSelection.tryCreate(doc, anchor, head);
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
		const end = isBelowLastBlock(this.view, event);
		if (!end && !isBlockPointer(this.view, event)) return;
		const anchor = blockPosAt(this.view, event.clientX, event.clientY);
		if (anchor == null) return;
		event.preventDefault();
		event.stopPropagation();
		this.press = { x: event.clientX, y: event.clientY, anchor, moved: false, end };
		this.root.classList.add('pm-block-dragging');
		this.scroller()?.addEventListener('scroll', this.onScroll);
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
		this.pointer = { x: event.clientX, y: event.clientY };
		this.extendTo(event.clientX, event.clientY);
		this.scrollNearEdge();
	};

	/** Where the pointer was last seen while blocks are being selected. */
	private pointer: { x: number; y: number } | null = null;
	private frame = 0;

	/**
	 * The selection taken to the block at (x, y), as deep in the blocks as
	 * both ends are (as SiYuan has it): both in one column, callout, toggle,
	 * quote or list, the blocks in it; otherwise the blocks holding them
	 * (from one column into the next, the columns whole).
	 */
	private extendTo(x: number, y: number): void {
		const press = this.press;
		if (!press) return;
		const anchor = anchorPosAt(this.view, press.x, Math.max(press.x, x), press.y);
		const head = deepPosAt(this.view, x, y);
		const next = anchor == null || head == null ? null : blocksBetween(this.view.state.doc, anchor, head);
		if (!next || this.view.state.selection.eq(next)) return;
		this.view.dispatch(this.view.state.tr.setSelection(next));
	}

	/** The box that scrolls the editor. */
	private scroller(): HTMLElement | null {
		const scroller = this.root.classList.contains('editor-scroll') ? this.root : this.view.dom.closest('.editor-scroll');
		return scroller instanceof HTMLElement ? scroller : null;
	}

	/**
	 * Near the top or bottom of the editor, it scrolls for as long as the
	 * pointer is held there (as SiYuan has it), faster nearer the edge, the
	 * selection going on with it; not a step at each move of the pointer.
	 */
	private scrollNearEdge(): void {
		if (this.frame) return;
		let last = 0;
		const step = (time: number) => {
			this.frame = 0;
			const scroller = this.scroller();
			const pointer = this.pointer;
			if (!this.press?.moved || !pointer || !scroller) return;
			const box = scroller.getBoundingClientRect();
			const depth = pointer.y < box.top + EDGE_PX ? pointer.y - (box.top + EDGE_PX) : pointer.y > box.bottom - EDGE_PX ? pointer.y - (box.bottom - EDGE_PX) : 0;
			if (!depth) return;
			const elapsed = last ? Math.min(50, time - last) : 16;
			last = time;
			const speed = Math.max(-1, Math.min(1, depth / EDGE_PX)) * EDGE_SPEED;
			scroller.scrollTop += (speed * elapsed) / 1000;
			this.frame = requestAnimationFrame(step);
		};
		this.frame = requestAnimationFrame(step);
	}

	/** The editor scrolled under the pointer (by the wheel, or near the edge): the selection follows to the block now there. */
	private onScroll = (): void => {
		if (this.press?.moved && this.pointer) this.extendTo(this.pointer.x, this.pointer.y);
	};

	private onMouseUp = (event: MouseEvent): void => {
		const press = this.press;
		this.stop();
		if (!press || press.moved) {
			this.view.focus();
			return;
		}
		// A click below the last block: writing goes on in an empty paragraph at the end.
		if (press.end) {
			writeAtEnd(this.view.state, (tr) => this.view.dispatch(tr));
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
		this.pointer = null;
		cancelAnimationFrame(this.frame);
		this.frame = 0;
		this.scroller()?.removeEventListener('scroll', this.onScroll);
		this.root.classList.remove('pm-block-dragging');
		document.removeEventListener('mousemove', this.onMouseMove, true);
		document.removeEventListener('mouseup', this.onMouseUp, true);
		document.removeEventListener('selectstart', this.onSelectStart, true);
	}
}

let anchor: HTMLElement | null = null;

/** A point on the page for a menu to open at: where the pointer is. */
function pointerAnchor(x: number, y: number): HTMLElement {
	anchor ??= Object.assign(document.createElement('div'), { className: 'pm-pointer-anchor' });
	Object.assign(anchor.style, { position: 'fixed', left: `${x}px`, top: `${y}px`, width: '0', height: '0', pointerEvents: 'none' });
	if (!anchor.isConnected) document.body.append(anchor);
	return anchor;
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

/** Dragging from the margin selects blocks instead of glyphs. */
export const blockRangePlugin = $prose(
	(ctx) =>
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
					// A right click on blocks selected: their menu, where the pointer is
					// (as SiYuan has it), not the browser's.
					contextmenu(view, event) {
						const { selection } = view.state;
						if (!(selection instanceof BlockRangeSelection) || ignoredTarget(event)) return false;
						const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
						if (!at || at.pos < selection.from || at.pos > selection.to) return false;
						event.preventDefault();
						ctx.get(blockMenuAPI.key).toggle(selection.from, pointerAnchor(event.clientX, event.clientY));
						return true;
					},
					// A press among blocks that are selected: the blocks are let go of
					// before the browser acts on the press, so that one press puts the
					// caret there (or, ⇧ held, takes the selection to that block). As
					// SiYuan has it: the browser never sees a press inside what is
					// selected, which it would wait to the button's release to act on,
					// or drag.
					mousedown(view, event) {
						const { selection } = view.state;
						if (!(selection instanceof BlockRangeSelection)) return false;
						if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || ignoredTarget(event)) return false;
						if (event.shiftKey) {
							const head = blockPosAt(view, event.clientX, event.clientY);
							const next = head == null ? null : BlockRangeSelection.tryCreate(view.state.doc, selection.anchor, head);
							if (!next) return false;
							event.preventDefault();
							view.dispatch(view.state.tr.setSelection(next));
							return true;
						}
						const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
						if (!at) return false;
						view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(at.pos))));
						return false;
					},
					// A key right after a click is for where the click put the caret:
					// the browser tells of that caret a moment later (selectionchange),
					// so what it has is read first.
					keydown(view) {
						if (!view.composing) (view as unknown as { domObserver: { flush(): void } }).domObserver.flush();
						return false;
					},
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
