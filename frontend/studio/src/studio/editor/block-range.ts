import type { Node as ProseNode } from 'prosemirror-model';
import { Selection, SelectionRange, TextSelection, type EditorState } from '@milkdown/prose/state';
import type { Mappable } from '@milkdown/prose/transform';

function topBlock(doc: ProseNode, pos: number): { pos: number; node: ProseNode } | null {
	if (!doc.childCount) return null;
	const clamped = Math.max(0, Math.min(pos, doc.content.size));
	const inside = clamped === doc.content.size ? clamped - 1 : clamped;
	const $pos = doc.resolve(inside);
	if ($pos.depth < 1) {
		const after = doc.nodeAt(clamped);
		return after?.isBlock ? { pos: clamped, node: after } : null;
	}
	return { pos: $pos.before(1), node: $pos.node(1) };
}

const LIST = new Set(['bullet_list', 'ordered_list']);

export type BlockSpan = {
	from: number;
	to: number;
	anchor: number;
	head: number;
};

/**
 * The block a pointer is aiming at. List items and quotes stay whole.
 * Anywhere else, the block is the top-level node.
 */
export function selectableBlock(doc: ProseNode, pos: number): { pos: number; node: ProseNode } | null {
	if (!doc.childCount) return null;
	const clamped = Math.max(0, Math.min(pos, doc.content.size));
	const $at = doc.resolve(clamped);
	const after = $at.nodeAfter;
	if (after && LIST.has(after.type.name) && after.firstChild) {
		return { pos: clamped + 1, node: after.firstChild };
	}
	if (after?.isBlock && !LIST.has(after.type.name)) {
		if ($at.parent.type.name === 'list_item') return { pos: $at.before($at.depth), node: $at.parent };
		for (let depth = $at.depth; depth >= 1; depth -= 1) {
			const parent = $at.node(depth);
			if (parent.type.name === 'blockquote' || parent.type.name === 'table') {
				return { pos: $at.before(depth), node: parent };
			}
		}
		return { pos: clamped, node: after };
	}
	const inside = clamped === doc.content.size ? clamped - 1 : clamped;
	const $pos = doc.resolve(Math.max(0, inside));
	for (let depth = $pos.depth; depth >= 1; depth -= 1) {
		const node = $pos.node(depth);
		const name = node.type.name;
		if (name === 'list_item' || name === 'blockquote' || name === 'table') {
			return { pos: $pos.before(depth), node };
		}
	}
	if ($pos.depth >= 1) return { pos: $pos.before(1), node: $pos.node(1) };
	return topBlock(doc, clamped);
}

/** Inclusive block span. A drag that crosses a list boundary selects the whole list. */
export function blockSpan(doc: ProseNode, anchorPos: number, headPos: number): BlockSpan | null {
	let anchor = selectableBlock(doc, anchorPos);
	let head = selectableBlock(doc, headPos);
	if (!anchor || !head) return null;
	const $anchor = doc.resolve(anchor.pos);
	const $head = doc.resolve(head.pos);
	if ($anchor.depth !== $head.depth || $anchor.start($anchor.depth) !== $head.start($head.depth)) {
		anchor = topBlock(doc, anchor.pos);
		head = topBlock(doc, head.pos);
		if (!anchor || !head) return null;
	}
	const from = Math.min(anchor.pos, head.pos);
	const endPos = Math.max(anchor.pos, head.pos);
	const end = doc.nodeAt(endPos);
	if (!end) return null;
	return { from, to: endPos + end.nodeSize, anchor: anchor.pos, head: head.pos };
}

function coveredRange(doc: ProseNode, from: number, to: number): { from: number; to: number } {
	const $from = doc.resolve(from);
	const $to = doc.resolve(to);
	if ($from.depth < 1 || !$from.sameParent($to)) return { from, to };
	const parent = $from.parent;
	if (!LIST.has(parent.type.name)) return { from, to };
	if ($from.parentOffset !== 0 || $to.parentOffset !== parent.content.size) return { from, to };
	const pos = $from.before($from.depth);
	return { from: pos, to: pos + parent.nodeSize };
}

/**
 * Blocks selected from the margin or from blank space.
 * The browser text highlight stays hidden; decorations paint the blocks.
 */
export class BlockRangeSelection extends Selection {
	constructor(doc: ProseNode, anchor: number, head: number) {
		const span = blockSpan(doc, anchor, head);
		if (!span) throw new RangeError('invalid block range');
		super(doc.resolve(span.anchor), doc.resolve(span.head), [
			new SelectionRange(doc.resolve(span.from), doc.resolve(span.to)),
		]);
	}

	static tryCreate(doc: ProseNode, anchor: number, head: number): BlockRangeSelection | null {
		if (!blockSpan(doc, anchor, head)) return null;
		return new BlockRangeSelection(doc, anchor, head);
	}

	override eq(other: Selection): boolean {
		return other instanceof BlockRangeSelection && other.anchor === this.anchor && other.head === this.head;
	}

	override map(doc: ProseNode, mapping: Mappable): Selection {
		return (
			BlockRangeSelection.tryCreate(doc, mapping.map(this.anchor), mapping.map(this.head)) ??
			TextSelection.near(doc.resolve(Math.max(0, Math.min(mapping.map(this.anchor), doc.content.size))))
		);
	}

	override toJSON(): { type: string; anchor: number; head: number } {
		return { type: 'block-range', anchor: this.anchor, head: this.head };
	}

	static fromJSON(doc: ProseNode, json: { anchor: number; head: number }): BlockRangeSelection {
		const selection = BlockRangeSelection.tryCreate(doc, json.anchor, json.head);
		if (!selection) throw new RangeError('invalid block range');
		return selection;
	}

	override getBookmark(): BlockRangeBookmark {
		return new BlockRangeBookmark(this.anchor, this.head);
	}
}

BlockRangeSelection.prototype.visible = false;

try {
	Selection.jsonID('block-range', BlockRangeSelection);
} catch (error) {
	if (!(error instanceof RangeError)) throw error;
}

class BlockRangeBookmark {
	readonly anchor: number;
	readonly head: number;

	constructor(anchor: number, head: number) {
		this.anchor = anchor;
		this.head = head;
	}

	map(mapping: Mappable): BlockRangeBookmark {
		return new BlockRangeBookmark(mapping.map(this.anchor), mapping.map(this.head));
	}

	resolve(doc: ProseNode): Selection {
		return (
			BlockRangeSelection.tryCreate(doc, this.anchor, this.head) ??
			TextSelection.near(doc.resolve(Math.max(0, Math.min(this.anchor, doc.content.size))))
		);
	}
}

function stepBlock(doc: ProseNode, pos: number, direction: -1 | 1): number | null {
	const block = selectableBlock(doc, pos);
	if (!block) return null;
	if (direction < 0) {
		if (block.pos === 0) return null;
		const previous = selectableBlock(doc, block.pos - 1);
		if (!previous || previous.pos === block.pos) return null;
		return previous.pos;
	}
	const after = block.pos + block.node.nodeSize;
	if (after >= doc.content.size) return null;
	const next = selectableBlock(doc, after);
	if (!next || next.pos === block.pos) return null;
	return next.pos;
}

function placeCaret(state: EditorState, pos: number, direction: -1 | 1, dispatch?: (tr: EditorState['tr']) => void): boolean {
	const selection = TextSelection.near(state.doc.resolve(Math.max(0, Math.min(pos, state.doc.content.size))), direction);
	dispatch?.(state.tr.setSelection(selection).scrollIntoView());
	return true;
}

function replaceBlocks(state: EditorState, text: string, dispatch?: (tr: EditorState['tr']) => void): boolean {
	const selection = state.selection;
	if (!(selection instanceof BlockRangeSelection)) return false;
	const paragraphType = state.schema.nodes.paragraph;
	if (!paragraphType) return false;
	if (!dispatch) return true;
	const range = coveredRange(state.doc, selection.from, selection.to);
	const paragraph = paragraphType.create(null, text ? state.schema.text(text) : null);
	let tr = state.tr.replaceWith(range.from, range.to, paragraph);
	const cursor = Math.min(range.from + 1 + text.length, tr.doc.content.size);
	tr = tr.setSelection(TextSelection.create(tr.doc, cursor)).scrollIntoView();
	dispatch(tr);
	return true;
}

/** Keyboard while whole blocks are selected. Returns false when the key belongs to text editing. */
export function blockRangeKey(
	state: EditorState,
	key: { key: string; text?: string; shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean },
	dispatch?: (tr: EditorState['tr']) => void,
): boolean {
	const selection = state.selection;
	if (!(selection instanceof BlockRangeSelection)) return false;
	if (key.metaKey || key.ctrlKey || key.altKey) {
		if ((key.metaKey || key.ctrlKey) && key.key.toLowerCase() === 'a' && state.doc.lastChild) {
			const next = BlockRangeSelection.tryCreate(state.doc, 0, state.doc.content.size - state.doc.lastChild.nodeSize);
			if (!next) return false;
			dispatch?.(state.tr.setSelection(next).scrollIntoView());
			return true;
		}
		return false;
	}
	if (key.key === 'Backspace' || key.key === 'Delete') {
		if (!dispatch) return true;
		const range = coveredRange(state.doc, selection.from, selection.to);
		const deletingAll = range.from === 0 && range.to === state.doc.content.size;
		if (deletingAll) return replaceBlocks(state, '', dispatch);
		let tr = state.tr.delete(range.from, range.to);
		tr = tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(range.from, tr.doc.content.size)))).scrollIntoView();
		dispatch(tr);
		return true;
	}
	if (key.key === 'Enter' || key.key === 'Escape') {
		if (key.key === 'Escape') return placeCaret(state, selection.from, 1, dispatch);
		return replaceBlocks(state, '', dispatch);
	}
	if (key.key === 'ArrowUp' || key.key === 'ArrowDown') {
		const direction = key.key === 'ArrowUp' ? -1 : 1;
		const nextHead = stepBlock(state.doc, selection.head, direction);
		if (nextHead == null) {
			const edge = direction < 0 ? selection.from : selection.to;
			return placeCaret(state, edge, direction, dispatch);
		}
		const anchor = key.shiftKey ? selection.anchor : nextHead;
		const next = BlockRangeSelection.tryCreate(state.doc, anchor, nextHead);
		if (!next) return false;
		dispatch?.(state.tr.setSelection(next).scrollIntoView());
		return true;
	}
	if (key.text != null) return replaceBlocks(state, key.text, dispatch);
	if (key.key.length === 1) return replaceBlocks(state, key.key, dispatch);
	return false;
}
