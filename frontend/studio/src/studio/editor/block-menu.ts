import { editorViewCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import { keymap } from '@milkdown/prose/keymap';
import { TextSelection } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';
import type { Node as ProseNode } from 'prosemirror-model';

import { blockActionItems, headingEnter, planBlockEdit, type BlockAction, type BlockEdit } from './block-actions.ts';
import { blockRangePlugin } from './block-range-drag.ts';
import { paragraphBreakPlugin } from './paragraph-breaks.ts';
import { dispatchScienceAction } from './science-block-menu.ts';
import { SCIENCE_FENCE_TYPE, blockAt, scienceBlockMenuItems } from './science-block.ts';

let focusTitle: (() => void) | null = null;

/** ArrowUp at the start of the document moves into the title field. */
export function bindTitleFocus(handler: () => void): void {
	focusTitle = handler;
}

function dispatchBlockEdit(view: EditorView, edit: BlockEdit): void {
	let tr = view.state.tr;
	tr = edit.nodes.length ? tr.replaceWith(edit.from, edit.to, edit.nodes) : tr.delete(edit.from, edit.to);
	const cursor = Math.max(0, Math.min(edit.cursor, tr.doc.content.size));
	tr = tr.setSelection(TextSelection.near(tr.doc.resolve(cursor))).scrollIntoView();
	view.dispatch(tr);
	view.focus();
}

export function dispatchBlockAction(view: EditorView, action: BlockAction): void {
	const target = blockAt(view.state.doc, view.state.selection.from);
	if (!target) return;
	const edit = planBlockEdit(view.state.doc, target.pos, action);
	if (!edit) return;
	dispatchBlockEdit(view, edit);
}

type MenuEntry = {
	key: string;
	label: string;
	current: boolean;
	danger: boolean;
	turn: boolean;
	run: (view: EditorView) => void;
};

/** Crepe's block menu builder (the Milkdown fork), as much of it as is used here. */
export type BlockMenuBuilder = {
	addGroup: (
		key: string,
		label: string,
	) => {
		addItem: (
			key: string,
			item: { label: string; current?: boolean; danger?: boolean; onRun: (ctx: Ctx) => void },
		) => unknown;
	};
};

function entriesFor(node: ProseNode): MenuEntry[] {
	if (node.type.name !== SCIENCE_FENCE_TYPE) {
		return blockActionItems(node).map((item) => ({
			key: item.id,
			label: item.label,
			current: item.current,
			danger: item.danger,
			turn: item.section === '转换成',
			run: (view) => dispatchBlockAction(view, item.action),
		}));
	}
	const science = scienceBlockMenuItems(node.type.name, String(node.attrs.language ?? '')).map((item) => ({
		key: item.id,
		label: item.label,
		current: item.current,
		danger: item.action.type === 'delete',
		turn: item.section === '转换',
		run: (view: EditorView) => dispatchScienceAction(view, item.action),
	}));
	const duplicate = blockActionItems(node).find((item) => item.action.type === 'duplicate');
	if (duplicate) {
		science.splice(1, 0, {
			key: duplicate.id,
			label: duplicate.label,
			current: false,
			danger: false,
			turn: false,
			run: (view) => dispatchBlockAction(view, duplicate.action),
		});
	}
	return science;
}

/**
 * What a block's menu holds, opened from the drag handle or a chemistry
 * block's ⋯ button: duplicate it (or edit a chemistry block's source), turn
 * it into another kind, delete it.
 */
export function buildBlockMenu(builder: BlockMenuBuilder, { node }: { node: ProseNode }): void {
	const entries = entriesFor(node);
	const groups = [
		{ key: 'actions', label: '', entries: entries.filter((entry) => !entry.turn && !entry.danger) },
		{ key: 'turn', label: '转换成', entries: entries.filter((entry) => entry.turn) },
		{ key: 'remove', label: '', entries: entries.filter((entry) => entry.danger) },
	];
	for (const group of groups) {
		if (!group.entries.length) continue;
		const added = builder.addGroup(group.key, group.label);
		for (const entry of group.entries) {
			added.addItem(entry.key, {
				label: entry.label,
				current: entry.current,
				danger: entry.danger,
				onRun: (ctx) => entry.run(ctx.get(editorViewCtx)),
			});
		}
	}
}

export const writingKeymap = $prose(() =>
	keymap({
		Enter: headingEnter,
		ArrowUp: (state) => {
			if (!focusTitle) return false;
			const selection = state.selection;
			if (!(selection instanceof TextSelection) || !selection.empty) return false;
			if (selection.from !== TextSelection.atStart(state.doc).from) return false;
			focusTitle();
			return true;
		},
	}),
);

export const blockFeelPlugins = [blockRangePlugin, writingKeymap, paragraphBreakPlugin];
