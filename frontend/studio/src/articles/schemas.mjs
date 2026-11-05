import { parseFrontmatter } from '@astrojs/markdown-remark';
import { z } from 'astro/zod';

/** @param {any} image */
export function createArticleFrontmatterSchema(image = null) {
	const heroImage = image ? image() : z.string();
	return z.object({
		// A page may have none (a note not named, as Notion lets one be): the blog shows it as 无标题.
		title: z.string().default('').transform((title) => title.trim() || '无标题'), // i18n-ignore: what the blog shows
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		heroImage: heroImage.optional(),
		// The page's icon: an emoji, shown above the title and in the lists.
		icon: z.string().trim().min(1).max(16).optional(),
		// The page uses the full width (tables, long formulas), on the blog and in the Studio.
		wide: z.boolean().optional(),
		tags: z.array(z.string()).default([]),
		draft: z.boolean().default(false),
		kind: z.enum(['wiki', 'post']).default('post'),
		// The page it is under (its folder name), in the Studio's tree of pages and the blog's path to it: the
		// pages are each in a folder of their own, side by side; this alone says what is under what.
		parent: z.string().trim().min(1).optional(),
		// Where it goes among the pages under the same page (smaller first), as it was dragged in the Studio's tree;
		// pages without one come after, by title.
		order: z.number().optional(),
		// Formula macros of this article, over the site's (src/katex-macros.json): `\\Ha: \\hat{H}`.
		macros: z.record(z.string(), z.string()).optional(),
		// A database (the Studio's 数据库, as Notion's): the pages under it its rows, its columns a ```database block in
		// it (database-blocks.mjs).
		type: z.enum(['database']).optional(),
		// Its values as a row of the database it is under: `{ "方法": "B3LYP", "能量": -76.4 }`.
		props: z.record(z.string(), z.unknown()).optional(),
		// From before databases were pages: the id of the ```database block in the page it was under whose row it was.
		database: z.string().trim().min(1).optional(),
		// From RetainPDF's 读书笔记 (a page of notes per book, taken out 2026-11-05): the book, or the page they were all
		// under (`books: true`). Still read, so those pages are pages as any; nothing is done with it.
		retainpdf: z.object({ document: z.string().optional(), job: z.string().optional(), books: z.boolean().optional() }).optional(),
	});
}

export const studioArticleFrontmatterSchema = createArticleFrontmatterSchema();

export function parseArticleSource(source) {
	if (typeof source !== 'string') throw new TypeError('文章内容必须是文本');
	return parseFrontmatter(source, { frontmatter: 'preserve' });
}

/**
 * The frontmatter as far as it can be read: `{}` when its YAML is broken
 * (an editor or a program left it so), so the article still lists and opens
 * and `articleProblems` says what is wrong.
 */
function readableFrontmatter(source) {
	try {
		return parseArticleSource(source).frontmatter ?? {};
	} catch {
		return {};
	}
}

export function articleSummary(source, fallbackSlug) {
	const frontmatter = readableFrontmatter(source);
	const title = typeof frontmatter.title === 'string' && frontmatter.title.trim()
		? frontmatter.title.trim()
		: fallbackSlug;
	return {
		title,
		draft: frontmatter.draft === true,
		icon: typeof frontmatter.icon === 'string' ? frontmatter.icon.trim() : '',
		tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.filter((tag) => typeof tag === 'string') : [],
		kind: frontmatter.kind === 'wiki' ? 'wiki' : 'post',
		parent: articleParent(frontmatter),
		...(typeof frontmatter.order === 'number' && Number.isFinite(frontmatter.order) ? { order: frontmatter.order } : {}),
		// A database: the pages under it its rows.
		...(frontmatter.type === 'database' ? { type: 'database' } : {}),
		// From before databases were pages: the block whose row it was (its id), till it is made a row of a database page.
		...(typeof frontmatter.database === 'string' && frontmatter.database.trim() ? { database: frontmatter.database.trim() } : {}),
	};
}

/** The folder name of the page the article is under (`parent:`); empty for none. */
function articleParent(frontmatter) {
	return typeof frontmatter.parent === 'string' ? frontmatter.parent.trim() : '';
}

export function articleProperties(source, fallbackSlug = '') {
	const frontmatter = readableFrontmatter(source);
	const date = frontmatter.pubDate instanceof Date ? frontmatter.pubDate : new Date(frontmatter.pubDate);
	return {
		title: typeof frontmatter.title === 'string' && frontmatter.title.trim() ? frontmatter.title.trim() : fallbackSlug,
		description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
		pubDate: Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10),
		tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.filter((tag) => typeof tag === 'string') : [],
		draft: frontmatter.draft === true,
		icon: typeof frontmatter.icon === 'string' ? frontmatter.icon.trim() : '',
		// The cover, as written: `./img/cover.jpg`.
		cover: typeof frontmatter.heroImage === 'string' ? frontmatter.heroImage.trim() : '',
		kind: frontmatter.kind === 'wiki' ? 'wiki' : 'post',
		wide: frontmatter.wide === true,
		parent: articleParent(frontmatter),
		// A database (its rows the pages under it); its values as a row of the database it is under.
		...(frontmatter.type === 'database' ? { type: 'database' } : {}),
		props: frontmatter.props && typeof frontmatter.props === 'object' && !Array.isArray(frontmatter.props) ? frontmatter.props : {},
	};
}

/** The article's own formula macros (`macros:`), the ones with text for an expansion. */
export function articleMacros(source) {
	const frontmatter = readableFrontmatter(source);
	const macros = frontmatter.macros;
	if (!macros || typeof macros !== 'object' || Array.isArray(macros)) return {};
	return Object.fromEntries(Object.entries(macros).filter(([, expansion]) => typeof expansion === 'string'));
}

export function validateArticleSource(source) {
	const { frontmatter } = parseArticleSource(source);
	return studioArticleFrontmatterSchema.safeParse(frontmatter);
}

/** What each property must be, said as the author needs to hear it. */
const PROPERTY_PROBLEMS = Object.freeze({
	title: '标题（title）不能为空',
	description: '缺少简介（description）；没有简介也要写 description: \'\'',
	pubDate: '发布日期（pubDate）无效，应写成 2026-10-16',
	updatedDate: '更新日期（updatedDate）无效，应写成 2026-10-16',
	heroImage: '封面图（heroImage）应是图片路径',
	icon: '图标（icon）应是一个 emoji',
	tags: '标签（tags）应是列表，如 [DFT, 激发态]',
	draft: 'draft 只能是 true 或 false',
	kind: 'kind 只能是 post 或 wiki',
	macros: '公式宏（macros）应是「名字: 展开」，如 Ha: \\hat{H}',
	wide: 'wide 只能是 true 或 false',
	parent: '上级页面（parent）应是一篇文章的文件夹名',
	order: '顺序（order）应是一个数',
	props: '属性（props）应是「列名: 值」，如 { "方法": "B3LYP" }',
	type: 'type 只能是 database（这一页是数据库）',
});

/**
 * Why the blog could not build this article's properties: the same schema
 * as the content collection, said per property. Empty when nothing is wrong.
 */
export function articleProblems(source) {
	let frontmatter;
	try {
		frontmatter = parseArticleSource(source).frontmatter ?? {};
	} catch (error) {
		const reason = error instanceof Error ? error.message.split('\n', 1)[0] : '';
		return [`属性的 YAML 写错了${reason ? `：${reason}` : ''}`];
	}
	const result = studioArticleFrontmatterSchema.safeParse(frontmatter);
	if (result.success) return [];
	const fields = [...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? '')))];
	return fields.map((field) => PROPERTY_PROBLEMS[field] ?? `属性 ${field} 无效`);
}

export function isPublishedArticle(entry) {
	return entry?.data?.draft !== true;
}

/** The day `date` is where the Studio runs (`2026-11-03`), not in UTC: a page made at 7 in the morning in China is of that day. */
export function localDay(date = new Date()) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * A new article's file; with no title (empty), a page not named yet. `kind: 'wiki'` makes it a 维基 page (a post is what
 * a page is unless it says otherwise). Given no text it is empty: the editor shows what to do there, greyed, the file
 * holds none of it.
 */
export function createArticleSource({ title = '', parent = '', body = '', type = '', kind = '', date = new Date() }) {
	if (typeof title !== 'string') throw new ArticleValidationError('文章标题应是文字');
	const escapedTitle = title.trim().replaceAll("'", "''");
	const publicationDate = localDay(date);
	// Under another page: its folder name (checked as one by the caller).
	const under = parent ? `parent: ${parent}\n` : '';
	// A database (its rows the pages under it).
	const database = type === 'database' ? 'type: database\n' : '';
	const wiki = kind === 'wiki' ? 'kind: wiki\n' : '';
	// What it starts with: the text given (a section of its parent, 转成子页面), or nothing.
	const text = body.trim() ? `${body.trim()}\n` : '';
	return `---\ntitle: '${escapedTitle}'\ndescription: ''\npubDate: '${publicationDate}'\ntags: []\ndraft: true\n${wiki}${database}${under}---\n\n${text}`;
}

export class ArticleValidationError extends Error {
	constructor(message) {
		super(message);
		this.name = 'ArticleValidationError';
		this.statusCode = 400;
	}
}
