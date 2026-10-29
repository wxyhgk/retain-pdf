import { setFrontmatterProps } from '@blog/document/frontmatter.ts';
import { parseArticleSource } from '../../../articles/schemas.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * A page as a database (数据库, as Notion's): its rows are the pages under it, each row's values that page's own
 * (`props:` at its top, `{"方法": "B3LYP", "能量": -76.4}`), its title the row's title. What columns there are, of what
 * kind, and how the rows are shown are the ```database block's (database-block.ts), in the page holding it: this is
 * the rows, read and written.
 */

/** The kinds of column (no formulas yet), and how a value of each is kept. */
export const COLUMN_TYPES = Object.freeze(['text', 'number', 'select', 'multi', 'date', 'checkbox', 'url']);

class DatabaseError extends Error {
	constructor(message, statusCode = 400) {
		super(message);
		this.statusCode = statusCode;
	}
}

/** `value` as a column of `type` keeps it: a number a number, a date `2026-10-29`, several choices a list; nothing, null. */
export function coerceValue(type, value) {
	if (value === null || value === undefined || value === '') return null;
	switch (type) {
		case 'number': {
			const number = typeof value === 'number' ? value : Number(String(value).trim().replace(/,/gu, ''));
			return Number.isFinite(number) ? number : null;
		}
		case 'checkbox':
			return value === true || value === 'true' || value === 1;
		case 'multi': {
			const list = Array.isArray(value) ? value : String(value).split(/[,，]/u);
			const kept = [...new Set(list.map((each) => String(each).trim()).filter(Boolean))];
			return kept.length ? kept : null;
		}
		case 'date': {
			const text = String(value).trim();
			return /^\d{4}-\d{2}-\d{2}$/u.test(text) ? text : null;
		}
		default:
			return String(value);
	}
}

export class Databases {
	constructor({ articles, history, site }) {
		this.articles = articles;
		this.history = history;
		this.site = site;
	}

	/** The rows of the database `slug`: the pages under it, in the tree's order, each with its values. */
	async rows(slug) {
		const all = await this.articles.list();
		if (!all.some((article) => article.slug === slug)) throw new DatabaseError(t('文章不存在'), 404);
		const under = all.filter((article) => article.parent === slug);
		const rows = [];
		for (const article of under) {
			const { source } = await this.articles.read(article.slug);
			const props = parseArticleSource(source).frontmatter?.props;
			rows.push({
				slug: article.slug,
				title: article.untitled ? '' : article.title,
				icon: article.icon ?? '',
				order: article.order ?? null,
				modified: article.modified ?? null,
				props: props && typeof props === 'object' && !Array.isArray(props) ? props : {},
			});
		}
		return rows.sort((left, right) => (left.order ?? Infinity) - (right.order ?? Infinity) || left.title.localeCompare(right.title, 'zh-CN', { numeric: true }));
	}

	/** A row's text written anew by `change` (its source in, its source out), the text before it kept as a version. */
	async #rewrite(slug, change) {
		const { source, revision } = await this.articles.read(slug);
		const next = change(source);
		if (next === source) return { revision };
		return this.articles.save(slug, { source: next, expectedRevision: revision }, { site: this.site, before: (current) => this.history.keep(slug, current, 'before-change') });
	}

	/** One value of a row set (`column` its column's name, of `type`), or taken out (empty). */
	async setValue(slug, column, type, value) {
		if (typeof column !== 'string' || !column.trim()) throw new DatabaseError(t('列名不能为空'));
		if (!COLUMN_TYPES.includes(type)) throw new DatabaseError(t('没有这种列：{type}', { type }));
		const kept = coerceValue(type, value);
		await this.#rewrite(slug, (source) => {
			const props = { ...(parseArticleSource(source).frontmatter?.props ?? {}) };
			if (kept === null || kept === false) delete props[column];
			else props[column] = kept;
			return setFrontmatterProps(source, props);
		});
		return { value: kept };
	}

	/** A row's title set: the page's own (the links to it follow, as when it is retitled in the Studio). */
	async setTitle(slug, title) {
		const escaped = String(title ?? '').trim().replaceAll("'", "''");
		await this.#rewrite(slug, (source) => source.replace(/^(---\r?\n[\s\S]*?^)title:.*$/mu, (_whole, before) => `${before}title: '${escaped}'`));
		return { title: String(title ?? '').trim() };
	}

	/** A row made: a page under the database, of this title and these values, its text the template's (when given). */
	async addRow(database, { slug, title = '', props = {}, body = '' }) {
		await this.articles.create({ slug, title, parent: database, body });
		const kept = Object.fromEntries(Object.entries(props).filter(([, value]) => value !== null && value !== undefined && value !== ''));
		if (Object.keys(kept).length) {
			const { source, revision } = await this.articles.read(slug);
			await this.articles.save(slug, { source: setFrontmatterProps(source, kept), expectedRevision: revision }, { site: this.site });
		}
		return { slug };
	}

	/**
	 * The columns changed in every row: one renamed (`renames`: old name → new), its values with it; one taken away
	 * (`removed`), its values with it (each row's text kept as a version first).
	 */
	async changeColumns(database, { renames = {}, removed = [] }) {
		const changed = [];
		for (const row of await this.rows(database)) {
			const touched = Object.keys(renames).some((name) => name in row.props) || removed.some((name) => name in row.props);
			if (!touched) continue;
			await this.#rewrite(row.slug, (source) => {
				const props = { ...(parseArticleSource(source).frontmatter?.props ?? {}) };
				for (const [from, to] of Object.entries(renames)) {
					if (!(from in props) || from === to) continue;
					props[to] = props[from];
					delete props[from];
				}
				for (const name of removed) delete props[name];
				return setFrontmatterProps(source, props);
			});
			changed.push(row.slug);
		}
		return { changed };
	}
}
