import { mkdir, readFile, readdir, rename, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { articleBundlePaths, resolveInside } from '../../articles/bundle-paths.mjs';
import { autoSlug, freeSlug } from '../pages/page-names.ts';
import { fromPaddleMarkdown } from './ocr-markdown.mjs';
import { runProgram } from './tasks.mjs';

/**
 * A PDF of an article read by PaddleOCR's online service (its document parsing: text, formulas, tables, pictures)
 * into a page under the article: made at once (its title the PDF's name, saying it is being read), then, as a task,
 * `paddleocr api` run on the PDF where it is (the author's own: installed with the token PADDLEOCR_ACCESS_TOKEN in
 * their shell) in the page's ai/ocr/, and what it read written as its text (ocr-markdown.mjs), its pictures in its
 * img/ocr/. The PDF is not copied: one kept in the article's ai/ stays unpublished, a book is not there twice. A
 * book's PDF takes a while: the task waits up to two hours.
 */

/** What reads it: `paddleocr api` for the document parsing, the file and where the Markdown goes added. */
export const OCR_COMMAND = ['paddleocr', 'api', '--model_type', 'doc_parsing', '--request_timeout', '300', '--poll_timeout', '7200'];

const FRONTMATTER = /^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u;

/** The page's text with `body` in place of what follows its properties when that is still `placeholder`, else after it. */
function withBody(source, placeholder, body) {
	const head = FRONTMATTER.exec(source)?.[0] ?? '';
	const rest = source.slice(head.length);
	if (rest.trim() === placeholder.trim()) return `${head}\n${body}`;
	// Written in meanwhile: kept, what was read after it.
	return `${source.replace(/\s*$/u, '')}\n\n${body}`;
}

/**
 * @param {{ tasks: import('./tasks.mjs').Tasks, articles: import('./article-repository.mjs').ArticleRepository, blogRoot: string, slug: string, path: string, env: Record<string, string>, command?: string[] }} options
 * @returns {Promise<{ task: string, page: { slug: string, title: string, href: string } }>}
 */
export async function startPdfOcr({ tasks, articles, blogRoot, slug, path, env, command = OCR_COMMAND }) {
	const fail = (message) => Object.assign(new Error(message), { statusCode: 400 });
	if (typeof path !== 'string' || !/\.pdf$/iu.test(path)) throw fail('只能识别 PDF');
	const parent = articleBundlePaths(blogRoot, slug).directory;
	const pdf = resolveInside(parent, path);
	if (!(await stat(pdf).catch(() => null))?.isFile()) throw fail('文章里没有这个 PDF');
	const title = basename(path).replace(/\.pdf$/iu, '');
	const named = `\`${basename(path).replaceAll('`', '')}\``;
	const placeholder = `正在用 PaddleOCR 识别上级页面里的 ${named}…\n`;
	const folder = await makePage(articles, { title, parent: slug, body: placeholder });
	const page = articleBundlePaths(blogRoot, folder);
	// The page's text as the task leaves it, kept as a version first; nothing when the page is gone meanwhile.
	const write = async (body) => {
		for (let attempt = 0; ; attempt += 1) {
			const { source, revision } = await articles.read(folder);
			try {
				return await articles.save(folder, { source: withBody(source, placeholder, body), expectedRevision: revision }, { before: (current) => articles.keep?.(folder, current) });
			} catch (error) {
				// Saved by the author just then: read again.
				if (error?.name !== 'ArticleConflictError' || attempt >= 3) throw error;
			}
		}
	};

	const task = tasks.start({ kind: 'ocr', title: `PaddleOCR：${title}`, slug }, async ({ log, signal }) => {
		const work = join(page.ai, 'ocr');
		try {
			await mkdir(work, { recursive: true });
			await runProgram([...command, '--file_path', pdf, '--output_md', join(work, 'result.md')], { cwd: work, env, log, signal });
			const { markdown, pictures } = fromPaddleMarkdown(await readFile(join(work, 'result.md'), 'utf8'));
			// Cancelled as it ended, or the page put in the trash meanwhile: nothing is written.
			if (signal.aborted) throw new Error('已取消');
			await articles.read(folder);
			// Its pictures, into the page's img/ (published with it).
			const into = join(page.directory, 'img', 'ocr');
			await mkdir(into, { recursive: true });
			const made = new Set(await readdir(join(work, 'imgs')).catch(() => []));
			for (const { file, name } of pictures) if (made.has(file)) await rename(join(work, 'imgs', file), join(into, name));
			await write(`由 PaddleOCR 从上级页面里的 ${named} 识别。\n\n${markdown}`);
			log(`\n识别完，写进了子页面「${title}」（${pictures.length} 张图）。\n`);
			return { page: folder, title, pictures: pictures.length };
		} catch (error) {
			// The page says so, not 正在识别 forever.
			const why = signal.aborted ? '识别已取消' : `识别失败：${error instanceof Error ? error.message : error}`;
			await write(`PaddleOCR 没有读完上级页面里的 ${named}（${why.replace(/\s+/gu, ' ').slice(0, 300)}）。\n`).catch(() => {});
			throw error;
		}
	});
	return { task: task.id, page: { slug: folder, title, href: `/blog/${folder}/` } };
}

/** A new page under `parent`, under a folder name of now; another, should one be made in the same second. */
async function makePage(articles, { title, parent, body }) {
	for (let attempt = 0; ; attempt += 1) {
		const folder = freeSlug(autoSlug(), (await articles.list()).map((page) => page.slug));
		try {
			await articles.create({ slug: folder, title, parent, body });
			return folder;
		} catch (error) {
			if (error?.name !== 'ArticleConflictError' || attempt >= 5) throw error;
		}
	}
}
