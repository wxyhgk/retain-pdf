import { articlePath } from '@blog/markdown/articles/article-references.mjs';
import { PUBLISHED_FOLDERS } from '@blog/markdown/articles/rules.mjs';
import type { FileClick } from '../files/file-open';

/** A link's file of the article open, when it names one: `./assets/opt.py`, or the Studio's address of it. */
export function linkedArticleFile(href: string): string | null {
	const served = /^\/api\/studio\/articles\/[^/]+\/files\/(.+)$/u.exec(href);
	let path: string | null = null;
	try {
		path = served ? decodeURIComponent(served[1]!) : articlePath(href);
	} catch {
		return null;
	}
	return path && PUBLISHED_FOLDERS.includes(path.split('/', 1)[0]!) ? path : null;
}

/**
 * A link to a file of the article (a script, data, a PDF: `[opt.py](./assets/opt.py)`) opens it with a click, as a
 * page link opens its page: how, for a click, ⌘-click or ⌥-click, is the author's choice (file-open.ts). Heard before
 * the editor (its own handling of a click on a link would take it); ⇧-click is the editor's (it selects).
 */
export function openFileLinks(root: HTMLElement, open: (path: string, click: FileClick) => void): () => void {
	const clicked = (event: MouseEvent) => {
		if (event.button !== 0 || event.shiftKey) return;
		const link = (event.target as Element | null)?.closest?.('a[href]');
		if (!link || !root.contains(link)) return;
		const path = linkedArticleFile(link.getAttribute('href') ?? '');
		if (!path) return;
		event.preventDefault();
		event.stopPropagation();
		open(path, event.metaKey || event.ctrlKey ? 'mod' : event.altKey ? 'alt' : 'click');
	};
	root.addEventListener('click', clicked, true);
	return () => root.removeEventListener('click', clicked, true);
}
