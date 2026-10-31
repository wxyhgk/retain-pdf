import { setFrontmatterDatabase, setFrontmatterField, setFrontmatterProps } from '@blog/document/frontmatter.ts';
import { coerceValue, COLUMN_TYPES, readConfig, writeConfig } from '../../editor/database/database-config.ts';
import { parseArticleSource } from '../../../articles/schemas.mjs';
import { databaseBlocks, definitionText, mapDatabaseBlocks, referenceText, sourceOf, withDefinitionText } from '../../../articles/database-blocks.mjs';
import { autoSlug, freeSlug } from '../../pages/page-names.ts';
import { t } from '@blog/i18n/index.mjs';

/**
 * A database (数据库, as Notion's): a page of its own (`type: database`), its rows the pages under it, each row's values
 * that page's own (`props:` at its top, `{"方法": "B3LYP", "能量": -76.4}`), its title the row's title; what columns
 * there are, of what kind, and how the rows are shown its ```database block (database-blocks.mjs). Opened, it is the
 * database the whole page; a ```database block naming it shows it in any other page. A database is asked for by its
 * page's folder name. A block from before databases were pages (its columns in it, in an ordinary page) is made one:
 * `detach`, all of them at once when the server starts (`migrate`).
 */

export { coerceValue, COLUMN_TYPES };

class DatabaseError extends Error {
	constructor(message, statusCode = 400) {
		super(message);
		this.statusCode = statusCode;
	}
}

/** A database page's text: its settings in a ```database block, nothing else. */
const definitionBody = (config) => `\`\`\`database\n${writeConfig(config)}\n\`\`\``;

export class Databases {
	constructor({ articles, history, site }) {
		this.articles = articles;
		this.history = history;
		this.site = site;
	}

	/** The database `slug`: its settings, title and icon; null when that page is not a database (or not there). */
	async info(slug) {
		let page;
		try {
			page = await this.articles.read(slug);
		} catch {
			return null;
		}
		if (page.properties.type !== 'database') return null;
		return { config: readConfig(definitionText(page.source) ?? ''), title: page.properties.title, icon: page.properties.icon ?? '' };
	}

	/** The settings of the database `slug`, or null: that page is not one. */
	async config(slug) {
		return (await this.info(slug))?.config ?? null;
	}

	/** The database `slug`'s text, changed by `change` (its settings in, its settings out). */
	async #changeConfig(slug, change) {
		let config = null;
		await this.#rewrite(slug, (source) => {
			if (parseArticleSource(source).frontmatter?.type !== 'database') throw new DatabaseError(t('这一页不是数据库'), 404);
			const before = readConfig(definitionText(source) ?? '');
			config = change(before);
			return config === before ? source : withDefinitionText(source, writeConfig(config));
		});
		return { config };
	}

	/** The database `slug`'s settings as given (shown from another page, changed there). */
	async setConfig(slug, given) {
		if (!given || typeof given !== 'object' || Array.isArray(given)) throw new DatabaseError(t('数据库的设置无效'));
		return this.#changeConfig(slug, (before) => readConfig(JSON.stringify({ ...given, id: before.id, title: before.title })));
	}

	/** A choice more for a column of the database `slug` (a row's page chose one not among them). */
	async addOption(slug, column, option) {
		const name = String(option ?? '').trim();
		if (!name) throw new DatabaseError(t('选项不能为空'));
		return this.#changeConfig(slug, (before) => {
			const at = before.columns.findIndex((each) => each.name === column && (each.type === 'select' || each.type === 'multi'));
			if (at < 0) throw new DatabaseError(t('数据库里没有这个选项列：{column}', { column }));
			const options = before.columns[at].options ?? [];
			return options.includes(name) ? before : { ...before, columns: before.columns.map((each, index) => (index === at ? { ...each, options: [...options, name] } : each)) };
		});
	}

	/** The rows of the database `slug`: the pages under it, in the tree's order, with their values. */
	async rows(slug) {
		const all = await this.articles.list();
		if (!all.some((article) => article.slug === slug)) throw new DatabaseError(t('文章不存在'), 404);
		const rows = [];
		for (const article of all.filter((each) => each.parent === slug)) {
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

	/** The writes to each page, one after another (two cells of a row changed at once: both kept). */
	#queues = new Map();

	/** A page's text written anew by `change` (its source in, its source out), the text before it kept as a version. */
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

	/** Several values of a row set at once (a block pasted): `[{ column, type, value }]`, one write; what each kept. */
	async setValues(slug, values) {
		if (!Array.isArray(values) || !values.length) throw new DatabaseError(t('没有要改的值'));
		const kept = values.map(({ column, type, value }) => {
			if (typeof column !== 'string' || !column.trim()) throw new DatabaseError(t('列名不能为空'));
			if (!COLUMN_TYPES.includes(type)) throw new DatabaseError(t('没有这种列：{type}', { type }));
			return { column, value: coerceValue(type, value) };
		});
		await this.#rewrite(slug, (source) => {
			const props = { ...(parseArticleSource(source).frontmatter?.props ?? {}) };
			for (const { column, value } of kept) {
				if (value === null || value === false) delete props[column];
				else props[column] = value;
			}
			return setFrontmatterProps(source, props);
		});
		return { values: kept.map(({ value }) => value) };
	}

	/** A page's title set (a row's, a database's): its own (the links to it follow, as when it is retitled in the Studio). */
	async setTitle(slug, title) {
		const escaped = String(title ?? '').trim().replaceAll("'", "''");
		await this.#rewrite(slug, (source) => source.replace(/^(---\r?\n[\s\S]*?^)title:.*$/mu, (_whole, before) => `${before}title: '${escaped}'`));
		return { title: String(title ?? '').trim() };
	}

	/** A row made: a page under the database, of this title and these values, its text the template's (when given). */
	async addRow(database, { slug, title = '', props = {}, body = '' }) {
		if (!(await this.info(database))) throw new DatabaseError(t('这一页不是数据库'), 404);
		await this.articles.create({ slug, title, parent: database, body });
		const kept = Object.fromEntries(Object.entries(props).filter(([, value]) => value !== null && value !== undefined && value !== ''));
		if (Object.keys(kept).length) {
			const { source, revision } = await this.articles.read(slug);
			await this.articles.save(slug, { source: setFrontmatterProps(source, kept), expectedRevision: revision }, { site: this.site });
		}
		return { slug };
	}

	/**
	 * A database made: a page of its own (`slug`, or one made up), under `parent` when given, of this title, with these
	 * settings (none: no columns yet, a table). Its folder name.
	 */
	async create({ slug, title = '', parent = '', config = {} } = {}) {
		const folder = slug || freeSlug(autoSlug(), (await this.articles.list()).map((page) => page.slug));
		await this.articles.create({ slug: folder, title, parent, type: 'database', body: definitionBody(readConfig(JSON.stringify(config))) });
		return { slug: folder };
	}

	/**
	 * A block from before databases were pages, in the page `page` (its text `text`), made a database of its own: a page
	 * under `page`, of the block's title, with its settings; the pages that were its rows (those under `page` saying its
	 * id; with `unnamed`, for one with none, those under `page` naming no database) put under it. One made of it before
	 * (the block's id said by a database) is taken again, the rows not yet in it put there. Each page's text is kept as a
	 * version first. The database's folder name.
	 */
	async detach(page, text, { unnamed = false } = {}) {
		if (sourceOf(text)) throw new DatabaseError(t('这个块已经指向一个数据库'));
		const config = readConfig(text);
		const all = await this.articles.list();
		if (!all.some((article) => article.slug === page)) throw new DatabaseError(t('文章不存在'), 404);
		let made = null;
		if (config.id) {
			for (const database of all.filter((article) => article.type === 'database')) {
				if ((await this.config(database.slug))?.id === config.id) {
					made = database.slug;
					break;
				}
			}
		}
		made ??= (await this.create({ title: config.title, parent: page, config: { ...config, title: '' } })).slug;
		const rows = all.filter((article) => article.parent === page && article.slug !== made && article.type !== 'database' && (config.id ? article.database === config.id : unnamed && !article.database));
		for (const row of rows) await this.#rewrite(row.slug, (source) => setFrontmatterDatabase(setFrontmatterField(source, 'parent', made), null));
		return { slug: made, rows: rows.map((row) => row.slug) };
	}

	/**
	 * Every block from before databases were pages made a database of its own (`detach`), the block then naming it;
	 * each page's text kept as a version first. The databases made, by the page they were in.
	 */
	async migrate() {
		const made = {};
		for (const page of await this.articles.list()) {
			if (page.type === 'database') continue;
			const { source } = await this.articles.read(page.slug);
			const blocks = databaseBlocks(source);
			if (!blocks.some((block) => !block.source)) continue;
			// As before ids: the first block naming no id had the pages under the page naming no database as its rows.
			const firstUnnamed = blocks.findIndex((block) => !block.source && !block.id);
			const slugs = [];
			for (const [at, block] of blocks.entries()) slugs.push(block.source ? null : (await this.detach(page.slug, block.text, { unnamed: at === firstUnnamed })).slug);
			await this.#rewrite(page.slug, (current) => mapDatabaseBlocks(current, (inner, at) => (!sourceOf(inner) && slugs[at] ? referenceText(slugs[at]) : undefined)));
			made[page.slug] = slugs.filter(Boolean);
		}
		return made;
	}

	/**
	 * The columns changed in every row of the database `slug` (each row's text kept as a version first): one renamed
	 * (`renames`: old name → new), its values with it; one taken away (`removed`), its values with it; one of another
	 * kind now (`types`: name → kind), its values as that kind keeps them (those it cannot, gone); a choice renamed or
	 * taken away (`values`: `{ column, from, to }`, `to` null), in the rows that had it.
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
