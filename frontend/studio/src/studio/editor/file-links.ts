import { articlePath } from '@blog/markdown/articles/article-references.mjs';
import { PUBLISHED_FOLDERS } from '@blog/markdown/articles/rules.mjs';
import { textFileLanguage } from '@blog/markdown/code-files/languages.mjs';

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
 * A link to a text file of the article (a script, data: `[opt.py](./assets/opt.py)`) opens it with a click, to read
 * and edit (file-editor.ts), as a page link opens its page; other files' links are links as before. Heard before the
 * editor (its own handling of a click on a link would take it).
 */
export function openFileLinks(root: HTMLElement, open: (path: string) => void): () => void {
	const clicked = (event: MouseEvent) => {
		if (event.button !== 0 || event.shiftKey || event.altKey) return;
		const link = (event.target as Element | null)?.closest?.('a[href]');
		if (!link || !root.contains(link)) return;
		const path = linkedArticleFile(link.getAttribute('href') ?? '');
		if (!path || !textFileLanguage(path)) return;
		event.preventDefault();
		event.stopPropagation();
		open(path);
	};
	root.addEventListener('click', clicked, true);
	return () => root.removeEventListener('click', clicked, true);
}
