import { setFrontmatterProps } from '@blog/document/frontmatter.ts';
import { coerceValue, COLUMN_TYPES, databaseFence, readConfig, withDatabaseFence, writeConfig } from '../../editor/database/database-config.ts';
import { parseArticleSource } from '../../../articles/schemas.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * A page as a database (数据库, as Notion's): its rows are the pages under it, each row's values that page's own
 * (`props:` at its top, `{"方法": "B3LYP", "能量": -76.4}`), its title the row's title. What columns there are, of what
 * kind, and how the rows are shown are the ```database block's (database-block.ts), in the page holding it: this is
 * the rows, read and written.
 */

export { coerceValue, COLUMN_TYPES };

class DatabaseError extends Error {
	constructor(message, statusCode = 400) {
		super(message);
		this.statusCode = statusCode;
	}
}

export class Databases {
	constructor({ articles, history, site }) {
		this.articles = articles;
		this.history = history;
		this.site = site;
	}

	/** The settings of the database in the page `slug` (its ```database block), or null: the page has none. */
	async config(slug) {
		const { source } = await this.articles.read(slug);
		const text = databaseFence(source);
		return text === null ? null : readConfig(text);
	}

	/** A choice more for a column of the database in the page `slug` (a row's page chose one not among them). */
	async addOption(slug, column, option) {
		const name = String(option ?? '').trim();
		if (!name) throw new DatabaseError(t('选项不能为空'));
		let config = null;
		await this.#rewrite(slug, (source) => {
			const text = databaseFence(source);
			if (text === null) throw new DatabaseError(t('这一页没有数据库'), 404);
			const before = readConfig(text);
			const at = before.columns.findIndex((each) => each.name === column && (each.type === 'select' || each.type === 'multi'));
			if (at < 0) throw new DatabaseError(t('数据库里没有这个选项列：{column}', { column }));
			const options = before.columns[at].options ?? [];
			config = options.includes(name) ? before : { ...before, columns: before.columns.map((each, index) => (index === at ? { ...each, options: [...options, name] } : each)) };
			return config === before ? source : withDatabaseFence(source, writeConfig(config));
		});
		return { config };
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

	/** The writes to each row's page, one after another (two cells of a row changed at once: both kept). */
	#queues = new Map();

	/** A row's text written anew by `change` (its source in, its source out), the text before it kept as a version. */
	#rewrite(slug, change) {
		const write = async () => {
			const { source, revision } = await this.articles.read(slug);
			const next = change(source);
			if (next === source) return { revision };
			return this.articles.save(slug, { source: next, expectedRevision: revision }, { site: this.site, before: (current) => this.history.keep(slug, current, 'before-change') });
		};
		const done = (this.#queues.get(slug) ?? Promise.resolve()).then(write, write);
		const settled = done.catch(() => {});
		this.#queues.set(slug, settled);
		void settled.then(() => this.#queues.get(slug) === settled && this.#queues.delete(slug));
		return done;
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
	 * The columns changed in every row (each row's text kept as a version first): one renamed (`renames`: old name →
	 * new), its values with it; one taken away (`removed`), its values with it; one of another kind now (`types`: name
	 * → kind), its values as that kind keeps them (those it cannot, gone); a choice renamed or taken away (`values`:
	 * `{ column, from, to }`, `to` null), in the rows that had it.
	 */
	async changeColumns(database, { renames = {}, removed = [], types = {}, values = [] }) {
		for (const type of Object.values(types)) if (!COLUMN_TYPES.includes(type)) throw new DatabaseError(t('没有这种列：{type}', { type }));
		const change = (before) => {
			const props = { ...before };
			for (const [from, to] of Object.entries(renames)) {
				if (!(from in props) || from === to) continue;
				props[to] = props[from];
				delete props[from];
			}
			for (const name of removed) delete props[name];
			for (const [name, type] of Object.entries(types)) {
				if (!(name in props)) continue;
				const had = props[name];
				// A list made one (多选 → 单选, words): its first; one made a list: itself.
				const kept = coerceValue(type, type === 'multi' ? had : Array.isArray(had) ? (type === 'text' ? had.join(', ') : had[0]) : had);
				if (kept === null || kept === false) delete props[name];
				else props[name] = kept;
			}
			for (const { column, from, to = null } of values) {
				const had = props[column];
				if (Array.isArray(had)) {
					const next = [...new Set(had.map((each) => (each === from ? to : each)).filter((each) => each !== null))];
					if (next.length) props[column] = next;
					else delete props[column];
				} else if (had === from) {
					if (to === null) delete props[column];
					else props[column] = to;
				}
			}
			return props;
		};
		const changed = [];
		for (const row of await this.rows(database)) {
			if (JSON.stringify(change(row.props)) === JSON.stringify(row.props)) continue;
			await this.#rewrite(row.slug, (source) => setFrontmatterProps(source, change(parseArticleSource(source).frontmatter?.props ?? {})));
			changed.push(row.slug);
		}
		return { changed };
	}
}
