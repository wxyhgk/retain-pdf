import { lstat, readFile } from 'node:fs/promises';
import { parseFrontmatter } from '@astrojs/markdown-remark';

import { parseArticle } from '@blog/markdown/syntax.mjs';
import { ARTICLE_ADDRESS, PUBLISHED_FOLDERS } from '@blog/markdown/articles/rules.mjs';
import { articleBundlePaths, resolveInside } from '../../../articles/bundle-paths.mjs';
import { ArticleRepository } from './article-repository.mjs';
import { checkArticle } from './article-check.mjs';

/**
 * How an article shows, said in words for an AI that cannot look at it: block by block, what each is drawn as (a
 * page link with its icon, a widget's frame and the file it runs, a figure and its number…), with the publishing
 * check's findings. Read off the Markdown as the blog reads it, no browser: what a widget's script does when it
 * runs is not known here (widget-check.mjs runs it).
 */

/** A ```widget block's fence (plugins/widget): its options, and `@file` when it is a file of the article. */
const WIDGET = 'widget';
const WIDGET_HEIGHT = 240;

/** The words of a node, as read. */
function toString(node) {
	if (typeof node.value === 'string' && node.type !== 'html') return node.value;
	return (node.children ?? []).map(toString).join('');
}

/** Blocks said at most, from where asked: a long article is said in parts. */
const PART = 200;
/** Words of a block quoted at most. */
const QUOTED = 60;

/** The words the preview says, for the AI. */
const SAY = {
	heading: (depth, text) => `${depth} 级标题「${text}」`, // i18n-ignore: for the AI
	paragraph: (text) => `段落：${text}`, // i18n-ignore: for the AI
	pageLine: (link) => `单独一行的页面链接（页面图标加标题，单击打开那篇）：${link}`, // i18n-ignore: for the AI
	mention: (link) => `句子里的页面链接（文字前有页面图标，单击打开那篇）：${link}`, // i18n-ignore: for the AI
	article: (text, slug, found) => `「${text}」→ ${slug}${found}`, // i18n-ignore: for the AI
	titled: (title) => `（标题「${title}」）`, // i18n-ignore: for the AI
	published: '，已发布', // i18n-ignore: for the AI
	draft: '，是草稿（Studio 里能打开，博客上发布前打不开）', // i18n-ignore: for the AI
	missing: '，没有这篇文章（显示成链接，点了打不开）', // i18n-ignore: for the AI
	links: (count) => `外部链接 ${count} 个`, // i18n-ignore: for the AI
	formulas: (count) => `行内公式 ${count} 个`, // i18n-ignore: for the AI
	list: (ordered, count) => `${ordered ? '编号' : ''}列表，${count} 项`, // i18n-ignore: for the AI
	quote: (text) => `引用：${text}`, // i18n-ignore: for the AI
	table: (rows, columns) => `表格，${rows} 行 ${columns} 列（含表头）`, // i18n-ignore: for the AI
	math: (tag) => `独立公式${tag ? `，编号 (${tag})` : '，不编号'}`, // i18n-ignore: for the AI
	figure: (number, alt, path, width, there) => `图 ${number}「${alt}」：${path}${width ? `，宽 ${width}` : ''}，${there ? '文件在' : '文件不在（博客构建会失败）'}`, // i18n-ignore: for the AI
	widget: (title, height) => `交互模块${title ? `「${title}」` : ''}：一个沙盒框，先占 ${height}px 高，再跟着内容变高`, // i18n-ignore: for the AI
	widgetFile: (path, size) => `运行文章里的文件 ./${path}（${size} 字节）`, // i18n-ignore: for the AI
	widgetNoFile: (path) => `要运行的 ./${path} 不在，框里只会显示这句提示`, // i18n-ignore: for the AI
	widgetUnpublished: (path) => `./${path} 不在 img/ 或 assets/ 里，框里只会显示这句提示`, // i18n-ignore: for the AI
	widgetInline: (lines) => `HTML 直接写在代码块里（${lines} 行）`, // i18n-ignore: for the AI
	scripts: (urls) => `加载的脚本：${urls.join('、')}`, // i18n-ignore: for the AI
	reads: (paths) => `脚本读的数据：${paths.join('、')}`, // i18n-ignore: for the AI
	code: (language, lines) => `代码块${language ? `（${language}）` : ''}，${lines} 行`, // i18n-ignore: for the AI
	codeFile: (path, there) => `显示文章里的文件 ./${path}${there ? '' : '（文件不在）'}`, // i18n-ignore: for the AI
	html: (text) => `HTML：${text}`, // i18n-ignore: for the AI
	rule: '分隔线', // i18n-ignore: for the AI
	other: (type) => `${type}`, // i18n-ignore: for the AI
	scriptsRun: '交互模块里的脚本这里不运行，看不出它运行时有没有出错、画出来对不对；要知道就用 check_widgets 在后台浏览器里运行它（报错、画了什么、截图）。', // i18n-ignore: for the AI
};

const shortened = (text) => {
	const flat = text.replace(/\s+/gu, ' ').trim();
	return flat.length > QUOTED ? `${flat.slice(0, QUOTED)}…` : flat;
};

async function sizeOf(directory, path) {
	try {
		const info = await lstat(resolveInside(directory, ...path.split('/')));
		return info.isFile() ? info.size : null;
	} catch {
		return null;
	}
}

/** Every node under `node` (itself too) of `type`. */
function under(node, type, found = []) {
	if (node.type === type) found.push(node);
	for (const child of node.children ?? []) under(child, type, found);
	return found;
}

/**
 * @param {string} blogRoot
 * @param {string} slug
 * @param {string} source its `index.md`
 * @param {{ from?: number }} [options] said from this line on
 */
export async function previewArticle(blogRoot, slug, source, { from = 1 } = {}) {
	const { directory } = articleBundlePaths(blogRoot, slug);
	// Blank lines in place of the properties, so lines count as in the file.
	let content = source;
	try {
		content = parseFrontmatter(source, { frontmatter: 'empty-with-lines' }).content;
	} catch {
		// Properties that cannot be read: the check says so.
	}
	const articles = new Map((await new ArticleRepository(blogRoot).list()).map((article) => [article.slug, article]));
	const tree = parseArticle(content);

	const articleLink = (link) => {
		const target = ARTICLE_ADDRESS.exec(link.url)?.[2];
		const found = articles.get(target);
		const text = shortened(toString(link));
		const state = !found ? SAY.missing : `${found.title === text ? '' : SAY.titled(found.title)}${found.draft ? SAY.draft : SAY.published}`;
		return SAY.article(text, target, state);
	};
	const isArticle = (link) => ARTICLE_ADDRESS.test(link.url);
	/** What a block holding words has in it: its page links, other links, formulas. */
	const inside = (node) => {
		const links = under(node, 'link');
		const said = links.filter(isArticle).map((link) => SAY.mention(articleLink(link)));
		const others = links.filter((link) => !isArticle(link)).length;
		if (others) said.push(SAY.links(others));
		const formulas = under(node, 'inlineMath').length;
		if (formulas) said.push(SAY.formulas(formulas));
		return said;
	};

	let figures = 0;
	const describe = async (node) => {
		switch (node.type) {
			case 'heading':
				return [SAY.heading(node.depth, shortened(toString(node))), ...inside(node)];
			case 'paragraph': {
				const words = node.children.filter((child) => !(child.type === 'text' && !child.value.trim()));
				// A line that is one link to an article: a page.
				if (words.length === 1 && words[0].type === 'link' && isArticle(words[0])) return [SAY.pageLine(articleLink(words[0]))];
				// A picture alone (its `{width=…}` after it): a numbered figure.
				const image = words[0]?.type === 'image' && words.every((child, index) => index === 0 || (child.type === 'text' && /^\s*\{[^}]*\}\s*$/u.test(child.value))) ? words[0] : null;
				if (image) {
					figures += 1;
					const width = /width\s*=\s*([^\s}]+)/u.exec(words[1]?.value ?? '')?.[1] ?? null;
					const path = image.url.replace(/^\.\//u, '');
					return [SAY.figure(figures, image.alt ?? '', `./${path}`, width, (await sizeOf(directory, path)) !== null)];
				}
				return [SAY.paragraph(shortened(toString(node))), ...inside(node)];
			}
			case 'list':
				return [SAY.list(node.ordered, node.children.length), ...inside(node)];
			case 'blockquote':
				return [SAY.quote(shortened(toString(node))), ...inside(node)];
			case 'table':
				return [SAY.table(node.children.length, node.children[0]?.children.length ?? 0), ...inside(node)];
			case 'math':
				return [SAY.math(/\\tag\*?\{([^}]*)\}/u.exec(node.value)?.[1] ?? null)];
			case 'code':
				return describeCode(node);
			case 'html':
				return [SAY.html(shortened(node.value))];
			case 'thematicBreak':
				return [SAY.rule];
			default:
				return [SAY.other(node.type)];
		}
	};
	const describeCode = async (node) => {
		const lines = node.value ? node.value.split('\n').length : 0;
		const named = /^\s*@file[ \t]+(\S+)\s*$/u.exec(node.value)?.[1]?.replace(/^\.\//u, '');
		if ((node.lang ?? '').toLowerCase() !== WIDGET) {
			return [SAY.code(node.lang ?? '', lines), ...(named ? [SAY.codeFile(named, (await sizeOf(directory, named)) !== null)] : [])];
		}
		const meta = node.meta ?? '';
		const title = /\btitle=(?:"([^"]*)"|'([^']*)'|(\S+))/u.exec(meta)?.slice(1).find((value) => value !== undefined) ?? '';
		const height = Math.max(40, Math.min(2000, Number(/\bheight=(\d+)/u.exec(meta)?.[1] ?? WIDGET_HEIGHT)));
		const said = [SAY.widget(title, height)];
		let html = node.value;
		if (named) {
			const path = named;
			if (!PUBLISHED_FOLDERS.includes(path.split('/', 1)[0])) return [...said, SAY.widgetUnpublished(named)];
			const size = await sizeOf(directory, path);
			if (size === null) return [...said, SAY.widgetNoFile(path)];
			said.push(SAY.widgetFile(path, size));
			html = await readFile(resolveInside(directory, ...path.split('/')), 'utf8');
		} else {
			said.push(SAY.widgetInline(lines));
		}
		const scripts = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/giu)]
			.map((match) => match[1] ?? match[2] ?? match[3])
			.filter((url) => /^(?:https?:)?\/\//iu.test(url) || url.startsWith('/'));
		if (scripts.length) said.push(SAY.scripts(scripts));
		const reads = [...html.matchAll(/note\.file\(\s*(['"`])([^'"`]+)\1\s*\)/gu)].map((match) => match[2]);
		if (reads.length) said.push(SAY.reads(reads));
		return said;
	};

	const blocks = [];
	let next = null;
	let widgets = 0;
	for (const node of tree.children) {
		const line = node.position?.start.line ?? 0;
		if (node.type === 'code' && (node.lang ?? '').toLowerCase() === WIDGET) widgets += 1;
		// Figures are numbered from the top: those before `from` are counted, not said.
		if (line < from) {
			if (node.type === 'paragraph') await describe(node);
			continue;
		}
		if (blocks.length >= PART) {
			next = line;
			break;
		}
		const [shows, ...has] = await describe(node);
		blocks.push(has.length ? { line, shows, has } : { line, shows });
	}
	const issues = from <= 1 ? await checkArticle(blogRoot, slug, source) : undefined;
	return {
		slug,
		blocks,
		...(next ? { next } : {}),
		...(issues ? { issues } : {}),
		...(widgets ? { note: SAY.scriptsRun } : {}),
	};
}
