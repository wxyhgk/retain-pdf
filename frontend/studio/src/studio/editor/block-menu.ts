import { blockMenuAPI } from '@milkdown/crepe/feature/block-edit';
import { editorViewCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import { keymap } from '@milkdown/prose/keymap';
import { TextSelection } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';
import type { Node as ProseNode } from 'prosemirror-model';

import { blockActionItems, headingEnter, keyHint, planBlockEdit, type BlockAction, type BlockEdit } from './block-actions.ts';
import { moveBlocks } from './block-keys.ts';
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
	if (action.type === 'move') {
		// The block the menu is open for is selected; it moves as ⌘⇧↑↓ would move it.
		moveBlocks(view.state, action.direction, (tr) => view.dispatch(tr));
		view.focus();
		return;
	}
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
	hint?: string;
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
			item: { label: string; current?: boolean; danger?: boolean; hint?: string; onRun: (ctx: Ctx) => void },
		) => unknown;
	};
};

/** What the menu offers beyond the editor itself: saving a code block as a file of the article. */
export type BlockMenuHost = {
	saveAsFile?: { can: (node: ProseNode) => boolean; run: (view: EditorView, pos: number) => void };
};

function entriesFor(node: ProseNode, pos: number, host: BlockMenuHost): MenuEntry[] {
	if (node.type.name !== SCIENCE_FENCE_TYPE) {
		const entries = blockActionItems(node).map((item): MenuEntry => ({
			key: item.id,
			label: item.label,
			current: item.current,
			danger: item.danger,
			turn: item.section === '转换成',
			hint: item.shortcut ? keyHint(item.shortcut) : undefined,
			run: (view: EditorView) => dispatchBlockAction(view, item.action),
		}));
		const save = host.saveAsFile;
		if (save?.can(node)) {
			entries.push({ key: 'save-file', label: '另存为文件', current: false, danger: false, turn: false, run: (view) => save.run(view, pos) });
		}
		return entries;
	}
	const science = scienceBlockMenuItems(node.type.name, String(node.attrs.language ?? '')).map((item): MenuEntry => ({
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
			hint: duplicate.shortcut ? keyHint(duplicate.shortcut) : undefined,
			run: (view) => dispatchBlockAction(view, duplicate.action),
		});
	}
	return science;
}

/**
 * What a block's menu holds, opened from the drag handle or a chemistry
 * block's ⋯ button: duplicate it (or edit a chemistry block's source), turn
 * it into another kind, delete it; save a code block as a file.
 */
export function buildBlockMenu(builder: BlockMenuBuilder, { node, pos }: { node: ProseNode; pos: number }, host: BlockMenuHost = {}): void {
	const entries = entriesFor(node, pos, host);
	// As Notion orders it: what is done to the block first, then the long list of what it can become.
	const groups = [
		{ key: 'actions', label: '', entries: entries.filter((entry) => !entry.turn && !entry.danger) },
		{ key: 'remove', label: '', entries: entries.filter((entry) => entry.danger) },
		{ key: 'turn', label: '转换成', entries: entries.filter((entry) => entry.turn) },
	];
	for (const group of groups) {
		if (!group.entries.length) continue;
		const added = builder.addGroup(group.key, group.label);
		for (const entry of group.entries) {
			added.addItem(entry.key, {
				label: entry.label,
				current: entry.current,
				danger: entry.danger,
				hint: entry.hint,
				onRun: (ctx) => entry.run(ctx.get(editorViewCtx)),
			});
		}
	}
}

/** Crepe's toolbar builder, as much of it as is used here. */
type ToolbarBuilder = {
	addGroup: (key: string, label: string) => { addItem: (key: string, item: { icon: string; label?: string; active: (ctx: Ctx) => boolean; onRun?: (ctx: Ctx) => void }) => unknown };
	build: () => unknown[];
};

const TURN_ICON =
	'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M4 6h10v2h-4v11H8V8H4z"/><path d="M15 12h6l-3 3.5z"/></svg>';

/**
 * Notion's「转换成 ▾」at the front of the toolbar over selected text: the
 * block menu of the block the selection starts in, next to the button.
 */
export function buildToolbarTurn(builder: ToolbarBuilder): void {
	builder.addGroup('turn', '转换成').addItem('turn-into', {
		icon: TURN_ICON,
		label: '转换成',
		active: () => false,
		onRun: (ctx) => {
			const view = ctx.get(editorViewCtx);
			const target = blockAt(view.state.doc, view.state.selection.from);
			const button = document.querySelector<HTMLElement>('.milkdown-toolbar [aria-label="转换成"]');
			if (target && button) ctx.get(blockMenuAPI.key).toggle(target.pos, button, 'below');
		},
	});
	const groups = builder.build();
	groups.unshift(...groups.splice(-1));
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
