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
	// Formula blocks, and blocks of plugins that say so (chemistry), select themselves and open their source.
	'.pm-display-math',
	'[data-owns-pointer]',
	// The gap between columns is pressed to make one wider (columns-block.ts).
	'.columns-block.is-over-gap',
	'button',
	'a',
	'input',
	'textarea',
	'select',
].join(', ');

/** How near the top or bottom of the editor a selecting drag scrolls it, and how fast at the edge (px a second). */
const EDGE_PX = 32;
const EDGE_SPEED = 720;

/**
 * A press in the margin; `end` when it was below the last block; `top`, where it was in the scrolled page. `text`: a
 * press among the blocks, a selection of text till it goes into another block (then blocks, as Notion has it).
 */
type Press = { x: number; y: number; top: number; anchor: number; moved: boolean; end: boolean; text?: boolean; fromText?: boolean };

/** Where a press among the blocks is not one that selects (a button, a field, a link, a menu). */
const NOT_SELECTING = [
	'.document-header',
	'.milkdown-block-handle',
	'.milkdown-block-menu',
	'.milkdown-slash-menu',
	'.milkdown-toolbar',
	'.pm-math-preview',
	'.pm-source-popup',
	'[data-owns-pointer]',
	'.columns-block.is-over-gap',
	'button',
	'a',
	'input',
	'textarea',
	'select',
].join(', ');

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

/** What holds blocks side by side: the block under the pointer in it is the one across from it. */
const SIDE_BY_SIDE = new Set(['columns']);

/**
 * The block on screen at (x, y), as deep in the blocks as it goes (into a callout, a toggle, a list, a column), as
 * Notion finds it: by where each block is drawn, not by the text there. So a picture, code, a formula, a widget is
 * found as any line is. Between two blocks, the nearer; above the first or below the last, that one.
 */
export function blockAt(view: EditorView, x: number, y: number): number | null {
	let container: ProseNode = view.state.doc;
	let base = 0;
	let found: number | null = null;
	for (;;) {
		const across = SIDE_BY_SIDE.has(container.type.name);
		let best: { pos: number; node: ProseNode; distance: number } | null = null;
		container.forEach((node, offset) => {
			const pos = base + offset;
			const dom = view.nodeDOM(pos);
			if (!(dom instanceof HTMLElement)) return;
			const box = dom.getBoundingClientRect();
			// Not drawn (in a toggle that is shut): not there to be found.
			if (!box.width && !box.height) return;
			const [low, high, at] = across ? [box.left, box.right, x] : [box.top, box.bottom, y];
			const distance = at < low ? low - at : at > high ? at - high : 0;
			if (!best || distance < best.distance) best = { pos, node, distance };
		});
		if (!best) return found;
		const chosen: { pos: number; node: ProseNode } = best;
		found = chosen.pos;
		if (!chosen.node.childCount || !(HOLDS_BLOCKS.has(chosen.node.type.name) || SIDE_BY_SIDE.has(chosen.node.type.name))) return found;
		container = chosen.node;
		base = chosen.pos + 1;
	}
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

/** A block of lines of text (a paragraph, a heading, a list's item): what text is selected across. Not code. */
function holdsText(node: ProseNode | null): boolean {
	if (!node) return false;
	if (node.type.name === 'list_item') return Boolean(node.firstChild?.isTextblock);
	return node.isTextblock && !node.type.spec.code;
}

/**
 * While a drag begun among the blocks selects blocks: the browser goes on selecting text as the pointer moves (the press
 * was its own), and ProseMirror would take that as the selection; it is not taken, till the button is let go.
 */
let holdingBlocks = false;

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
		if (!end && !isBlockPointer(this.view, event)) {
			this.watchTextPress(event);
			return;
		}
		const anchor = blockPosAt(this.view, event.clientX, event.clientY);
		if (anchor == null) return;
		event.preventDefault();
		event.stopPropagation();
		const scroller = this.scroller();
		const top = scroller ? event.clientY - scroller.getBoundingClientRect().top + scroller.scrollTop : event.clientY;
		this.press = { x: event.clientX, y: event.clientY, top, anchor, moved: false, end };
		this.root.classList.add('pm-block-dragging');
		this.scroller()?.addEventListener('scroll', this.onScroll);
		document.addEventListener('mousemove', this.onMouseMove, true);
		document.addEventListener('mouseup', this.onMouseUp, true);
		document.addEventListener('selectstart', this.onSelectStart, true);
		this.view.focus();
	};

	/**
	 * A press among the blocks: the browser's (text selected, the caret put), till the pointer goes into a block that is
	 * not lines of text (code, a picture, a formula), or from one into another. The blocks from the one pressed in to
	 * that one are then selected, whole, as Notion has them. The browser is let go on with the press; it is not let
	 * select further.
	 */
	private watchTextPress(event: MouseEvent): void {
		if (event.button !== 0 || event.composedPath().some((node) => node instanceof Element && node.matches(NOT_SELECTING))) return;
		if (!event.composedPath().includes(this.view.dom)) return;
		const anchor = blockAt(this.view, event.clientX, event.clientY);
		if (anchor == null) return;
		const scroller = this.scroller();
		const top = scroller ? event.clientY - scroller.getBoundingClientRect().top + scroller.scrollTop : event.clientY;
		this.press = { x: event.clientX, y: event.clientY, top, anchor, moved: false, end: false, text: true };
		this.scroller()?.addEventListener('scroll', this.onScroll);
		document.addEventListener('mousemove', this.onMouseMove, true);
		document.addEventListener('mouseup', this.onMouseUp, true);
	}

	private onMouseMove = (event: MouseEvent): void => {
		const press = this.press;
		if (!press) return;
		if (press.text) {
			if (!event.buttons) {
				this.stop();
				return;
			}
			const at = blockAt(this.view, event.clientX, event.clientY);
			if (at === null || at === press.anchor) return;
			// From a line to another, text still (the end of one paragraph and the start of the next, as SiYuan has it).
			if (holdsText(this.view.state.doc.nodeAt(at)) && holdsText(this.view.state.doc.nodeAt(press.anchor))) return;
			// Into a block that is not lines of text (code, a picture, a formula, a table), or from one: blocks from now on.
			press.text = false;
			press.fromText = true;
			press.moved = true;
			holdingBlocks = true;
			this.root.classList.add('pm-block-dragging');
			document.addEventListener('selectstart', this.onSelectStart, true);
			getSelection()?.removeAllRanges();
			this.view.focus();
			this.pointer = { x: event.clientX, y: event.clientY };
			this.extendTo(event.clientX, event.clientY);
			this.scrollNearEdge();
			return;
		}
		if (!press.moved && Math.hypot(event.clientX - press.x, event.clientY - press.y) < 5) return;
		press.moved = true;
		event.preventDefault();
		this.pointer = { x: event.clientX, y: event.clientY };
		this.extendTo(event.clientX, event.clientY);
		this.drawMarquee();
		this.scrollNearEdge();
	};

	/** The box being dragged out, as Notion draws it: from the press to the pointer, in the page as it scrolls. */
	private marquee: HTMLElement | null = null;

	/** Drawn for a drag begun in the margin (one begun in a block, as Notion has it, draws none). */
	private drawMarquee(): void {
		const press = this.press;
		const pointer = this.pointer;
		const scroller = this.scroller();
		if (!press?.moved || press.fromText || !pointer || !scroller) return;
		const box = scroller.getBoundingClientRect();
		const top = pointer.y - box.top + scroller.scrollTop;
		const left = Math.min(press.x, pointer.x) - box.left + scroller.scrollLeft;
		if (!this.marquee) {
			this.marquee = document.createElement('div');
			this.marquee.className = 'pm-block-marquee';
			scroller.append(this.marquee);
		}
		Object.assign(this.marquee.style, {
			left: `${left}px`,
			top: `${Math.min(press.top, top)}px`,
			width: `${Math.abs(pointer.x - press.x)}px`,
			height: `${Math.abs(top - press.top)}px`,
		});
	}

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
		// The press where it is in the page now (it may have scrolled since), inside the blocks' column.
		const scroller = this.scroller();
		const pressY = scroller ? press.top - scroller.scrollTop + scroller.getBoundingClientRect().top : press.y;
		const box = contentBox(this.view);
		const inside = (at: number) => Math.min(Math.max(at, box.contentLeft + 1), box.contentRight - 1);
		const anchor = blockAt(this.view, inside(press.x), pressY);
		const head = blockAt(this.view, inside(x), y);
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
		if (!this.press?.moved || !this.pointer) return;
		this.extendTo(this.pointer.x, this.pointer.y);
		this.drawMarquee();
	};

	private onMouseUp = (event: MouseEvent): void => {
		const press = this.press;
		this.stop();
		if (press?.text) return;
		// Begun among the blocks, the press is the browser's and ProseMirror's too: they read the selection back once it
		// is over; the blocks are selected again after.
		if (press?.fromText) {
			// After ProseMirror has read the browser's selection back (which is let go of then): the blocks still.
			setTimeout(() => {
				holdingBlocks = false;
				getSelection()?.removeAllRanges();
				this.view.focus();
			});
		}

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
		if (!this.press?.fromText) holdingBlocks = false;
		this.marquee?.remove();
		this.marquee = null;
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
			filterTransaction: (tr) => !(holdingBlocks && tr.selectionSet && !tr.docChanged && !(tr.selection instanceof BlockRangeSelection)),
			props: {
				decorations: blockDecorations,
				// While blocks are selected, the browser's own selection of their text is not shown (the CSS).
				attributes: (state): Record<string, string> => (state.selection instanceof BlockRangeSelection ? { class: 'pm-has-block-range' } : {}),
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
