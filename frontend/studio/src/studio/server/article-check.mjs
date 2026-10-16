import { lstat } from 'node:fs/promises';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { VFile } from 'vfile';

import { rehypePlugins, remarkPlugins } from '../../plugins/markdown-pipeline.mjs';
import { findArticleReferences } from '../shared/article-references.mjs';
import { ArticleRepository } from './article-repository.mjs';
import { articleBundlePaths, resolveInside } from './bundle-paths.mjs';
import { PUBLIC_RESOURCE_ROOTS } from './file-repository.mjs';
import { articleProblems } from './schemas.mjs';

/**
 * What would be wrong with an article once published, found before it is:
 * - `error`: the blog's build fails (properties it cannot read, a picture
 *   that is not there);
 * - `warning`: the page shows it broken (a link or `@file` to a missing
 *   file, a file that is not published, a formula KaTeX rejects, a
 *   reference to an equation no label names, a link to an article that
 *   is not there, not published, or under the other address).
 * What the page would show is found by running the blog's own Markdown
 * plugins (`markdown-pipeline.mjs`) and taking what they report.
 *
 * @typedef {{ severity: 'error' | 'warning', message: string, line?: number }} ArticleIssue
 */

/**
 * @param {string} blogRoot
 * @param {string} slug
 * @param {string} source the article's `index.md` as it is to be published
 * @returns {Promise<ArticleIssue[]>}
 */
export async function checkArticle(blogRoot, slug, source) {
	const paths = articleBundlePaths(blogRoot, slug);
	const issues = [
		...articleProblems(source).map((message) => ({ severity: 'error', message })),
		...(await referenceIssues(paths.directory, source)),
		...(await articleLinkIssues(blogRoot, slug, source)),
		...(await pipelineIssues(paths.markdown, source)),
	];
	const rank = (issue) => (issue.severity === 'error' ? 0 : 1);
	return issues.sort((left, right) => rank(left) - rank(right) || (left.line ?? 0) - (right.line ?? 0));
}

function lineAt(source, offset) {
	let line = 1;
	for (let index = source.indexOf('\n'); index !== -1 && index < offset; index = source.indexOf('\n', index + 1)) line += 1;
	return line;
}

async function isFile(directory, path) {
	try {
		const info = await lstat(resolveInside(directory, ...path.split('/')));
		return info.isFile();
	} catch {
		return false;
	}
}

/** The article's own files it names: there, and published. Each path once, where it is first named. */
async function referenceIssues(directory, source) {
	const issues = [];
	const seen = new Set();
	for (const reference of findArticleReferences(source)) {
		if (seen.has(reference.path)) continue;
		seen.add(reference.path);
		const line = lineAt(source, reference.start);
		const shown = `./${reference.path}`;
		if (!(await isFile(directory, reference.path))) {
			// Astro stops the build at a Markdown picture or cover it cannot find.
			if (reference.kind === 'image') issues.push({ severity: 'error', message: `找不到图片 ${shown}，博客构建会失败`, line });
			else if (reference.kind === 'frontmatter') issues.push({ severity: 'error', message: `找不到封面图 ${shown}，博客构建会失败`, line });
			else issues.push({ severity: 'warning', message: `找不到文件 ${shown}，页面上的链接会失效`, line });
		} else if (!PUBLIC_RESOURCE_ROOTS.includes(reference.path.split('/', 1)[0])) {
			issues.push({ severity: 'warning', message: `${shown} 不在 img/ 或 assets/ 里，不会随文章发布`, line });
		}
	}
	return issues;
}

/** Links to the blog's own articles (`/blog/<slug>/`, `/wiki/<slug>/`): there, published, and at their address. */
async function articleLinkIssues(blogRoot, slug, source) {
	const links = [];
	visit(unified().use(remarkParse).parse(source), (node) => {
		if ((node.type === 'link' || node.type === 'definition') && typeof node.url === 'string') links.push({ url: node.url, line: node.position?.start.line });
	});
	const wanted = links
		.map((link) => ({ ...link, match: /^\/(blog|wiki)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?(?:[#?].*)?$/u.exec(link.url) }))
		.filter((link) => link.match && link.match[2] !== slug);
	if (!wanted.length) return [];
	const articles = new Map((await new ArticleRepository(blogRoot).list()).map((article) => [article.slug, article]));
	const issues = [];
	for (const { url, line, match } of wanted) {
		const [, section, target] = match;
		const article = articles.get(target);
		const at = line ? { line } : {};
		if (!article) issues.push({ severity: 'warning', message: `链接的文章 ${url} 不存在`, ...at });
		else if (article.draft) issues.push({ severity: 'warning', message: `链接的文章「${article.title}」还是草稿，发布前这个链接打不开`, ...at });
		else if ((article.kind === 'wiki') !== (section === 'wiki')) {
			issues.push({ severity: 'warning', message: `「${article.title}」的网址是 /${article.kind === 'wiki' ? 'wiki' : 'blog'}/${target}/，不是 ${url}`, ...at });
		}
	}
	return issues;
}

/** What the blog's Markdown plugins report while making the page. */
async function pipelineIssues(markdownPath, source) {
	let parsed;
	try {
		// Blank lines in place of the properties, so lines count as in the file.
		parsed = parseFrontmatter(source, { frontmatter: 'empty-with-lines' });
	} catch {
		// Properties that cannot be read are an error already.
		return [];
	}
	const file = new VFile({ path: markdownPath, value: parsed.content, data: { astro: { frontmatter: parsed.frontmatter } } });
	const processor = unified().use(remarkParse).use(remarkPlugins).use(remarkRehype, { allowDangerousHtml: true }).use(rehypePlugins);
	await processor.run(processor.parse(file), file);
	return file.messages
		// A missing `@file` is named with the other missing files.
		.filter((message) => message.ruleId !== 'missing-file')
		.map((message) => ({ severity: 'warning', message: message.reason, ...(message.line ? { line: message.line } : {}) }));
}
