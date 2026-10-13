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
	});
}

export const studioArticleFrontmatterSchema = createArticleFrontmatterSchema();

export function parseArticleSource(source) {
	if (typeof source !== 'string') throw new TypeError('文章内容必须是文本');
	return parseFrontmatter(source, { frontmatter: 'preserve' });
}

export function articleSummary(source, fallbackSlug) {
	const { frontmatter } = parseArticleSource(source);
	const title = typeof frontmatter.title === 'string' && frontmatter.title.trim()
		? frontmatter.title.trim()
		: fallbackSlug;
	return {
		title,
		draft: frontmatter.draft === true,
	};
}

export function articleProperties(source, fallbackSlug = '') {
	const { frontmatter } = parseArticleSource(source);
	const date = frontmatter.pubDate instanceof Date ? frontmatter.pubDate : new Date(frontmatter.pubDate);
	return {
		title: typeof frontmatter.title === 'string' && frontmatter.title.trim() ? frontmatter.title.trim() : fallbackSlug,
		description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
		pubDate: Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10),
		tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.filter((tag) => typeof tag === 'string') : [],
		draft: frontmatter.draft === true,
	};
}

export function validateArticleSource(source) {
	const { frontmatter } = parseArticleSource(source);
	return studioArticleFrontmatterSchema.safeParse(frontmatter);
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
