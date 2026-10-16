import { parseFrontmatter } from '@astrojs/markdown-remark';
import { z } from 'astro/zod';

/** @param {any} image */
export function createArticleFrontmatterSchema(image = null) {
	const heroImage = image ? image() : z.string();
	return z.object({
		title: z.string().min(1),
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		heroImage: heroImage.optional(),
		tags: z.array(z.string()).default([]),
		draft: z.boolean().default(false),
		kind: z.enum(['wiki', 'post']).default('post'),
		// Formula macros of this article, over the site's (src/katex-macros.json): `\\Ha: \\hat{H}`.
		macros: z.record(z.string(), z.string()).optional(),
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
	};
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
	tags: '标签（tags）应是列表，如 [DFT, 激发态]',
	draft: 'draft 只能是 true 或 false',
	kind: 'kind 只能是 post 或 wiki',
	macros: '公式宏（macros）应是「名字: 展开」，如 Ha: \\hat{H}',
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

export function createArticleSource({ title, date = new Date() }) {
	if (typeof title !== 'string' || !title.trim()) throw new ArticleValidationError('文章标题不能为空');
	const escapedTitle = title.trim().replaceAll("'", "''");
	const publicationDate = date.toISOString().slice(0, 10);
	return `---\ntitle: '${escapedTitle}'\ndescription: ''\npubDate: '${publicationDate}'\ntags: []\ndraft: true\n---\n\n从这里开始写作。\n`;
}

export class ArticleValidationError extends Error {
	constructor(message) {
		super(message);
		this.name = 'ArticleValidationError';
		this.statusCode = 400;
	}
}
