import type { MilkdownPlugin } from '@milkdown/ctx';
import type { Node as ProseNode } from '@milkdown/prose/model';
import { Plugin, PluginKey, TextSelection } from '@milkdown/prose/state';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';

import { ARTICLE_ADDRESS } from '@blog/markdown/articles/rules.mjs';
import { changedRange } from '@blog/editor-kit/changed-range.ts';

/**
 * Links to the blog's other articles, as Notion links its pages: `[[` opens
 * the article finder and the chosen one comes in as an ordinary Markdown
 * link to its address (`[标题](/blog/slug/)`); ⌘-click on such a link opens
 * that article here.
 *
 * And pages, as Notion's: 页面 (/page) makes a page under the article and
 * puts a line linking to it where the caret is; a line that is only a link to
 * one of the blog's articles shows as a page (pm-page-link), opened with a
 * click. Its words follow the page's title (the server changes them as the
 * page is retitled), and it is the Markdown link it was.
 */

/** What the links need from the Studio around the editor. */
export type ArticleLinkHost = {
	/** Asks which article to link to; null when given up. */
	pickArticle(): Promise<{ title: string; href: string } | null>;
	/** Opens an article of the blog in the Studio. */
	openArticle(slug: string): void;
	/** The title of one of the blog's articles; null when there is none by that name. */
	articleTitle(slug: string): string | null;
	/** 页面: a page made under the article shown, to link to; null when it could not be. */
	makePage(): Promise<{ slug: string; title: string; href: string } | null>;
	/** Goes into the page just made (the article linking to it saved first), its title to be typed. */
	enterPage(slug: string): void;
};

/**
 * 页面, as Notion's /page: a page made under the article, a line linking to it where the caret is (in a block emptied
 * for it), and the editor goes into it.
 */
export async function insertPage(view: EditorView, host: ArticleLinkHost): Promise<void> {
	const at = view.state.selection.from;
	const page = await host.makePage();
	const link = view.state.schema.marks.link;
	if (!page || !link || view.isDestroyed) return;
	const pos = Math.min(at, view.state.doc.content.size);
	view.dispatch(view.state.tr.insert(pos, view.state.schema.text(page.title, [link.create({ href: page.href, title: null })])));
	host.enterPage(page.slug);
}

/** The article a paragraph links to when it is that link and nothing else; null for any other block. */
function pageLinked(node: ProseNode): string | null {
	if (node.type.name !== 'paragraph' || !node.childCount) return null;
	let href: string | null = null;
	let alone = true;
	node.forEach((child) => {
		const link = child.isText ? child.marks.find((mark) => mark.type.name === 'link') : undefined;
		const address = link ? String(link.attrs.href ?? '') : null;
		if (!address || (href !== null && address !== href)) alone = false;
		href ??= address;
	});
	return alone && href ? (ARTICLE_ADDRESS.exec(href)?.[2] ?? null) : null;
}

/** The page lines between `from` and `to` in `doc` (and in the blocks holding that stretch). */
function pageLines(doc: ProseNode, from: number, to: number): Decoration[] {
	const found: Decoration[] = [];
	doc.nodesBetween(from, to, (node, pos) => {
		if (!node.isTextblock) return !node.isInline;
		if (pageLinked(node)) found.push(Decoration.node(pos, pos + node.nodeSize, { class: 'pm-page-link' }));
		return false;
	});
	return found;
}

const pageLinesKey = new PluginKey<DecorationSet>('studio-page-lines');

/**
 * Asks for an article and links it at `at`, as its title; given up, `typed`
 * goes back where it was (the `[[` that asked).
 */
export async function linkArticleAt(view: EditorView, host: ArticleLinkHost, at: number, typed = ''): Promise<void> {
	const chosen = await host.pickArticle();
	if (view.isDestroyed) return;
	const { state } = view;
	const pos = Math.min(at, state.doc.content.size);
	const link = state.schema.marks.link;
	let tr = state.tr;
	if (chosen && link) {
		tr = tr.insert(pos, state.schema.text(chosen.title, [link.create({ href: chosen.href, title: null })]));
		const end = pos + chosen.title.length;
		// Typing on after the link is not more of it.
		tr = tr.setSelection(TextSelection.create(tr.doc, end)).removeStoredMark(link);
	} else if (typed) {
		tr = tr.insertText(typed, pos).setSelection(TextSelection.create(tr.doc, pos + typed.length));
	}
	view.dispatch(tr.scrollIntoView());
	view.focus();
}

export function articleLinkPlugins(host: ArticleLinkHost): MilkdownPlugin[] {
	const plugin = $prose(
		() =>
			new Plugin({
				props: {
					// `[[`, or `【【` as a Chinese input method types it (one that pairs
					// brackets types `【】` at each press: the `】`s go too).
					handleTextInput(view, from, to, text) {
						const open = text === '[' ? '[' : text === '【' || text === '【】' ? '【' : null;
						if (!open || from !== to || from < 1) return false;
						const { doc, selection } = view.state;
						if (selection.$from.parent.type.spec.code || doc.textBetween(from - 1, from) !== open) return false;
						const paired = open === '【' && doc.textBetween(from, Math.min(from + 1, selection.$from.end())) === '】';
						// The first bracket goes; the article finder asks the rest.
						view.dispatch(view.state.tr.delete(from - 1, paired ? from + 1 : from));
						void linkArticleAt(view, host, from - 1, open + open);
						return true;
					},
					handleClick(_view, _pos, event) {
						const target = event.target as Element | null;
						// A page's line opens it with a click, as in Notion; any link to an article with ⌘-click.
						const page = target?.closest?.('.pm-page-link a[href]');
						if (!(event.metaKey || event.ctrlKey) && !page) return false;
						const link = page ?? target?.closest?.('a[href]');
						const slug = link ? ARTICLE_ADDRESS.exec(link.getAttribute('href') ?? '')?.[2] : undefined;
						if (!slug) return false;
						event.preventDefault();
						host.openArticle(slug);
						return true;
					},
				},
			}),
	);
	// Looked for at first in the whole article, then only round each edit (a long article has thousands of blocks).
	const pages = $prose(
		() =>
			new Plugin<DecorationSet>({
				key: pageLinesKey,
				state: {
					init: (_, state) => DecorationSet.create(state.doc, pageLines(state.doc, 0, state.doc.content.size)),
					apply(tr, lines, before, after) {
						if (!tr.docChanged) return lines;
						const mapped = lines.map(tr.mapping, tr.doc);
						const range = changedRange(before.doc, after.doc);
						if (!range) return mapped;
						const from = Math.max(0, range.from - 1);
						const to = Math.min(after.doc.content.size, range.toAfter + 1);
						// Those found touch the stretch, a line just before or after it among them (one written under a page
						// line ends where the new one begins): each looked at again, not only those in the stretch.
						const stale = mapped.find(from, to);
						const start = Math.min(from, ...stale.map((line) => line.from));
						const end = Math.max(to, ...stale.map((line) => line.to));
						return mapped.remove(stale).add(after.doc, pageLines(after.doc, start, end));
					},
				},
				props: { decorations: (state) => pageLinesKey.getState(state) },
			}),
	);
	return [plugin, pages].flat();
}
