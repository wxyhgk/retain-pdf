import { listArticles } from '../api/client.ts';
import type { ArticleProperties, ArticleSummary } from '../types.ts';
import { showContextMenu } from './context-menu.ts';
import type { DiskChange } from './disk-events.ts';

/** What can be done to a whole article from the list. */
export type ArticleListHost = {
	open(slug: string): void;
	rename(article: ArticleSummary): void;
	duplicate(article: ArticleSummary): void;
	remove(article: ArticleSummary): void;
};

const REFRESH_DELAY_MS = 300;

/** Articles whose title or folder holds the query, ignoring case. */
export function filterArticles(articles: ArticleSummary[], query: string): ArticleSummary[] {
	const needle = query.trim().toLocaleLowerCase('zh-CN');
	if (!needle) return articles;
	return articles.filter((article) => `${article.title}\n${article.slug}`.toLocaleLowerCase('zh-CN').includes(needle));
}

/** The pages in the sidebar, with their search. */
export function createArticleList(root: HTMLElement, host: ArticleListHost) {
	const list = root.querySelector<HTMLElement>('#article-list')!;
	const search = root.querySelector<HTMLInputElement>('#article-search')!;
	let articles: ArticleSummary[] = [];
	let selected: string | null = null;
	let refreshTimer = 0;

	function row(article: ArticleSummary): HTMLButtonElement {
		const active = article.slug === selected;
		const open = document.createElement('button');
		open.type = 'button';
		open.className = `page-row${active ? ' active' : ''}`;
		open.setAttribute('aria-current', active ? 'page' : 'false');
		const icon = document.createElement('span');
		icon.className = 'page-icon';
		icon.textContent = '▤';
		const title = document.createElement('span');
		title.className = 'page-title';
		title.textContent = article.title;
		open.append(icon, title);
		if (article.draft !== false) {
			const draft = document.createElement('span');
			draft.className = 'page-draft';
			draft.textContent = '草稿';
			draft.title = '尚未发布';
			open.append(draft);
		}
		open.addEventListener('click', () => host.open(article.slug));
		// Right-click, or the menu key: what else can be done to it.
		const menu = (at: { x: number; y: number } | HTMLElement) => showContextMenu([
			{ label: '改文件夹名…', action: () => host.rename(article) },
			{ label: '复制一份', action: () => host.duplicate(article) },
			'separator',
			{ label: '移到回收站', danger: true, action: () => host.remove(article) },
		], at);
		open.addEventListener('contextmenu', (event) => {
			event.preventDefault();
			menu({ x: event.clientX, y: event.clientY });
		});
		open.addEventListener('keydown', (event) => {
			if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) return;
			event.preventDefault();
			menu(open);
		});
		return open;
	}

	function render(): void {
		const visible = filterArticles(articles, search.value);
		list.replaceChildren();
		if (!visible.length) {
			const empty = document.createElement('p');
			empty.className = 'article-list-empty';
			empty.textContent = articles.length ? '没有匹配的文章。' : '还没有文章。点击 ＋ 创建第一篇笔记。';
			list.append(empty);
			return;
		}
		const pages = document.createElement('div');
		pages.className = 'page-list';
		pages.append(...visible.map(row));
		list.append(pages);
	}

	/** Reads the articles again. */
	async function load(): Promise<ArticleSummary[]> {
		articles = await listArticles();
		render();
		return articles;
	}

	search.addEventListener('input', render);

	return {
		load,
		/** Marks the open article. */
		select(slug: string): void {
			selected = slug;
			render();
		},
		/** An article's saved title and draft state. */
		saved(slug: string, properties: ArticleProperties): void {
			const article = articles.find((entry) => entry.slug === slug);
			if (!article) return;
			article.title = properties.title;
			article.draft = properties.draft;
			render();
		},
		/** Something changed in blog/: an article may have come, gone or been retitled. */
		changedOnDisk(changes: DiskChange[]): void {
			if (!changes.some((change) => change.paths.includes('') || change.paths.includes('index.md'))) return;
			window.clearTimeout(refreshTimer);
			refreshTimer = window.setTimeout(() => { load().catch(() => {}); }, REFRESH_DELAY_MS);
		},
	};
}
