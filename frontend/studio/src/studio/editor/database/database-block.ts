import { $fencedBlock } from '@milkdown/kit/preset/commonmark';
import type { MilkdownPlugin } from '@milkdown/ctx';
import type { Node as ProseNode } from '@milkdown/prose/model';
import { NodeSelection } from '@milkdown/prose/state';
import type { EditorView, NodeView } from '@milkdown/prose/view';
import { $view } from '@milkdown/utils';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { newDatabaseId } from '../../../articles/database-blocks.mjs';
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

let host: ((id: string | null) => DatabaseHost | null) | null = null;
/** What a block asks the Studio (its rows in the page shown, a value written…), given which database it is. */
export function setDatabaseHost(next: typeof host): void {
	host = next;
}

/** A new database where the caret's (empty) block is: no columns yet, its rows the pages under this one. */
export function insertDatabase(view: EditorView): void {
	const { state } = view;
	const type = state.schema.nodes[DATABASE_TYPE];
	if (!type) return;
	const { $from } = state.selection;
	const block = type.create({ language: DATABASE_LANGUAGE }, state.schema.text(writeConfig({ ...readConfig(''), id: newDatabaseId() })));
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
	// As Notion's: the table out to the right of the editor (the text column's width is too narrow for many columns),
	// how far told it as --db-out; its title and tools stay over the text.
	const reach = () => {
		const scroller = dom.closest<HTMLElement>('.editor-scroll');
		if (!scroller || !dom.isConnected) return;
		const out = Math.max(0, Math.floor(scroller.getBoundingClientRect().right - dom.getBoundingClientRect().right - (scroller.offsetWidth - scroller.clientWidth) - 24));
		if (dom.style.getPropertyValue('--db-out') !== `${out}px`) dom.style.setProperty('--db-out', `${out}px`);
	};
	const sizes = new ResizeObserver(reach);
	sizes.observe(dom);
	requestAnimationFrame(() => {
		const scroller = dom.closest('.editor-scroll');
		if (scroller) sizes.observe(scroller);
		reach();
	});

	/** The settings changed in the view: the block's text written anew. */
	const change = (next: DatabaseConfig) => {
		const pos = getPos();
		if (pos == null) return;
		const current = view.state.doc.nodeAt(pos);
		if (!current) return;
		const block = current.type.create(current.attrs, view.state.schema.text(writeConfig(next)));
		view.dispatch(view.state.tr.replaceWith(pos, pos + current.nodeSize, block));
	};
	/** A block from before ids being given one: drawn once its rows say it (or as it was, when that failed). */
	let adopting = false;
	let adoptFailed = false;
	const draw = () => {
		const config = readConfig(node.textContent);
		const asked = host?.(config.id);
		if (!asked) {
			dom.textContent = '';
			return;
		}
		if (!config.id && view.editable && !adoptFailed) {
			// From before ids: an id for it, and its rows (the pages under the page naming no database) told it; then the
			// block's text with it (an edit of the article).
			if (adopting) return;
			adopting = true;
			const id = newDatabaseId();
			void asked.adopt(id).then(
				() => change({ ...readConfig(node.textContent), id }),
				(error: unknown) => {
					adoptFailed = true;
					asked.toast(error instanceof Error ? error.message : String(error), true);
				},
			).finally(() => {
				adopting = false;
				draw();
			});
			return;
		}
		if (config.id) dom.dataset.databaseId = config.id;
		root.render(createElement(DatabaseView, { key: config.id ?? '', config, change, host: asked }));
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
		destroy: () => {
			sizes.disconnect();
			queueMicrotask(() => root.unmount());
		},
	};
});

export const databasePlugins: MilkdownPlugin[] = [databaseSchema, databaseView].flat();
