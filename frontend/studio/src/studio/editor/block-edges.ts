import type { MilkdownPlugin } from '@milkdown/ctx';
import { SchemaReady, prosePluginsCtx } from '@milkdown/kit/core';
import { splitBlock } from '@milkdown/prose/commands';
import { keymap } from '@milkdown/prose/keymap';
import type { Node as ProseNode, ResolvedPos } from '@milkdown/prose/model';
import { NodeSelection, Selection, TextSelection, type EditorState, type Transaction } from '@milkdown/prose/state';
import { liftTarget } from '@milkdown/prose/transform';

import { CALLOUT_TYPE } from './callout-block.ts';
import { COLUMNS_TYPE } from './columns-block.ts';
import { TOGGLE_TYPE } from './toggle-block.ts';

// ⌫, ⌦ and ↩ at the edges of blocks, as SiYuan has them: text is never
// merged into what is not text, a heading is a line again in one press, and a
// quote is not split by a line left empty in its middle.

type Dispatch = (tr: Transaction) => void;

/** A block that is not text being written: a figure, a table, columns, code or a formula. */
export function holdsNoProse(node: ProseNode): boolean {
	if (node.isTextblock) return Boolean(node.type.spec.code);
	return node.isAtom || node.type.name === 'table' || node.type.name === COLUMNS_TYPE;
}

/** The caret alone in a line of text (not code). */
function caretInText(state: EditorState): ResolvedPos | null {
	const { selection } = state;
	if (!(selection instanceof TextSelection) || !selection.empty) return null;
	const { $from } = selection;
	if (!$from.parent.isTextblock || $from.parent.type.spec.code || $from.depth < 1) return null;
	return $from;
}

/** On the block at `pos`: one with no text selected whole; in a table or columns, the caret at its near end. */
function selectionOn(doc: ProseNode, pos: number, node: ProseNode, side: -1 | 1): Selection {
	if (!(node.type.name === 'table' || node.type.name === COLUMNS_TYPE) && NodeSelection.isSelectable(node)) return NodeSelection.create(doc, pos);
	return Selection.near(doc.resolve(side < 0 ? pos + node.nodeSize : pos), side);
}

/**
 * ⌫ at the start of a line after a figure, a table, code or a formula: an
 * empty line goes and that block is selected; a line with text only goes to
 * that block. Never merged into it (prose into code, or a press to select an
 * image and another to delete it with the empty line still there).
 */
export function backspaceAfterBlock(state: EditorState, dispatch?: Dispatch): boolean {
	const $at = caretInText(state);
	if (!$at || $at.parentOffset !== 0) return false;
	const index = $at.index(-1);
	if (index === 0) return false;
	const before = $at.node(-1).child(index - 1);
	if (!holdsNoProse(before)) return false;
	if (!dispatch) return true;
	const start = $at.before();
	const beforePos = start - before.nodeSize;
	let tr = state.tr;
	if ($at.parent.content.size === 0) tr = tr.delete(start, $at.after());
	dispatch(tr.setSelection(selectionOn(tr.doc, beforePos, before, -1)).scrollIntoView());
	return true;
}

/** ⌦ at the end of a line before a figure, a table, code or a formula: as ⌫ after one. */
export function deleteBeforeBlock(state: EditorState, dispatch?: Dispatch): boolean {
	const $at = caretInText(state);
	if (!$at || $at.parentOffset !== $at.parent.content.size) return false;
	const index = $at.index(-1);
	const parent = $at.node(-1);
	if (index + 1 >= parent.childCount) return false;
	const after = parent.child(index + 1);
	if (!holdsNoProse(after)) return false;
	if (!dispatch) return true;
	const start = $at.before();
	let afterPos = $at.after();
	let tr = state.tr;
	if ($at.parent.content.size === 0) {
		tr = tr.delete(start, afterPos);
		afterPos = start;
	}
	dispatch(tr.setSelection(selectionOn(tr.doc, afterPos, after, 1)).scrollIntoView());
	return true;
}

/** ⌫ at the start of the first line in a quote or a callout: that line goes out in front of it, not into the line above. */
export function liftOutAtStart(state: EditorState, dispatch?: Dispatch): boolean {
	const $at = caretInText(state);
	if (!$at || $at.parentOffset !== 0 || $at.depth < 2 || $at.index(-1) !== 0) return false;
	const holder = $at.node(-1).type.name;
	if (holder !== 'blockquote' && holder !== CALLOUT_TYPE) return false;
	const range = $at.blockRange();
	const target = range && liftTarget(range);
	if (!range || target == null) return false;
	dispatch?.(state.tr.lift(range, target).scrollIntoView());
	return true;
}

/** ⌫ at the start of a heading: a line of text, in one press (not a bigger heading, then another). */
export function headingToText(state: EditorState, dispatch?: Dispatch): boolean {
	const $at = caretInText(state);
	const paragraph = state.schema.nodes.paragraph;
	if (!$at || !paragraph || $at.parentOffset !== 0 || $at.parent.type.name !== 'heading') return false;
	dispatch?.(state.tr.setBlockType($at.pos, $at.pos, paragraph).scrollIntoView());
	return true;
}

/** ↩ on an empty line in the middle of a quote, a callout or a toggle: a new line there, not the block split in two. */
export function enterInsideHolder(state: EditorState, dispatch?: Dispatch): boolean {
	const $at = caretInText(state);
	if (!$at || $at.parent.content.size !== 0 || $at.parent.type.name !== 'paragraph' || $at.depth < 2) return false;
	const holder = $at.node(-1);
	if (!['blockquote', CALLOUT_TYPE, TOGGLE_TYPE].includes(holder.type.name)) return false;
	if ($at.index(-1) === holder.childCount - 1) return false;
	return splitBlock(state, dispatch);
}

const first = (...commands: Array<(state: EditorState, dispatch?: Dispatch) => boolean>) => (state: EditorState, dispatch?: Dispatch) =>
	commands.some((command) => command(state, dispatch));

/** Before the editor's own keys (Milkdown's ⌫ joins into the block above first). */
export const blockEdgePlugin: MilkdownPlugin = (ctx) => async () => {
	await ctx.wait(SchemaReady);
	const plugin = keymap({
		Backspace: first(headingToText, liftOutAtStart, backspaceAfterBlock),
		Delete: deleteBeforeBlock,
		Enter: enterInsideHolder,
	});
	ctx.update(prosePluginsCtx, (plugins) => [plugin, ...plugins]);
	return () => ctx.update(prosePluginsCtx, (plugins) => plugins.filter((item) => item !== plugin));
};
