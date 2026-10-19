import type { ArticleSummary } from '../types';
import './article-table.css';
import {
	groupArticles,
	KIND_NAMES,
	kindOf,
	knownTags,
	matchArticles,
	readSettings,
	sortArticles,
	STATUS_NAMES,
	statusOf,
	type SortKey,
	type TableSettings,
} from './table-model';
import { timeAgo } from './trash-view';

const STORAGE_KEY = 'studio.article-table';

export type ArticleTableHost = {
	/** Every article, as the sidebar has them. */
	articles(): ArticleSummary[];
	/** The article open in the editor. */
	current(): string | null;
	open(slug: string): void;
};

/** The table's columns: name, what it sorts by (none for those it cannot). */
const COLUMNS: Array<{ name: string; sort?: SortKey; className: string }> = [
	{ name: '标题', sort: 'title', className: 'col-title' },
	{ name: '简介', className: 'col-description' },
	{ name: '标签', className: 'col-tags' },
	{ name: '类型', sort: 'kind', className: 'col-kind' },
	{ name: '状态', sort: 'status', className: 'col-status' },
	{ name: '发布日期', sort: 'pubDate', className: 'col-date' },
	{ name: '编辑时间', sort: 'modified', className: 'col-modified' },
];

/**
 * All the articles as one of Notion's databases: a table that sorts by any
 * column and a board in columns by status or kind, filtered by status, kind,
 * tag and words. Opening a row opens the article. A page of its own in the
 * middle, as the drive is.
 */
export function createArticleTable(root: HTMLElement, host: ArticleTableHost) {
	let settings = loadSettings();
	let query = '';

	const heading = element('header', 'table-heading');
	const title = element('h1', '', '全部文章');
	const count = element('span', 'table-count');
	heading.append(title, count);

	const bar = element('div', 'table-bar');
	const layouts = element('div', 'table-layouts');
	layouts.setAttribute('role', 'tablist');
	const layoutButtons = (['table', 'board'] as const).map((layout) => {
		const button = element('button', 'table-layout', layout === 'table' ? '▤ 表格' : '▥ 看板');
		button.type = 'button';
		button.setAttribute('role', 'tab');
		button.dataset.layout = layout;
		button.addEventListener('click', () => change({ layout }));
		return button;
	});
	layouts.append(...layoutButtons);
	const search = element('input', 'table-search');
	search.type = 'search';
	search.placeholder = '筛选标题、简介、标签…';
	search.setAttribute('aria-label', '筛选文章');
	search.addEventListener('input', () => {
		query = search.value;
		draw();
	});
	const statusFilter = choice('状态', [['', '全部状态'], ['draft', STATUS_NAMES.draft], ['published', STATUS_NAMES.published]], (value) => change({ status: value as TableSettings['status'] }));
	const kindFilter = choice('类型', [['', '全部类型'], ['post', KIND_NAMES.post], ['wiki', KIND_NAMES.wiki]], (value) => change({ kind: value as TableSettings['kind'] }));
	const tagFilter = choice('标签', [], (value) => change({ tag: value }));
	const groupChoice = choice('分组', [['status', '按状态分组'], ['kind', '按类型分组']], (value) => change({ group: value as TableSettings['group'] }));
	bar.append(layouts, groupChoice, search, statusFilter, kindFilter, tagFilter);

	const body = element('div', 'table-body');
	root.append(heading, bar, body);

	function change(next: Partial<TableSettings>): void {
		settings = { ...settings, ...next };
		saveSettings(settings);
		draw();
	}

	function draw(): void {
		const all = host.articles();
		const shown = sortArticles(matchArticles(all, settings, query), settings.sort, settings.descending);
		count.textContent = shown.length === all.length ? `${all.length} 篇` : `${shown.length} / ${all.length} 篇`;
		for (const button of layoutButtons) button.setAttribute('aria-selected', String(button.dataset.layout === settings.layout));
		statusFilter.value = settings.status;
		kindFilter.value = settings.kind;
		const tags = knownTags(all);
		// A tag no article has any more is still shown while it is the filter, so it can be cleared.
		const offered = settings.tag && !tags.includes(settings.tag) ? [settings.tag, ...tags] : tags;
		tagFilter.replaceChildren(option('', '全部标签'), ...offered.map((tag) => option(tag, tag)));
		tagFilter.value = settings.tag;
		groupChoice.value = settings.group;
		groupChoice.hidden = settings.layout !== 'board';
		if (!all.length) body.replaceChildren(element('p', 'table-empty', '还没有文章。'));
		else if (!shown.length) body.replaceChildren(element('p', 'table-empty', '没有符合筛选的文章。'));
		else body.replaceChildren(settings.layout === 'table' ? table(shown) : board(shown));
	}

	function table(articles: ArticleSummary[]): HTMLElement {
		const grid = element('table', 'table-grid');
		const head = element('thead');
		const headRow = element('tr');
		for (const column of COLUMNS) {
			const cell = element('th', column.className);
			if (column.sort) {
				const sort = column.sort;
				const sorted = settings.sort === sort;
				const button = element('button', 'table-sort', column.name + (sorted ? (settings.descending ? ' ↓' : ' ↑') : ''));
				button.type = 'button';
				button.addEventListener('click', () => change(sorted ? { descending: !settings.descending } : { sort, descending: sort === 'modified' || sort === 'pubDate' }));
				cell.setAttribute('aria-sort', sorted ? (settings.descending ? 'descending' : 'ascending') : 'none');
				cell.append(button);
			} else {
				cell.textContent = column.name;
			}
			headRow.append(cell);
		}
		head.append(headRow);
		const rows = element('tbody');
		const current = host.current();
		for (const article of articles) {
			const row = element('tr', 'table-row');
			row.dataset.slug = article.slug;
			row.tabIndex = 0;
			row.classList.toggle('is-current', article.slug === current);
			row.addEventListener('click', () => host.open(article.slug));
			row.addEventListener('keydown', (event) => {
				if (event.key === 'Enter') host.open(article.slug);
			});
			const name = element('td', 'col-title');
			name.append(titleOf(article));
			const description = element('td', 'col-description', article.description ?? '');
			const tags = element('td', 'col-tags');
			tags.append(...(article.tags ?? []).map((tag) => element('span', 'table-tag', tag)));
			row.append(
				name,
				description,
				tags,
				element('td', 'col-kind', KIND_NAMES[kindOf(article)]),
				statusCell(article),
				element('td', 'col-date', article.pubDate ? article.pubDate.replaceAll('-', '/') : ''),
				modifiedCell(article),
			);
			rows.append(row);
		}
		grid.append(head, rows);
		return grid;
	}

	function board(articles: ArticleSummary[]): HTMLElement {
		const columns = element('div', 'table-board');
		const current = host.current();
		for (const group of groupArticles(articles, settings.group)) {
			const column = element('section', 'board-column');
			column.setAttribute('aria-label', group.name);
			const head = element('header', 'board-head');
			head.append(element('span', 'board-name', group.name), element('span', 'board-count', String(group.articles.length)));
			column.append(head);
			for (const article of group.articles) {
				const card = element('button', 'board-card');
				card.type = 'button';
				card.dataset.slug = article.slug;
				card.classList.toggle('is-current', article.slug === current);
				card.addEventListener('click', () => host.open(article.slug));
				card.append(titleOf(article));
				if (article.description) card.append(element('span', 'board-description', article.description));
				const facts = element('span', 'board-facts');
				facts.append(...(article.tags ?? []).map((tag) => element('span', 'table-tag', tag)));
				if (article.pubDate) facts.append(element('span', 'board-date', article.pubDate.replaceAll('-', '/')));
				if (facts.childElementCount) card.append(facts);
				column.append(card);
			}
			columns.append(column);
		}
		return columns;
	}

	return {
		/** Draws the table again: the articles or the open one changed. */
		refresh: draw,
		/** Shows the table, the words to filter by in focus. */
		show(): void {
			draw();
			search.focus({ preventScroll: true });
		},
	};
}

function titleOf(article: ArticleSummary): HTMLElement {
	const title = element('span', 'table-title');
	title.append(element('span', 'table-icon', article.icon || '▤'), element('span', 'table-name', article.title));
	return title;
}

function statusCell(article: ArticleSummary): HTMLElement {
	const cell = element('td', 'col-status');
	const pill = element('span', 'table-status', STATUS_NAMES[statusOf(article)]);
	pill.dataset.status = statusOf(article);
	cell.append(pill);
	return cell;
}

function modifiedCell(article: ArticleSummary): HTMLElement {
	const cell = element('td', 'col-modified', article.modified ? timeAgo(article.modified) : '');
	if (article.modified) cell.title = new Date(article.modified).toLocaleString('zh-CN');
	return cell;
}

function choice(label: string, options: Array<[string, string]>, changed: (value: string) => void): HTMLSelectElement {
	const select = element('select', 'table-filter');
	select.setAttribute('aria-label', label);
	select.append(...options.map(([value, text]) => option(value, text)));
	select.addEventListener('change', () => changed(select.value));
	return select;
}

function option(value: string, text: string): HTMLOptionElement {
	const item = document.createElement('option');
	item.value = value;
	item.textContent = text;
	return item;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

function loadSettings(): TableSettings {
	try {
		return readSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
	} catch {
		return readSettings(null);
	}
}

function saveSettings(settings: TableSettings): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// Private windows may refuse storage; the table keeps these settings for this visit.
	}
}
