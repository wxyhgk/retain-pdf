import type { MilkdownPlugin } from '@milkdown/ctx';
import { SchemaReady, prosePluginsCtx } from '@milkdown/kit/core';
import { splitBlock } from '@milkdown/prose/commands';
import { keymap } from '@milkdown/prose/keymap';
import type { Node as ProseNode, ResolvedPos } from '@milkdown/prose/model';
import { NodeSelection, Selection, TextSelection, type EditorState, type Transaction } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import { liftTarget } from '@milkdown/prose/transform';

import { CALLOUT_TYPE } from './callout-block.ts';
import { COLUMNS_TYPE } from './columns-block.ts';
import { isFormulaBlock } from '@blog/editor-kit/math/formula-block.ts';
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

/** The characters of `holder` before the point the pointer would put the caret at (x, y), if that is in it. */
function charactersBefore(holder: Element, x: number, y: number): number | null {
	const range = document.caretRangeFromPoint?.(x, y);
	if (!range || !holder.contains(range.startContainer)) return null;
	const before = document.createRange();
	before.setStart(holder, 0);
	before.setEnd(range.startContainer, range.startOffset);
	return before.toString().length;
}

/**
 * Where in a code block's text its line nearest the caret (its last line from
 * below, its first from above) is at x. Its editor, or, not made yet (it is
 * made when first used), the text drawn in its place.
 */
function codeOffsetAt(dom: HTMLElement, text: string, direction: -1 | 1, x: number): number {
	const lineStart = direction < 0 ? text.lastIndexOf('\n') + 1 : 0;
	const lineEnd = direction < 0 ? text.length : text.indexOf('\n') < 0 ? text.length : text.indexOf('\n');
	const lines = dom.querySelectorAll<HTMLElement>('.cm-content .cm-line');
	const line = lines.length ? (direction < 0 ? lines[lines.length - 1] : lines[0]) : undefined;
	if (line) {
		const box = line.getBoundingClientRect();
		const at = charactersBefore(line, Math.max(box.left + 1, Math.min(x, box.right - 1)), (box.top + Math.min(box.bottom, box.top + 24)) / 2);
		return lineStart + Math.min(at ?? (x <= box.left ? 0 : lineEnd - lineStart), lineEnd - lineStart);
	}
	const drawn = dom.querySelector('.milkdown-code-block-placeholder code') ?? dom.querySelector('pre code');
	if (drawn) {
		const all = document.createRange();
		all.selectNodeContents(drawn);
		const rects = all.getClientRects();
		const rect = direction < 0 ? rects[rects.length - 1] : rects[0];
		const at = rect ? charactersBefore(drawn, Math.max(rect.left + 1, x), rect.top + rect.height / 2) : null;
		if (at != null && at >= lineStart && at <= lineEnd) return at;
	}
	return direction < 0 ? lineEnd : 0;
}

/**
 * ↑ or ↓ into a code block from the line next to it: on its nearest line, as
 * far across as the caret was (as SiYuan keeps it), not where its editor's
 * caret last was, nor past the code.
 */
export function intoCode(direction: -1 | 1) {
	return (state: EditorState, dispatch?: Dispatch, view?: EditorView): boolean => {
		const $at = caretInText(state);
		if (!view || !$at || !view.endOfTextblock(direction < 0 ? 'up' : 'down')) return false;
		const $edge = state.doc.resolve(direction < 0 ? $at.before() : $at.after());
		const code = direction < 0 ? $edge.nodeBefore : $edge.nodeAfter;
		if (!code?.isTextblock || !code.type.spec.code || isFormulaBlock(code)) return false;
		const codePos = direction < 0 ? $edge.pos - code.nodeSize : $edge.pos;
		const dom = view.nodeDOM(codePos);
		if (!(dom instanceof HTMLElement)) return false;
		const offset = codeOffsetAt(dom, code.textContent, direction, view.coordsAtPos($at.pos).left);
		dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, codePos + 1 + offset)).scrollIntoView());
		return true;
	};
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
		ArrowUp: intoCode(-1),
		ArrowDown: intoCode(1),
	});
	ctx.update(prosePluginsCtx, (plugins) => [plugin, ...plugins]);
	return () => ctx.update(prosePluginsCtx, (plugins) => plugins.filter((item) => item !== plugin));
};
