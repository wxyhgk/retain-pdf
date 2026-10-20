import type { MilkdownPlugin } from '@milkdown/ctx';
import { commandsCtx } from '@milkdown/kit/core';
import { toggleLinkCommand } from '@milkdown/kit/component/link-tooltip';
import { extendListItemSchemaForTask } from '@milkdown/kit/preset/gfm';
import { InputRule, inputRules } from '@milkdown/prose/inputrules';
import { NodeSelection, Plugin, Selection, TextSelection, type EditorState } from '@milkdown/prose/state';
import { $prose } from '@milkdown/utils';

import { duplicateBlocks, linkInputRule, moveBlocks, selectBlockInHand, selectTextblock, todoInputRule, unlistAtStart, type Dispatch } from './block-keys.ts';

/** ⌘ on a Mac, Ctrl elsewhere. */
const modifier = (event: KeyboardEvent) => (navigator.platform.includes('Mac') ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey);

/**
 * Notion's keys (see block-keys.ts), plus ⌘K on selected text for a link
 * (⌘K elsewhere finds an article). Put after the
 * editor's other plugins, so Esc goes to what is open first (a formula
 * being typed, a menu).
 */
/** What the keys need from the Studio around the editor. */
export type BlockKeysHost = {
	/** ⌘J: 「问 AI」 about the selected blocks. */
	askAI(): void;
};

const blockKeysPlugin = (host: BlockKeysHost) => $prose(
	(ctx) =>
		new Plugin({
			props: {
				handleKeyDown(view, event) {
					if (event.isComposing || event.defaultPrevented) return false;
					const run = (command: (state: EditorState, dispatch?: Dispatch) => boolean) => command(view.state, (tr) => view.dispatch(tr));
					const plain = !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey;
					if (event.key === 'Escape' && plain) return run(selectBlockInHand);
					if (event.key === 'Backspace' && plain) return run(unlistAtStart);
					if (!modifier(event) || event.altKey) return false;
					const key = event.key.toLowerCase();
					if (event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) return run((state, dispatch) => moveBlocks(state, event.key === 'ArrowUp' ? -1 : 1, dispatch));
					if (event.shiftKey) return false;
					if (key === 'a') return run(selectTextblock);
					if (key === 'd') return run(duplicateBlocks);
					if (key === 'j') {
						host.askAI();
						return true;
					}
					if (key === 'k') {
						const { selection } = view.state;
						if (!(selection instanceof TextSelection) || selection.empty) return false;
						return ctx.get(commandsCtx).call(toggleLinkCommand.key);
					}
					return false;
				},
			},
		}),
);

export const todoPlugin = $prose(() =>
	inputRules({
		rules: [
			new InputRule(/^\[( |x|X)?\]\s$/u, todoInputRule),
			new InputRule(/(?<!!)\[([^[\]]+)\]\(([^()\s]+)\)$/u, linkInputRule, { inCodeMark: false }),
		],
	}),
);

/**
 * A block dropped where it was dragged: the caret at the end of its text, as
 * after typing it there. Not the block selected whole, which shows it gray
 * until a click elsewhere (one that seemed not to take) and which a key typed
 * would replace. A block with no text in it (a picture, a molecule) stays selected.
 */
export const dropCaret = $prose(
	() =>
		new Plugin({
			appendTransaction(transactions, _before, state) {
				if (!transactions.some((tr) => tr.getMeta('uiEvent') === 'drop')) return null;
				const { selection } = state;
				if (!(selection instanceof NodeSelection) || !selection.node.isBlock) return null;
				const end = Selection.findFrom(state.doc.resolve(selection.to), -1, true);
				if (!end || end.from <= selection.from) return null;
				return state.tr.setSelection(end);
			},
		}),
);

/**
 * A list item made in the editor is tight, as one typed by hand: a list put in it (Tab) is written without a
 * blank line before it, which would make the whole list loose and spaced out on the blog. Items read from the
 * file keep what it says. (On top of GFM's list item, the one with to-dos.)
 */
const tightListItems = extendListItemSchemaForTask.extendSchema((schema) => (ctx) => {
	const base = schema(ctx);
	return { ...base, attrs: { ...base.attrs, spread: { ...base.attrs?.spread, default: false } } };
});

export function blockKeyPlugins(host: BlockKeysHost): MilkdownPlugin[] {
	return [blockKeysPlugin(host), todoPlugin, tightListItems, dropCaret].flat();
}
