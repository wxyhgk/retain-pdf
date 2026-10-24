import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { ArticleRepository } from './article-repository.mjs';
import { fromPaddleMarkdown } from './ocr-markdown.mjs';
import { startPdfOcr } from './pdf-ocr.mjs';
import { Tasks } from './tasks.mjs';

// What PaddleOCR's document parsing gave for a page with a heading, a formula, a picture with its caption and a
// table (paddleocr api --model_type doc_parsing --output_md, 2026-10).
const PADDLE = await readFile(new URL('./test-data/paddleocr-figure.md', import.meta.url), 'utf8');

test('PaddleOCR’s Markdown as the notes write it: formulas, a picture with its caption, a table', () => {
	const { markdown, pictures } = fromPaddleMarkdown(PADDLE);
	assert.deepEqual(pictures, [{ file: 'img_in_image_box_6_343_832_762.jpg', name: 'img_in_image_box_6_343_832_762.jpg' }]);
	assert.equal(markdown, [
		'## 势能面上的过渡态',
		'过渡态是势能面上的一阶鞍点：Hessian 矩阵恰好有一个负本征值。速率常数由 Eyring 公式给出：',
		'$$\nk=(k_BT/h)\\exp(-\\Delta G^\\ddagger/RT)\n$$',
		'下图是一维的示意：',
		'![$\\sin x$ 曲线](./img/ocr/img_in_image_box_6_343_832_762.jpg){width=69%}',
		'表1列出三个驻点的能量。',
		'| 物种 | 能量/Eh |\n| --- | --- |\n| R | -188.44 |\n| TS | -188.40 |',
	].join('\n\n') + '\n');
	// Joined cells: the table stays as it is.
	const joined = '<table><tr><td colspan=2>a</td></tr></table>';
	assert.equal(fromPaddleMarkdown(joined).markdown, `${joined}\n`);
});

test('PaddleOCR’s edge cases: centred lines one under the other, prices, bars in a table’s formula, names with spaces, pictures in divs in divs, two formulas on a line', () => {
	const read = (text) => fromPaddleMarkdown(text).markdown;
	assert.equal(read('<div style="text-align: center;">a</div>\n<div style="text-align: center;">b</div>'), 'a\n\nb\n');
	assert.equal(read('costs $ 5 and $ 10, but $ x $ is math'), 'costs $ 5 and $ 10, but $x$ is math\n');
	// The table's own bars escaped; a formula's written as TeX (a table's \| reaches the formula as it is: ‖).
	assert.equal(read('<table><tr><td>a</td></tr><tr><td>$|x| + \\|y\\|$ or |</td></tr></table>'), '| a |\n| --- |\n| $\\vert x\\vert  + \\Vert y\\Vert$ or \\| |\n');
	const nested = fromPaddleMarkdown('<div style="text-align: center;"><div><img src="imgs/a b.jpg" width="50%"></div></div>');
	assert.equal(nested.markdown, '![](./img/ocr/a-b.jpg){width=50%}\n');
	assert.deepEqual(nested.pictures, [{ file: 'a b.jpg', name: 'a-b.jpg' }]);
	assert.equal(read('$$ a $$ and $$ b $$'), '$$ a $$ and $$ b $$\n');
});

async function ended(tasks, id) {
	while (tasks.get(id).state === 'running') await new Promise((resolve) => setTimeout(resolve, 20));
}

test('a PDF of an article read into a page under it: made at once, then its text and pictures', async (t) => {
	const root = await mkdtemp(join(tmpdir(), 'studio-ocr-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	const articles = new ArticleRepository(root);
	await articles.create({ slug: 'project', title: '项目' });
	await mkdir(join(root, 'project', 'assets'), { recursive: true });
	await writeFile(join(root, 'project', 'assets', '第 3 章 (草稿).pdf'), '%PDF-1.4 stand-in');
	// A stand-in for paddleocr: writes what PaddleOCR wrote, its picture next to it.
	const standIn = join(root, 'paddleocr');
	await writeFile(standIn, `#!/bin/sh\nout="$(echo "$@" | sed 's/.*--output_md //; s/ .*//')"\nmkdir -p "$(dirname "$out")/imgs"\nprintf jpg > "$(dirname "$out")/imgs/img_in_image_box_6_343_832_762.jpg"\ncat '${new URL('./test-data/paddleocr-figure.md', import.meta.url).pathname}' > "$out"\necho read\n`);
	await chmod(standIn, 0o755);
	const tasks = new Tasks();
	const started = await startPdfOcr({ tasks, articles, blogRoot: root, slug: 'project', path: 'assets/第 3 章 (草稿).pdf', env: {}, command: [standIn] });
	assert.equal(started.page.title, '第 3 章 (草稿)');
	assert.equal(started.page.href, `/blog/${started.page.slug}/`);
	// Made at once, under the article, saying it is being read; the PDF left where it is.
	const made = await articles.read(started.page.slug);
	assert.match(made.source, /\nparent: project\n/u);
	assert.match(made.source, /正在用 PaddleOCR 识别上级页面里的 `第 3 章 \(草稿\)\.pdf`…/u);
	await assert.rejects(stat(join(root, started.page.slug, 'assets', '第 3 章 (草稿).pdf')), { code: 'ENOENT' });

	await ended(tasks, started.task);
	assert.equal(tasks.get(started.task).state, 'done', tasks.get(started.task).error ?? '');
	assert.equal(tasks.get(started.task).result.title, '第 3 章 (草稿)');
	const read = (await articles.read(started.page.slug)).source;
	assert.match(read, /\n---\n\n由 PaddleOCR 从上级页面里的 `第 3 章 \(草稿\)\.pdf` 识别。\n\n## 势能面上的过渡态\n/u);
	assert.doesNotMatch(read, /正在用/u);
	assert.match(read, /!\[\$\\sin x\$ 曲线\]\(\.\/img\/ocr\/img_in_image_box_6_343_832_762\.jpg\)\{width=69%\}/u);
	assert.equal(await readFile(join(root, started.page.slug, 'img', 'ocr', 'img_in_image_box_6_343_832_762.jpg'), 'utf8'), 'jpg');
	await assert.rejects(startPdfOcr({ tasks, articles, blogRoot: root, slug: 'project', path: 'assets/x.docx', env: {} }), /PDF/u);
});

test('what the author wrote in the page while it was read stays, a version kept first; a run that fails says so on the page', async (t) => {
	const root = await mkdtemp(join(tmpdir(), 'studio-ocr-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	const kept = [];
	const articles = new ArticleRepository(root, { keep: (slug, source) => kept.push([slug, source]) });
	await articles.create({ slug: 'project', title: '项目' });
	await mkdir(join(root, 'project', 'ai'), { recursive: true });
	await writeFile(join(root, 'project', 'ai', 'book.pdf'), '%PDF-1.4 stand-in');
	// Waits for a word before it writes, so the page can be written in meanwhile.
	const go = join(root, 'go');
	const standIn = join(root, 'paddleocr');
	await writeFile(standIn, `#!/bin/sh\nout="$(echo "$@" | sed 's/.*--output_md //; s/ .*//')"\nwhile [ ! -e '${go}' ]; do sleep 0.02; done\nprintf '## 第一章\\n\\n正文。\\n' > "$out"\n`);
	await chmod(standIn, 0o755);
	const tasks = new Tasks();
	const started = await startPdfOcr({ tasks, articles, blogRoot: root, slug: 'project', path: 'ai/book.pdf', env: {}, command: [standIn] });
	const page = await articles.read(started.page.slug);
	await articles.save(started.page.slug, { source: `${page.source}\n我先记一句。\n`, expectedRevision: page.revision });
	await writeFile(go, '');
	await ended(tasks, started.task);
	const read = (await articles.read(started.page.slug)).source;
	assert.match(read, /正在用 PaddleOCR[\s\S]*我先记一句。\n\n由 PaddleOCR 从上级页面里的 `book\.pdf` 识别。\n\n## 第一章/u);
	assert.equal(kept.length, 1);
	assert.match(kept[0][1], /我先记一句。\n$/u);

	const failing = join(root, 'failing');
	await writeFile(failing, '#!/bin/sh\necho "token invalid" >&2\nexit 3\n');
	await chmod(failing, 0o755);
	const broken = await startPdfOcr({ tasks, articles, blogRoot: root, slug: 'project', path: 'ai/book.pdf', env: {}, command: [failing] });
	await ended(tasks, broken.task);
	assert.equal(tasks.get(broken.task).state, 'failed');
	const said = (await articles.read(broken.page.slug)).source;
	assert.match(said, /\n---\n\nPaddleOCR 没有读完上级页面里的 `book\.pdf`（识别失败：/u);
	assert.doesNotMatch(said, /正在用/u);
});
