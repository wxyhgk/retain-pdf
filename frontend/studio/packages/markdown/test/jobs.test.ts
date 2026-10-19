import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { VFile } from 'vfile';

import { markdownPlugins } from '../pipeline.mjs';

const { remarkPlugins, rehypePlugins } = markdownPlugins();

/** An article in a folder with these files, rendered as the blog renders it. */
async function render(t: { after: (fn: () => void) => void }, markdown: string, files: Record<string, string> = {}) {
	const root = mkdtempSync(join(tmpdir(), 'jobs-'));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const folder = join(root, 'water');
	mkdirSync(folder, { recursive: true });
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(join(folder, path, '..'), { recursive: true });
		writeFileSync(join(folder, path), text);
	}
	const file = await unified()
		.use(remarkParse)
		.use(remarkPlugins as never)
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypePlugins as never)
		.use(rehypeStringify)
		.process(new VFile({ value: markdown, path: join(folder, 'index.md') }));
	return { html: String(file), messages: file.messages.map((message) => [message.ruleId, message.reason]) };
}

const fence = (meta: string) => `\`\`\`job ${meta}\n3\nwater\nO 0 0 0\nH 0 0 1\nH 0 1 0\n\`\`\`\n`;
const run = (state: string) => JSON.stringify({ format: 1, id: 'opt', run: '20261019-153012', program: 'xtb', state, files: ['xtb.out'] });

test('a job is its head, the run it shows (read at build time), and its input folded', async (t) => {
	const { html, messages } = await render(t, fence('id=opt program=xtb args="--opt tight --alpb water" title="水 <优化>" run=20261019-153012'), {
		'assets/jobs/opt/20261019-153012/run.json': run('done'),
	});
	assert.deepEqual(messages, []);
	assert.match(html, /^<figure class="note-job" data-run="\{&#x22;format&#x22;:1,/u);
	assert.match(html, /<strong class="note-job-title">水 &#x3C;优化><\/strong>/u);
	assert.match(html, /<span class="note-job-summary">xtb · 结构优化 · GFN2-xTB · 水（ALPB）<\/span>/u);
	assert.match(html, /<details class="note-job-input"><summary>输入：xtb 输入文件 --opt tight --alpb water<\/summary><pre><code>3\nwater\nO 0 0 0/u);
	// Not a code file, nor highlighted.
	assert.doesNotMatch(html, /code-file|language-job/u);
});

test('what the check before publishing says: a run not in the article, one still going, one that failed; none run yet is fine', async (t) => {
	const missing = await render(t, fence('id=opt run=20261019-153012'));
	assert.deepEqual(missing.messages, [['job-run', '计算块「opt」显示的运行 ./assets/jobs/opt/20261019-153012/ 不在文章里']]);
	assert.match(missing.html, /<figure class="note-job">[\s\S]*还没有运行/u);

	const going = await render(t, fence('id=opt title=水 run=20261019-153012'), { 'assets/jobs/opt/20261019-153012/run.json': run('running') });
	assert.deepEqual(going.messages, [['job-running', '计算块「水」还在运行中，发布出去的是没算完的结果']]);

	const failed = await render(t, fence('id=opt run=20261019-153012'), { 'assets/jobs/opt/20261019-153012/run.json': run('failed') });
	assert.deepEqual(failed.messages, [['job-failed', '计算块「opt」显示的运行失败了']]);

	const bad = await render(t, fence('id=../x run=20261019-153012'));
	assert.deepEqual(bad.messages.map(([rule]) => rule), ['job-run']);

	assert.deepEqual((await render(t, fence('id=opt'))).messages, []);
});
