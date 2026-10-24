import { blockMenuAPI } from '@milkdown/crepe/feature/block-edit';
import { editorViewCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import { keymap } from '@milkdown/prose/keymap';
import { TextSelection } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';
import type { Node as ProseNode } from 'prosemirror-model';

import { blockActionItems, headingEnter, keyHint, planBlockEdit, planTurn, type BlockAction, type BlockEdit } from './block-actions.ts';
import { blockEdgePlugin } from './block-edges.ts';
import { duplicateBlocks, moveBlocks } from './block-keys.ts';
import { BlockRangeSelection, blockRangeKey, coveredRange } from './block-range.ts';
import { blockRangePlugin } from './block-range-drag.ts';
import { paragraphBreakPlugin } from './paragraph-breaks.ts';
import { FIGURE_TYPE } from './figure-block.ts';
import { blockAddress, onlyLink, targetsFor, type LinkTarget } from './link-embeds.ts';
import type { BlockMenuEntry, StudioBlock } from '@blog/kernel/studio.ts';
import { blockAt } from '@blog/ui/block-at.ts';

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
	if (action.type === 'turn') {
		// What is selected turns: several blocks, or the items of a list.
		const { from, to } = view.state.selection;
		const edit = planTurn(view.state.doc, from, to, action.kind);
		if (edit) dispatchBlockEdit(view, edit);
		return;
	}
	if (action.type === 'move') {
		// The block the menu is open for is selected; it moves as ⌘⇧↑↓ would move it.
		moveBlocks(view.state, action.direction, (tr) => view.dispatch(tr));
		view.focus();
		return;
	}
	const target = blockAt(view.state.doc, view.state.selection.from);
	if (!target) return;
	// Several blocks selected: all of them are deleted or copied, not the first.
	const { selection } = view.state;
	if (selection instanceof BlockRangeSelection && coveredRange(view.state.doc, selection.from, selection.to).to > target.pos + target.node.nodeSize) {
		const dispatch = (tr: EditorView['state']['tr']) => view.dispatch(tr);
		if (action.type === 'delete') blockRangeKey(view.state, { key: 'Backspace' }, dispatch);
		else duplicateBlocks(view.state, dispatch);
		view.focus();
		return;
	}
	const edit = planBlockEdit(view.state.doc, target.pos, action);
	if (!edit) return;
	dispatchBlockEdit(view, edit);
}

type MenuEntry = BlockMenuEntry;


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
	/** 「问 AI」 about the block (it is selected when its menu runs an entry). */
	ask?: () => void;
	/** 转成子页面: the heading at `pos` and its section made a page under the article. */
	split?: (view: EditorView, pos: number) => void;
	/** 识别…: the picture at `pos` read by a large model (a formula, text, a table…), what is read put under it. */
	recognize?: (view: EditorView, pos: number) => void;
	/** OCR 成子页面: the PDF the line at `pos` links to (`path` in the article) read into a page under the article. */
	ocr?: (view: EditorView, pos: number, path: string) => void;
	/** The plugins' blocks: one may hold its own node's menu (a chemistry block's). */
	blocks?: StudioBlock[];
	/**
	 * What the plugins make of links (link-embeds.ts): a line that is only a link turns into them,
	 * and they back into the link (转换成).
	 */
	links?: {
		targets: readonly LinkTarget[];
		turn: (view: EditorView, pos: number, markdown: string) => void;
		back: (view: EditorView, pos: number, url: string) => void;
	};
};

/** Where a paragraph that is one link and nothing else points, whatever the address (a file of the article too). */
function linkedAlone(node: ProseNode): string | null {
	if (node.type.name !== 'paragraph' || !node.childCount) return null;
	const hrefs = new Set<string>();
	node.forEach((child) => hrefs.add(String(child.marks.find((mark) => mark.type.name === 'link')?.attrs.href ?? '')));
	const [href] = hrefs;
	return hrefs.size === 1 && href ? href : null;
}

/** The blocks that are a picture: what 识别 reads. */
const PICTURES = ['image-block', FIGURE_TYPE];

/** The menu's 「问 AI…」, when the Studio offers it. */
function askEntry(host: BlockMenuHost): MenuEntry[] {
	const ask = host.ask;
	return ask ? [{ key: 'ask-ai', label: '问 AI…', current: false, danger: false, turn: false, hint: keyHint('Mod-j'), run: () => ask() }] : [];
}

function entriesFor(node: ProseNode, pos: number, host: BlockMenuHost): MenuEntry[] {
	const entries = blockActionItems(node).map((item): MenuEntry => ({
		key: item.id,
		label: item.label,
		current: item.current,
		danger: item.danger,
		turn: item.section === '转换成',
		hint: item.shortcut ? keyHint(item.shortcut) : undefined,
		run: (view: EditorView) => dispatchBlockAction(view, item.action),
	}));
	const split = host.split;
	if (split && node.type.name === 'heading') {
		entries.push({ key: 'split', label: '转成子页面', current: false, danger: false, turn: false, run: (view) => split(view, pos) });
	}
	const recognize = host.recognize;
	if (recognize && PICTURES.includes(node.type.name) && node.attrs.src) {
		entries.push({ key: 'recognize', label: '识别…', current: false, danger: false, turn: false, run: (view) => recognize(view, pos) });
	}
	const ocr = host.ocr;
	// A PDF of the article: a line that is only a link to it (as a PDF dropped in comes in).
	const pdf = /^\.\/(.+\.pdf)$/iu.exec(linkedAlone(node) ?? '')?.[1];
	if (ocr && pdf) entries.push({ key: 'ocr', label: 'OCR 成子页面（PaddleOCR）', current: false, danger: false, turn: false, run: (view) => ocr(view, pos, decodeURI(pdf)) });
	const links = host.links;
	if (links) {
		const url = onlyLink(node);
		for (const target of url ? targetsFor(url, links.targets) : []) {
			entries.push({ key: `link-${target.node}`, label: target.label, current: false, danger: false, turn: true, run: (view) => links.turn(view, pos, target.markdown(url!)) });
		}
		const made = links.targets.find((target) => target.node === node.type.name);
		const address = made ? blockAddress(node) : null;
		if (made && address) {
			for (const target of targetsFor(address, links.targets)) {
				const current = target.node === node.type.name;
				entries.push({ key: `link-${target.node}`, label: target.label, current, danger: false, turn: true, run: (view) => !current && links.turn(view, pos, target.markdown(address)) });
			}
			entries.push({ key: 'link', label: '链接', current: false, danger: false, turn: true, run: (view) => links.back(view, pos, address) });
		}
	}
	const save = host.saveAsFile;
	if (save?.can(node)) {
		entries.push({ key: 'save-file', label: '另存为文件', current: false, danger: false, turn: false, run: (view) => save.run(view, pos) });
	}
	// A plugin's block may hold a menu of its own, keeping what it likes of these.
	const own = host.blocks?.find((block) => block.blockMenu?.nodes.includes(node.type.name))?.blockMenu;
	return [...(own ? own.entries(node, pos, entries) : entries), ...askEntry(host)];
}

/**
 * What a block's menu holds, opened from the drag handle (or a plugin
 * block's ⋯ button): duplicate it, turn it into another kind, delete it;
 * save a code block as a file; a plugin's block holds its own.
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

/** Marks the icon, so its button is found by it, whatever the button is labelled. */
const TURN_MARK = 'data-studio-turn';
const TURN_ICON =
	`<svg ${TURN_MARK} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M4 6h10v2h-4v11H8V8H4z"/><path d="M15 12h6l-3 3.5z"/></svg>`;

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
			const button = document.querySelector(`.milkdown-toolbar [${TURN_MARK}]`)?.closest<HTMLElement>('button');
			if (target && button) ctx.get(blockMenuAPI.key).toggle(target.pos, button, 'below');
		},
	});
	const groups = builder.build();
	groups.unshift(...groups.splice(-1));
}

const ASK_ICON =
	'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M18.5 14l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/></svg>';

/** 「问 AI」 at the end of the toolbar over selected text. */
export function buildToolbarAsk(builder: ToolbarBuilder, ask: () => void): void {
	builder.addGroup('ask', '问 AI').addItem('ask-ai', { icon: ASK_ICON, label: '问 AI', active: () => false, onRun: () => ask() });
}

export const writingKeymap = $prose(() =>
	keymap({
		Enter: headingEnter,
		// ↑ on the first line of the first block (anywhere on it, not only at its start): the title.
		ArrowUp: (state, _dispatch, view) => {
			if (!focusTitle) return false;
			const selection = state.selection;
			if (!(selection instanceof TextSelection) || !selection.empty) return false;
			if (selection.$from.start() !== TextSelection.atStart(state.doc).$from.start()) return false;
			if (selection.from !== TextSelection.atStart(state.doc).from && !view?.endOfTextblock('up')) return false;
			focusTitle();
			return true;
		},
	}),
);

export const blockFeelPlugins = [blockRangePlugin, writingKeymap, paragraphBreakPlugin, blockEdgePlugin];
