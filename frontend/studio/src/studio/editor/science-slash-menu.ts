import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { addBlockTypeCommand, clearTextInCurrentBlockCommand } from '@milkdown/kit/preset/commonmark';
import type { EditorView } from 'prosemirror-view';

import { dispatchScienceAction, placeCursorInScienceBlock } from './science-block-menu.ts';
import { SCIENCE_BLOCK_KINDS, SCIENCE_FENCE_TYPE } from './science-block.ts';

/** Slash menu entries: one insert per scientific fence language, plus delete. */
export const SCIENCE_SLASH_LANGUAGES = SCIENCE_BLOCK_KINDS.map((kind) => ({
	key: kind.key,
	label: `化学 ${kind.label}`,
	info: kind.info,
}));

const scienceSlashIcon =
	'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"' +
	' fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h6M10 3v5L4.5 18a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 8V3"/></svg>';

type SlashMenuBuilder = {
	addGroup: (
		key: string,
		label: string,
	) => {
		addItem: (
			key: string,
			item: { label: string; icon: string; onRun: (ctx: never) => void },
		) => unknown;
	};
};

/** Append the chemistry group to Crepe's slash menu (used via `BlockEdit.buildMenu`). */
export function buildScienceSlashMenu(builder: SlashMenuBuilder): void {
	const group = builder.addGroup('science', '化学');
	for (const entry of SCIENCE_SLASH_LANGUAGES) {
		group.addItem(entry.key, {
			label: entry.label,
			icon: scienceSlashIcon,
			onRun: (ctx) => {
				const context = ctx as { get: (slice: unknown) => never };
				const commands = context.get(commandsCtx) as {
					call: (key: unknown, payload?: unknown) => void;
				};
				const editorView = context.get(editorViewCtx) as EditorView;
				const nodeType = editorView.state.schema.nodes[SCIENCE_FENCE_TYPE];
				commands.call(clearTextInCurrentBlockCommand.key);
				commands.call(addBlockTypeCommand.key, { nodeType, attrs: { language: entry.info } });
				if (editorView.state.selection.$from.parent.type.name === SCIENCE_FENCE_TYPE) return;
				const origin = editorView.state.selection.from;
				let found: number | null = null;
				editorView.state.doc.descendants((node, pos) => {
					if (node.type.name !== SCIENCE_FENCE_TYPE || node.content.size !== 0) return;
					if (found == null || Math.abs(pos - origin) < Math.abs(found - origin)) found = pos;
				});
				if (found != null) placeCursorInScienceBlock(editorView, found);
			},
		});
	}
	group.addItem('delete', {
		label: '删除当前块',
		icon: scienceSlashIcon,
		onRun: (ctx) => {
			const editorView = (ctx as { get: (slice: unknown) => EditorView }).get(editorViewCtx);
			dispatchScienceAction(editorView, { type: 'delete' });
		},
	});
}
