import { $fencedBlock } from '@milkdown/kit/preset/commonmark';
import type { MilkdownPlugin } from '@milkdown/ctx';
import type { Node as ProseNode } from '@milkdown/prose/model';
import { NodeSelection } from '@milkdown/prose/state';
import type { EditorView, NodeView } from '@milkdown/prose/view';
import { $view } from '@milkdown/utils';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { t } from '@blog/i18n/index.mjs';
import { referenceText, sourceOf } from '../../../articles/database-blocks.mjs';
import { readConfig, writeConfig, type DatabaseConfig } from './database-config';
import { LinkedDatabase, type DatabaseSpace } from './DatabaseLinked';
import { said } from './database-parts';
import { DatabaseView } from './DatabaseView';
import './database.css';

/**
 * A ```database block (数据库, as Notion's). A database is a page of its own (`type: database`), its rows the pages under
 * it (server/articles/databases.mjs); in that page its block is its settings (database-config.ts: its columns, view,
 * filters, order, the template a new row is made from), changed in the view as an edit of the page (undone as one), the
 * database the whole page. In any other page a block names it (`{"source": "<its folder>"}`) and shows it there, its
 * settings read from its page and written back there (DatabaseLinked.tsx). A block from before databases were pages
 * (its settings in an ordinary page) is made a database of its own when it is shown, and then names it.
 */

export const DATABASE_LANGUAGE = 'database';
export const DATABASE_TYPE = 'database_block';

export const databaseSchema = $fencedBlock(DATABASE_TYPE, (language) => language.trim().toLowerCase() === DATABASE_LANGUAGE, () => ({
	atom: true,
	isolating: true,
	selectable: true,
}));

let space: DatabaseSpace | null = null;
/** What a block asks the Studio (the page shown, a database's rows and settings, one made…). */
export function setDatabaseSpace(next: DatabaseSpace | null): void {
	space = next;
}

/** A new database (a page under this one, no columns yet) shown where the caret's (empty) block is, as Notion's inline database. */
export function insertDatabase(view: EditorView): void {
	const type = view.state.schema.nodes[DATABASE_TYPE];
	if (!type || !space) return;
	const asked = { doc: view.state.doc, from: view.state.selection.$from.before(), to: view.state.selection.$from.after() };
	void space.create().then(
		(slug) => {
			const { state } = view;
			const block = type.create({ language: DATABASE_LANGUAGE }, state.schema.text(referenceText(slug)));
			// Where it was asked, the page as it was then; else (typed on meanwhile) where the caret is now.
			const [from, to] = state.doc.eq(asked.doc) ? [asked.from, asked.to] : [state.selection.from, state.selection.from];
			const tr = from === to ? state.tr.insert(from, block) : state.tr.replaceWith(from, to, block);
			view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, from)).scrollIntoView());
		},
		(error: unknown) => space?.toast(said(error), true),
	);
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

	/** The block's text written anew (an edit of the page). */
	const write = (text: string) => {
		const pos = getPos();
		if (pos == null) return;
		const current = view.state.doc.nodeAt(pos);
		if (!current) return;
		const block = current.type.create(current.attrs, view.state.schema.text(text));
		view.dispatch(view.state.tr.replaceWith(pos, pos + current.nodeSize, block));
	};
	/** The settings changed in the view, in the database's own page: the block's text written anew. */
	const change = (next: DatabaseConfig) => write(writeConfig(next));
	const note = (text: string, error = false) => root.render(createElement('div', { className: 'db' }, createElement('p', { className: error ? 'db-note is-error' : 'db-note' }, text)));
	/** A block from before being made a database of its own; once failed, not asked again. */
	let detaching = false;
	let detachFailed = false;
	const draw = () => {
		const text = node.textContent;
		const page = space?.page();
		if (!space || !page) {
			dom.textContent = '';
			return;
		}
		const source = sourceOf(text);
		dom.classList.toggle('is-own', !source && page.database);
		if (source) {
			dom.dataset.database = source;
			root.render(createElement(LinkedDatabase, { key: source, slug: source, space }));
		} else if (page.database) {
			dom.dataset.database = page.slug;
			root.render(createElement(DatabaseView, { key: page.slug, config: readConfig(text), change, host: space.host(page.slug) }));
		} else if (!view.editable || detachFailed) {
			delete dom.dataset.database;
			note(t('这是旧的数据库块，还没改成数据库页面'), detachFailed);
		} else if (!detaching) {
			// From before databases were pages: made one (a page under this one, the rows that were its under it), then
			// the block names it (an edit of this page).
			detaching = true;
			note(t('正在把它改成数据库页面…'));
			const asked = space;
			void asked.detach(text).then(
				(slug) => write(referenceText(slug)),
				(error: unknown) => {
					detachFailed = true;
					asked.toast(said(error), true);
				},
			).finally(() => {
				detaching = false;
				draw();
			});
		}
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
