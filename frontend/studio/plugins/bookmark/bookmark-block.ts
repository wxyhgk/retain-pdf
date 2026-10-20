import { $fencedBlock } from '@milkdown/kit/preset/commonmark';
import { NodeSelection } from '@milkdown/prose/state';
import type { Node as ProseNode } from '@milkdown/prose/model';
import type { EditorView, NodeView } from '@milkdown/prose/view';
import { $view } from '@milkdown/utils';

import { BOOKMARK_LANGUAGE, bookmarkCard, parseBookmark, webAddress, writeBookmark, type Bookmark } from './bookmark.mjs';

/**
 * A ```bookmark fence in the editor: its card, as on the blog. Empty, it
 * asks for an address; given one, the dev server reads the page (server.mjs)
 * and what it read is written into the fence. 打开 opens the page, 重新获取
 * reads it again, 改网址 asks for another.
 */

export const BOOKMARK_TYPE = 'bookmark_block';

export const bookmarkSchema = $fencedBlock(BOOKMARK_TYPE, (language) => language.trim().toLowerCase() === BOOKMARK_LANGUAGE, () => ({
	atom: true,
	isolating: true,
}));

/** What the block needs from the plugin: the page read, and a word to the writer. */
export type BookmarkHost = {
	preview(url: string): Promise<Bookmark>;
	toast(message: string, error?: boolean): void;
};

let host: BookmarkHost | null = null;
export function setBookmarkHost(next: BookmarkHost | null): void {
	host = next;
}

/** Blocks just put in, whose address field takes the caret once drawn. */
const opening = new WeakSet<ProseNode>();

/** A new, empty bookmark where the caret's (empty) block is; its address field takes the caret. */
export function insertBookmark(view: EditorView): void {
	const { state } = view;
	const type = state.schema.nodes[BOOKMARK_TYPE];
	if (!type) return;
	const { $from } = state.selection;
	const block = type.create({ language: BOOKMARK_LANGUAGE });
	opening.add(block);
	const tr = state.tr.replaceWith($from.before(), $from.after(), block);
	view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, $from.before())).scrollIntoView());
}

type Hast = { type: 'element'; tagName: string; properties: Record<string, unknown>; children: (Hast | { type: 'text'; value: string })[] };

/** The card as DOM. In the editor it is not a link (a click selects the block; 打开 opens the page): its `<a>` is a `<div>`. */
function toDom(node: Hast): HTMLElement {
	const element = document.createElement(node.tagName === 'a' ? 'div' : node.tagName);
	for (const [key, value] of Object.entries(node.properties)) {
		if (key === 'className') element.className = (value as string[]).join(' ');
		else if (key === 'referrerPolicy') element.setAttribute('referrerpolicy', String(value));
		else if (key !== 'href' && key !== 'target' && key !== 'rel') element.setAttribute(key, Array.isArray(value) ? value.join(' ') : String(value));
	}
	for (const child of node.children) element.append(child.type === 'text' ? document.createTextNode(child.value) : toDom(child));
	return element;
}

function button(label: string, action: () => void): HTMLButtonElement {
	const element = document.createElement('button');
	element.type = 'button';
	element.textContent = label;
	element.addEventListener('mousedown', (event) => event.preventDefault());
	element.addEventListener('click', (event) => {
		event.preventDefault();
		action();
	});
	return element;
}

export const bookmarkView = $view(bookmarkSchema.schema.node, () => (initial: ProseNode, view: EditorView, getPos: () => number | undefined): NodeView => {
	let node = initial;
	let bookmark = parseBookmark(node.textContent);
	let editing = !bookmark.url;
	let reading = false;
	const dom = document.createElement('div');
	dom.className = 'bookmark-block';
	dom.contentEditable = 'false';

	/** Writes the fence anew; the view is drawn from the document again. */
	const write = (next: Bookmark) => {
		const pos = getPos();
		if (pos == null) return;
		const current = view.state.doc.nodeAt(pos);
		if (!current) return;
		const text = writeBookmark(next);
		const block = current.type.create(current.attrs, text ? view.state.schema.text(text) : null);
		const tr = view.state.tr.replaceWith(pos, pos + current.nodeSize, block);
		view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, pos)));
	};

	const read = async (url: string) => {
		const address = webAddress(url);
		if (!address) {
			host?.toast('网址要以 http:// 或 https:// 开头', true);
			return;
		}
		editing = false;
		reading = true;
		// Another page: what was read of the last one is not this one's.
		bookmark = address === webAddress(bookmark.url) ? bookmark : { url: address, title: '', description: '', image: '', site: '' };
		write(bookmark);
		paint();
		try {
			if (!host) throw new Error('网页书签插件没有启动');
			const found = await host.preview(address);
			reading = false;
			bookmark = { ...found, url: address };
			write(bookmark);
		} catch (error) {
			reading = false;
			paint();
			host?.toast(`没能读取这个网页：${error instanceof Error ? error.message : String(error)}`, true);
		}
	};

	const paint = () => {
		dom.replaceChildren();
		dom.classList.toggle('is-reading', reading);
		if (editing) {
			const form = document.createElement('form');
			form.className = 'bookmark-block-form';
			// The address is checked here, said in a toast, not in the browser's bubble.
			form.noValidate = true;
			const input = document.createElement('input');
			input.type = 'url';
			input.placeholder = '粘贴网址，回车（网页、DOI 都行）';
			input.value = bookmark.url;
			input.setAttribute('aria-label', '书签的网址');
			form.append(input);
			if (bookmark.url) form.append(button('取消', () => {
				editing = false;
				paint();
				view.focus();
			}));
			form.addEventListener('submit', (event) => {
				event.preventDefault();
				void read(input.value);
			});
			input.addEventListener('keydown', (event) => {
				if (event.key === 'Escape' && bookmark.url) {
					editing = false;
					paint();
					view.focus();
				}
			});
			dom.append(form);
			if (opening.has(node)) {
				opening.delete(node);
				requestAnimationFrame(() => input.focus());
			}
			return;
		}
		dom.append(toDom(bookmarkCard(bookmark) as Hast));
		if (reading) {
			const note = document.createElement('div');
			note.className = 'bookmark-block-reading';
			note.textContent = '正在读取网页…';
			dom.append(note);
			return;
		}
		const actions = document.createElement('div');
		actions.className = 'bookmark-block-actions';
		actions.append(
			button('打开', () => window.open(webAddress(bookmark.url), '_blank', 'noopener,noreferrer')),
			button('重新获取', () => void read(bookmark.url)),
			button('改网址', () => {
				editing = true;
				opening.add(node);
				paint();
			}),
		);
		dom.append(actions);
	};

	paint();
	return {
		dom,
		update: (updated) => {
			if (updated.type !== initial.type) return false;
			if (updated === node) return true;
			const wasOpening = opening.has(node);
			node = updated;
			if (wasOpening) opening.add(node);
			if (!reading) {
				bookmark = parseBookmark(node.textContent);
				if (!bookmark.url) editing = true;
			}
			paint();
			return true;
		},
		selectNode: () => dom.classList.add('ProseMirror-selectednode'),
		deselectNode: () => dom.classList.remove('ProseMirror-selectednode'),
		ignoreMutation: () => true,
		stopEvent: (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return false;
			if (event.type === 'dragstart') return false;
			return Boolean(target.closest('button, input, form'));
		},
	};
});

export const bookmarkBlockPlugins = [...bookmarkSchema, bookmarkView];
