import type { EditorView } from 'prosemirror-view';

import type { SlashEntry } from '@blog/kernel/studio.ts';

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

/** A new, empty chemistry block of this language where the caret's (emptied) line is, the caret in it. */
function insertScienceBlock(view: EditorView, info: string): void {
	const nodeType = view.state.schema.nodes[SCIENCE_FENCE_TYPE];
	if (!nodeType) return;
	view.dispatch(view.state.tr.replaceSelectionWith(nodeType.create({ language: info })).scrollIntoView());
	if (view.state.selection.$from.parent.type.name === SCIENCE_FENCE_TYPE) return;
	const origin = view.state.selection.from;
	let found: number | null = null;
	view.state.doc.descendants((node, pos) => {
		if (node.type.name !== SCIENCE_FENCE_TYPE || node.content.size !== 0) return;
		if (found == null || Math.abs(pos - origin) < Math.abs(found - origin)) found = pos;
	});
	if (found != null) placeCursorInScienceBlock(view, found);
}

/** The 化学 group of the slash menu: a block of each kind, and deleting the one the caret is in. */
export function scienceSlashEntries(): SlashEntry[] {
	return [
		...SCIENCE_SLASH_LANGUAGES.map((entry) => ({
			key: entry.key,
			label: entry.label,
			icon: scienceSlashIcon,
			keywords: [entry.info, 'chem', 'molecule'],
			insert: (view: EditorView) => insertScienceBlock(view, entry.info),
		})),
		{
			key: 'delete',
			label: '删除当前块',
			icon: scienceSlashIcon,
			keywords: ['delete', 'remove'],
			insert: (view: EditorView) => dispatchScienceAction(view, { type: 'delete' }),
		},
	];
}
