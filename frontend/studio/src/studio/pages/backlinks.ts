import { t } from '@blog/i18n/index.mjs';
import { articleBacklinks } from '../api/client';
import type { Backlink } from '../types';

const OPEN_KEY = 'studio.backlinks-open';

export type BacklinksHost = {
	/** Opens an article, at the paragraph holding `text`. */
	open(slug: string, text: string): void;
};

/**
 * Under the page's properties, as in Notion: how many articles link to the
 * open one; opened, which they are and the words around each link.
 */
export function createBacklinks(root: HTMLElement, host: BacklinksHost) {
	let slug: string | null = null;
	let found: Backlink[] = [];
	let asked = 0;
	let timer = 0;
	let open = readOpen();

	function render(): void {
		root.hidden = found.length === 0;
		const links = found.reduce((count, article) => count + article.mentions.length, 0);
		const toggle = document.createElement('button');
		toggle.type = 'button';
		toggle.className = 'backlinks-toggle';
		toggle.setAttribute('aria-expanded', String(open));
		toggle.textContent = links > found.length ? t('↗ {count} 个页面链接到这里（{links} 处）', { count: found.length, links }) : t('↗ {count} 个页面链接到这里', { count: found.length });
		toggle.addEventListener('click', () => {
			open = !open;
			writeOpen(open);
			render();
		});
		const list = document.createElement('ul');
		list.className = 'backlinks-list';
		list.hidden = !open;
		for (const article of found) {
			const item = document.createElement('li');
			const title = document.createElement('button');
			title.type = 'button';
			title.className = 'backlinks-title';
			const icon = document.createElement('span');
			icon.className = 'backlinks-icon';
			icon.textContent = article.icon || '▤';
			const name = document.createElement('span');
			name.textContent = article.title;
			title.append(icon, name);
			if (article.draft) {
				const draft = document.createElement('span');
				draft.className = 'backlinks-draft';
				draft.textContent = t('草稿');
				title.append(draft);
			}
			title.addEventListener('click', () => host.open(article.slug, article.mentions[0]?.text ?? ''));
			item.append(title);
			for (const mention of article.mentions) {
				if (!mention.context) continue;
				const line = document.createElement('button');
				line.type = 'button';
				line.className = 'backlinks-context';
				line.textContent = mention.context;
				line.addEventListener('click', () => host.open(article.slug, mention.text));
				item.append(line);
			}
			list.append(item);
		}
		root.replaceChildren(toggle, list);
	}

	async function load(): Promise<void> {
		const article = slug;
		const ask = ++asked;
		if (!article) return;
		try {
			const backlinks = await articleBacklinks(article);
			if (ask !== asked || article !== slug) return;
			found = backlinks;
		} catch {
			// The links stay as they were shown; the next change asks again.
			return;
		}
		render();
	}

	return {
		/** The article now open; done when its links are shown. */
		show(article: string): Promise<void> {
			if (article === slug) return Promise.resolve();
			slug = article;
			found = [];
			render();
			return load();
		},
		/** Some article changed: asks again, a moment after the last change. */
		changed(): void {
			window.clearTimeout(timer);
			timer = window.setTimeout(() => void load(), 500);
		},
	};
}

function readOpen(): boolean {
	try {
		return localStorage.getItem(OPEN_KEY) === '1';
	} catch {
		return false;
	}
}

function writeOpen(open: boolean): void {
	try {
		localStorage.setItem(OPEN_KEY, open ? '1' : '0');
	} catch {
		// Private windows may refuse storage; it stays this way for this visit.
	}
}
