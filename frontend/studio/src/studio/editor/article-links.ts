import type { MilkdownPlugin } from '@milkdown/ctx';
import { Plugin, TextSelection } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';

/**
 * Links to the blog's other articles, as Notion links its pages: `[[` opens
 * the article finder and the chosen one comes in as an ordinary Markdown
 * link to its address (`[标题](/blog/slug/)`); ⌘-click on such a link opens
 * that article here.
 */

/** An address of one of the blog's articles: `/blog/<slug>/`, `/wiki/<slug>/#eq-1`. */
export const ARTICLE_ADDRESS = /^\/(?:blog|wiki)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?(?:[#?].*)?$/u;

/** What the links need from the Studio around the editor. */
export type ArticleLinkHost = {
	/** Asks which article to link to; null when given up. */
	pickArticle(): Promise<{ title: string; href: string } | null>;
	/** Opens an article of the blog in the Studio. */
	openArticle(slug: string): void;
};

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
					handleTextInput(view, from, to, text) {
						if (text !== '[' || from !== to || from < 1) return false;
						const { $from } = view.state.selection;
						if ($from.parent.type.spec.code || view.state.doc.textBetween(from - 1, from) !== '[') return false;
						// The first `[` goes; the article finder asks the rest.
						view.dispatch(view.state.tr.delete(from - 1, from));
						void linkArticleAt(view, host, from - 1, '[[');
						return true;
					},
					handleClick(_view, _pos, event) {
						if (!(event.metaKey || event.ctrlKey)) return false;
						const link = (event.target as Element | null)?.closest?.('a[href]');
						const slug = link ? ARTICLE_ADDRESS.exec(link.getAttribute('href') ?? '')?.[1] : undefined;
						if (!slug) return false;
						event.preventDefault();
						host.openArticle(slug);
						return true;
					},
				},
			}),
	);
	return [plugin].flat();
}
