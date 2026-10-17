import { NodeSelection, Selection, TextSelection, type EditorState, type Transaction } from '@milkdown/prose/state';
import type { Node as ProseNode } from 'prosemirror-model';

import { BlockRangeSelection, coveredRange, selectableBlock } from './block-range.ts';

/**
 * Notion's keys for whole blocks:
 * - Esc selects the block being written in (then ↑↓, ⇧↑↓, ⌫ as with blocks
 *   picked from the margin; Esc or ↩ goes back to writing);
 * - ⌘⇧↑ / ⌘⇧↓ move the block (or the selected blocks) past their neighbour;
 * - ⌘D puts a copy of it under it;
 * - `[] ` at the start of a paragraph makes it a to-do.
 * The keys are bound in block-key-plugins.ts. A block is what the margin and the block menu take as one: a list item,
 * a quote or a table whole, otherwise the block at the top of the page.
 */

export type Dispatch = (tr: Transaction) => void;

/** The blocks in hand: those selected, or the one the caret (or text selection) is in. */
function blocksInHand(state: EditorState): { from: number; to: number } | null {
	const { selection, doc } = state;
	if (selection instanceof BlockRangeSelection) return coveredRange(doc, selection.from, selection.to);
	const first = selectableBlock(doc, selection.from);
	if (!first) return null;
	const last = selection.empty ? first : selectableBlock(doc, Math.max(selection.from, selection.to - 1));
	if (!last || last.pos === first.pos) return { from: first.pos, to: first.pos + first.node.nodeSize };
	// Text across blocks: the blocks it starts and ends in, if they are side by side in one parent.
	const $first = doc.resolve(first.pos);
	const $last = doc.resolve(last.pos);
	if (!$first.sameParent($last)) return { from: first.pos, to: first.pos + first.node.nodeSize };
	return { from: first.pos, to: last.pos + last.node.nodeSize };
}

/** The selection as it was, `shift` further on (the blocks it is in moved or were copied there). */
function shifted(selection: Selection, doc: ProseNode, shift: number): Selection {
	if (selection instanceof BlockRangeSelection) {
		return BlockRangeSelection.tryCreate(doc, selection.anchor + shift, selection.head + shift) ?? TextSelection.near(doc.resolve(selection.from + shift));
	}
	if (selection instanceof NodeSelection) return NodeSelection.create(doc, selection.from + shift);
	return TextSelection.create(doc, selection.anchor + shift, selection.head + shift);
}

/** Moves the blocks in hand past the block before (-1) or after (1) them, keeping what is selected. */
export function moveBlocks(state: EditorState, direction: -1 | 1, dispatch?: Dispatch): boolean {
	const range = blocksInHand(state);
	if (!range) return false;
	const $from = state.doc.resolve(range.from);
	const parent = $from.parent;
	const index = $from.index();
	const end = state.doc.resolve(range.to).index($from.depth);
	const neighbour = direction < 0 ? (index > 0 ? parent.child(index - 1) : null) : end < parent.childCount ? parent.child(end) : null;
	// At the edge of what holds them: nowhere to go, and the key is still taken.
	if (!neighbour) return true;
	if (!dispatch) return true;
	const blocks = state.doc.slice(range.from, range.to).content;
	const shift = direction * neighbour.nodeSize;
	const tr = state.tr.delete(range.from, range.to).insert(range.from + shift, blocks);
	dispatch(tr.setSelection(shifted(state.selection, tr.doc, shift)).scrollIntoView());
	return true;
}

/** Puts a copy of the blocks in hand under them; what was selected is then selected in the copy. */
export function duplicateBlocks(state: EditorState, dispatch?: Dispatch): boolean {
	const range = blocksInHand(state);
	if (!range) return false;
	if (!dispatch) return true;
	const tr = state.tr.insert(range.to, state.doc.slice(range.from, range.to).content);
	dispatch(tr.setSelection(shifted(state.selection, tr.doc, range.to - range.from)).scrollIntoView());
	return true;
}

/** Selects the block being written in, as a click in its margin does. */
export function selectBlockInHand(state: EditorState, dispatch?: Dispatch): boolean {
	if (state.selection instanceof BlockRangeSelection) return false;
	const range = blocksInHand(state);
	if (!range) return false;
	const last = selectableBlock(state.doc, range.to - 1);
	const selection = BlockRangeSelection.tryCreate(state.doc, range.from, last && last.pos >= range.from ? last.pos : range.from);
	if (!selection) return false;
	dispatch?.(state.tr.setSelection(selection).scrollIntoView());
	return true;
}

/** `[] `, `[ ] ` or `[x] ` at the start of a paragraph: a to-do (in a list item, that item becomes one). */
export function todoInputRule(state: EditorState, match: RegExpMatchArray, start: number, end: number): Transaction | null {
	const $start = state.doc.resolve(start);
	if ($start.parent.type.name !== 'paragraph' || $start.parentOffset !== 0) return null;
	const checked = /x/iu.test(match[1] ?? '');
	const item = state.schema.nodes.list_item;
	const list = state.schema.nodes.bullet_list;
	if (!item || !list) return null;
	const tr = state.tr.delete(start, end);
	const holder = $start.node($start.depth - 1);
	if (holder.type === item) {
		if (holder.attrs.checked != null) return null;
		return tr.setNodeMarkup($start.before($start.depth - 1), undefined, { ...holder.attrs, checked });
	}
	const $paragraph = tr.doc.resolve(start);
	const range = $paragraph.blockRange();
	if (!range) return null;
	return tr.wrap(range, [{ type: list, attrs: { bullet: '-' } }, { type: item, attrs: { listType: 'bullet', checked } }]);
}
