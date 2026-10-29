import { $fencedBlock } from '@milkdown/kit/preset/commonmark';
import type { MilkdownPlugin } from '@milkdown/ctx';
import type { Node as ProseNode } from '@milkdown/prose/model';
import { NodeSelection } from '@milkdown/prose/state';
import type { EditorView, NodeView } from '@milkdown/prose/view';
import { $view } from '@milkdown/utils';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { readConfig, writeConfig, type DatabaseConfig } from './database-config';
import { DatabaseView, type DatabaseHost } from './DatabaseView';
import './database.css';

/**
 * A ```database block (数据库, as Notion's): the pages under the page holding it as rows (their values theirs:
 * server/articles/databases.mjs), drawn by DatabaseView as a table or a board. Its text is its settings
 * (database-config.ts): its columns, view, filters, order, the template a new row is made from; changed in the view,
 * the text is written anew (an edit of the article, undone as one).
 */

export const DATABASE_LANGUAGE = 'database';
export const DATABASE_TYPE = 'database_block';

export const databaseSchema = $fencedBlock(DATABASE_TYPE, (language) => language.trim().toLowerCase() === DATABASE_LANGUAGE, () => ({
	atom: true,
	isolating: true,
	selectable: true,
}));

let host: ((view: EditorView) => DatabaseHost | null) | null = null;
/** What the blocks ask the Studio (the rows of the page shown, a value written…), given the editor they are in. */
export function setDatabaseHost(next: typeof host): void {
	host = next;
}

/** A new database where the caret's (empty) block is: no columns yet, its rows the pages under this one. */
export function insertDatabase(view: EditorView): void {
	const { state } = view;
	const type = state.schema.nodes[DATABASE_TYPE];
	if (!type) return;
	const { $from } = state.selection;
	const block = type.create({ language: DATABASE_LANGUAGE }, state.schema.text(writeConfig(readConfig(''))));
	const tr = state.tr.replaceWith($from.before(), $from.after(), block);
	view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, $from.before())).scrollIntoView());
}

export const databaseView = $view(databaseSchema.schema.node, () => (initial: ProseNode, view: EditorView, getPos: () => number | undefined): NodeView => {
	let node = initial;
	const dom = document.createElement('div');
	dom.className = 'database-block';
	dom.contentEditable = 'false';
	// The shell's look (Tailwind, shadcn) is theirs inside [data-ui].
	dom.dataset.ui = '';
	// Its presses its own (a card or a row dragged, a column's edge), not the editor's selecting of blocks.
	dom.dataset.ownsPointer = '';
	// Focus taken by it, not the editor: a press on a card or a cell would else focus the editor, which then scrolls back
	// to its caret (wherever it was), the press's drag lost.
	dom.tabIndex = -1;
	const root = createRoot(dom);

	/** The settings changed in the view: the block's text written anew. */
	const change = (next: DatabaseConfig) => {
		const pos = getPos();
		if (pos == null) return;
		const current = view.state.doc.nodeAt(pos);
		if (!current) return;
		const block = current.type.create(current.attrs, view.state.schema.text(writeConfig(next)));
		view.dispatch(view.state.tr.replaceWith(pos, pos + current.nodeSize, block));
	};
	const draw = () => {
		const asked = host?.(view);
		if (!asked) {
			dom.textContent = '';
			return;
		}
		root.render(createElement(DatabaseView, { config: readConfig(node.textContent), change, host: asked }));
	};
	draw();

	return {
		dom,
		update(next) {
			if (next.type !== node.type) return false;
			node = next;
			draw();
			return true;
		},
		// What is done in the view (typing in a cell, a menu, a card dragged) is the view's, not the editor's; the block
		// itself is moved by its handle, outside it.
		stopEvent: () => true,
		ignoreMutation: () => true,
		selectNode: () => dom.classList.add('is-selected'),
		deselectNode: () => dom.classList.remove('is-selected'),
		destroy: () => queueMicrotask(() => root.unmount()),
	};
});

export const databasePlugins: MilkdownPlugin[] = [databaseSchema, databaseView].flat();
