import { commandsCtx } from '@milkdown/kit/core';
import { toggleLinkCommand } from '@milkdown/kit/component/link-tooltip';
import { InputRule, inputRules } from '@milkdown/prose/inputrules';
import { Plugin, TextSelection, type EditorState } from '@milkdown/prose/state';
import { $prose } from '@milkdown/utils';

import { duplicateBlocks, moveBlocks, selectBlockInHand, todoInputRule, type Dispatch } from './block-keys.ts';

/** ⌘ on a Mac, Ctrl elsewhere. */
const modifier = (event: KeyboardEvent) => (navigator.platform.includes('Mac') ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey);

/**
 * Notion's keys (see block-keys.ts), plus ⌘K on selected text for a link
 * (⌘K elsewhere finds an article). Put after the
 * editor's other plugins, so Esc goes to what is open first (a formula
 * being typed, a menu).
 */
export const blockKeysPlugin = $prose(
	(ctx) =>
		new Plugin({
			props: {
				handleKeyDown(view, event) {
					if (event.isComposing || event.defaultPrevented) return false;
					const run = (command: (state: EditorState, dispatch?: Dispatch) => boolean) => command(view.state, (tr) => view.dispatch(tr));
					if (event.key === 'Escape' && !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey) return run(selectBlockInHand);
					if (!modifier(event) || event.altKey) return false;
					const key = event.key.toLowerCase();
					if (event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) return run((state, dispatch) => moveBlocks(state, event.key === 'ArrowUp' ? -1 : 1, dispatch));
					if (event.shiftKey) return false;
					if (key === 'd') return run(duplicateBlocks);
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

export const todoPlugin = $prose(() => inputRules({ rules: [new InputRule(/^\[( |x|X)?\]\s$/u, todoInputRule)] }));

export const blockKeyPlugins = [blockKeysPlugin, todoPlugin].flat();
