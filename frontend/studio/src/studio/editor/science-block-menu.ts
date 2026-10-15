import { keymap } from '@milkdown/prose/keymap';
import { NodeSelection, TextSelection } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';

import {
	SCIENCE_FENCE_TYPE,
	blockAt,
	scienceAttrs,
	type ScienceBlockAction,
} from './science-block.ts';

function focusInside(view: EditorView, cursor: number, recordHistory: boolean): void {
	const clamped = Math.max(0, Math.min(cursor, view.state.doc.content.size));
	let tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(clamped))).scrollIntoView();
	if (!recordHistory) tr = tr.setMeta('addToHistory', false);
	view.dispatch(tr);
	view.focus();
}

/**
 * Change only the selected block. Replacing the whole document would
 * remount every molecule viewer on the page.
 */
export function dispatchScienceAction(view: EditorView, action: ScienceBlockAction): void {
	const target = blockAt(view.state.doc, view.state.selection.from);
	if (!target) return;
	const { pos, node } = target;
	const science = view.state.schema.nodes[SCIENCE_FENCE_TYPE];
	if (action.type === 'edit') {
		if (node.type.name !== SCIENCE_FENCE_TYPE) return;
		focusInside(view, pos + node.nodeSize - 1, false);
		return;
	}
	if (action.type === 'delete') {
		let tr = view.state.tr;
		if (view.state.doc.childCount === 1) {
			const paragraph = view.state.schema.nodes.paragraph?.createAndFill();
			if (!paragraph) return;
			tr = tr.replaceWith(pos, pos + node.nodeSize, paragraph);
		} else {
			tr = tr.delete(pos, pos + node.nodeSize);
		}
		const cursor = Math.min(pos, tr.doc.content.size);
		tr = tr.setSelection(TextSelection.near(tr.doc.resolve(cursor))).scrollIntoView();
		view.dispatch(tr);
		view.focus();
		return;
	}
	if (!science) return;
	if (action.type === 'insert') {
		const at = pos + node.nodeSize;
		const tr = view.state.tr.insert(at, science.create({ language: action.info }));
		view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(at + 1))).scrollIntoView());
		view.focus();
		return;
	}
	if (node.type === science && node.attrs.language === action.info) return;
	const text = node.textContent;
	const created = science.create(scienceAttrs(node, action.info), text ? view.state.schema.text(text) : null);
	const tr = view.state.tr.replaceWith(pos, pos + node.nodeSize, created);
	view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1))).scrollIntoView());
	view.focus();
}

/**
 * Put the caret at the end of a science block without recording a history step.
 * The block's node view answers a caret inside it by opening the source popup.
 */
export function placeCursorInScienceBlock(view: EditorView, pos: number): void {
	const node = view.state.doc.nodeAt(pos);
	if (!node || node.type.name !== SCIENCE_FENCE_TYPE) return;
	const cursor = pos + node.nodeSize - 1;
	view.dispatch(
		view.state.tr
			.setSelection(TextSelection.create(view.state.doc, cursor))
			.setMeta('addToHistory', false)
			.scrollIntoView(),
	);
	view.focus();
}

/** Enter on a selected science block opens its source popup. */
export const scienceBlockKeys = $prose(() =>
	keymap({
		Enter: (state, dispatch, view) => {
			const selection = state.selection;
			if (!(selection instanceof NodeSelection) || selection.node.type.name !== SCIENCE_FENCE_TYPE) return false;
			if (dispatch && view) placeCursorInScienceBlock(view, selection.from);
			return true;
		},
	}),
);
