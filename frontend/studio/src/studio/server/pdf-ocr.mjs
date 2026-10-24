import { copyFile, mkdir, readFile, readdir, rename, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { articleBundlePaths, resolveInside } from '../../articles/bundle-paths.mjs';
import { autoSlug, freeSlug } from '../workspace/page-names.ts';
import { fromPaddleMarkdown } from './ocr-markdown.mjs';
import { runProgram } from './tasks.mjs';

/**
 * A PDF of an article read by PaddleOCR's online service (its document parsing: text, formulas, tables, pictures)
 * into a page under the article: made at once (its title the PDF's name, saying it is being read), the PDF copied
 * into its assets/, then, as a task, `paddleocr api` run in its ai/ocr/ (the author's own: installed with the token
 * PADDLEOCR_ACCESS_TOKEN in their shell), and what it read written as its text (ocr-markdown.mjs), its pictures in
 * its img/ocr/. A book's PDF takes a while: the task waits up to two hours.
 */

/** What reads it: `paddleocr api` for the document parsing, the file and where the Markdown goes added. */
export const OCR_COMMAND = ['paddleocr', 'api', '--model_type', 'doc_parsing', '--request_timeout', '300', '--poll_timeout', '7200'];

/** A file name the notes take (blog/AGENTS.md): no spaces nor brackets. */
function plainName(name) {
	return name.replace(/[\s()（）[\]【】]+/gu, '-').replace(/-+/gu, '-').replace(/^-|-(?=\.)/gu, '');
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
	const name = plainName(basename(path));
	const title = basename(path).replace(/\.pdf$/iu, '');
	const folder = freeSlug(autoSlug(), (await articles.list()).map((page) => page.slug));
	await articles.create({ slug: folder, title, parent: slug, body: `正在用 PaddleOCR 识别 [${name}](./assets/${name})…\n` });
	const page = articleBundlePaths(blogRoot, folder);
	await mkdir(join(page.directory, 'assets'), { recursive: true });
	const copy = join(page.directory, 'assets', name);
	await copyFile(pdf, copy);

	const task = tasks.start({ kind: 'ocr', title: `PaddleOCR：${title}`, slug }, async ({ log, signal }) => {
		const work = join(page.ai, 'ocr');
		await mkdir(work, { recursive: true });
		await runProgram([...command, '--file_path', copy, '--output_md', join(work, 'result.md')], { cwd: work, env, log, signal });
		const { markdown, pictures } = fromPaddleMarkdown(await readFile(join(work, 'result.md'), 'utf8'));
		// Its pictures, into the page's img/ (published with it).
		const into = join(page.directory, 'img', 'ocr');
		await mkdir(into, { recursive: true });
		const made = new Set(await readdir(join(work, 'imgs')).catch(() => []));
		for (const picture of pictures) if (made.has(picture)) await rename(join(work, 'imgs', picture), join(into, picture));
		const { source, revision } = await articles.read(folder);
		const head = source.slice(0, source.indexOf('\n---\n', 4) + 5);
		await articles.save(folder, { source: `${head}\n由 PaddleOCR 从 [${name}](./assets/${name}) 识别。\n\n${markdown}`, expectedRevision: revision });
		log(`\n识别完，写进了子页面「${title}」（${pictures.length} 张图）。\n`);
		return { page: folder, pictures: pictures.length };
	});
	return { task: task.id, page: { slug: folder, title, href: `/blog/${folder}/` } };
}
