import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { VFile } from 'vfile';

import { parseQcOutput } from '@blog/compute/parsers/qc/qc.mjs';
import { buildBlocks } from '@blog/kernel/testing.mjs';
import { markdownPlugins } from '@blog/markdown/pipeline.mjs';
import * as qc from '../build.mjs';
import { parseQcFence, privatePath, qcDescribe, qcFacts, qcMarkdown, qcProblem, writeQcFence } from '../qc-card.mjs';

const FIXTURES = new URL('../../../packages/compute/test/fixtures/qc/', import.meta.url);
const fixture = (name: string) => readFileSync(new URL(name, FIXTURES), 'utf8');
const read = (name: string) => parseQcOutput(fixture(name))!;

const { remarkPlugins, rehypePlugins } = markdownPlugins({ blocks: await buildBlocks(qc) });

/** An article with these files in its assets/, rendered from `markdown`. */
async function render(markdown: string, files: Record<string, string> = {}) {
	const root = mkdtempSync(join(tmpdir(), 'qc-'));
	try {
		mkdirSync(join(root, 'note', 'assets'), { recursive: true });
		for (const [name, from] of Object.entries(files)) {
			if (from.startsWith('fixture:')) copyFileSync(new URL(from.slice(8), FIXTURES), join(root, 'note', 'assets', name));
			else writeFileSync(join(root, 'note', 'assets', name), from);
		}
		const file = await unified()
			.use(remarkParse)
			.use(remarkPlugins as never)
			.use(remarkRehype, { allowDangerousHtml: true })
			.use(rehypePlugins as never)
			.use(rehypeStringify)
			.process(new VFile({ value: markdown, path: join(root, 'note', 'index.md') }));
		return { html: String(file), messages: file.messages.map((message) => [message.ruleId, message.reason]) };
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

test('the fence names its output and, if it has one, its title; written back the same', () => {
	const fence = parseQcFence('@file ./assets/co2.log\ntitle：CO₂ 的优化');
	assert.deepEqual(fence, { file: './assets/co2.log', title: 'CO₂ 的优化' });
	assert.equal(writeQcFence(fence), '@file ./assets/co2.log\ntitle: CO₂ 的优化');
	assert.equal(writeQcFence({ file: './assets/co2.log', title: '' }), '@file ./assets/co2.log');
	assert.equal(qcMarkdown('assets/co2.log'), '```qc\n@file ./assets/co2.log\n```');
});

test('the card says what was done and what was found, from either program', () => {
	assert.equal(qcDescribe(read('co2-g16.log')), 'B3LYP/def2SVP · 优化＋频率 · CO₂ · 电荷 0 · 单重态');
	assert.deepEqual(qcFacts(read('co2-g16.log')), ['E −188.443037 Eh', 'G −188.451964 Eh', '无虚频']);
	assert.equal(qcDescribe(read('co2-anion-orca.out')), 'UB3LYP/def2-SVP · 优化＋频率 · CO₂ · 电荷 −1 · 双重态');
	assert.deepEqual(qcFacts(read('co2-anion-orca.out')), ['E −188.311798 Eh', 'G −188.326332 Eh', '无虚频', '⟨S²⟩ 0.7525']);
	assert.equal(qcDescribe(read('hcn-ts-g16.log')), 'B3LYP/def2SVP · 过渡态优化＋频率 · CHN · 电荷 0 · 单重态');
	assert.deepEqual(qcFacts(read('hcn-ts-orca.out')).slice(2), ['1 个虚频（−1121.8 cm⁻¹）']);
	assert.deepEqual(qcFacts(read('co2-td-orca.out')), ['E −188.360450 Eh', '6 个激发态，最低 8.74 eV（142 nm）']);
	for (const name of ['co2-g16.log', 'co2-orca.out', 'hcn-ts-g16.log', 'co2-td-g16.log']) assert.equal(qcProblem(read(name)), null, name);
});

test('a calculation that did not end well says so', () => {
	assert.equal(qcProblem(read('co2-maxcycles-g16.log')), '优化没有收敛（走了 2 步就停了）');
	assert.equal(qcProblem(read('co2-maxcycles-orca.out')), '优化没有收敛（走了 2 步就停了）');
	// Cut off (still running, or killed): no end at all.
	const cut = fixture('co2-td-g16.log');
	assert.equal(qcProblem(parseQcOutput(cut.slice(0, cut.indexOf(' Excited State   1')))!), '没有正常结束：输出不完整，可能还在算或被中断了');
	assert.equal(privatePath('Initial command:\n /home/someone/g16/l1.exe'), '/home/someone');
	assert.equal(privatePath(fixture('co2-g16.log')), null);
});

test('the blog shows the card, its numbers in the page, its picture and file for the page to use', async () => {
	const { html, messages } = await render('```qc\n@file ./assets/co2.log\ntitle: CO₂\n```\n', { 'co2.log': 'fixture:co2-g16.log' });
	assert.deepEqual(messages, []);
	assert.match(html, /<figure class="note-qc job-card" data-state="done" data-file="assets\/co2.log" data-structure="3\nCO2\nC 0.000000 0.000000 0.000000\n/u);
	assert.match(html, /<span class="job-kind">Gaussian 16<\/span><span class="job-card-title">CO₂<\/span><span class="job-state" data-state="done">正常结束<\/span>/u);
	assert.match(html, /<p class="job-card-line">E −188.443037 Eh {2}· {2}G −188.451964 Eh {2}· {2}无虚频<\/p><p class="job-card-describe">B3LYP\/def2SVP · 优化＋频率/u);
});

test('what would be wrong once published is reported for the check before publishing', async () => {
	const fence = (file: string) => `\`\`\`qc\n@file ${file}\n\`\`\`\n`;
	assert.deepEqual((await render('```qc\n```\n')).messages, [['qc-file', '计算结果块还没有选输出文件']]);
	assert.deepEqual((await render(fence('./assets/gone.log'))).messages, [['qc-file', '找不到计算结果的输出 ./assets/gone.log']]);
	assert.deepEqual((await render(fence('../other/a.log'))).messages, [['qc-file', '计算结果的输出 ../other/a.log 不在页面的 img/ 或 assets/ 里，发布后读不到']]);
	assert.deepEqual((await render(fence('./assets/run.log'), { 'run.log': 'step 1 ok\n' })).messages, [['qc-unknown', './assets/run.log 认不出是 Gaussian 或 ORCA 的输出']]);
	const failed = await render(fence('./assets/stop.out'), { 'stop.out': 'fixture:co2-maxcycles-orca.out' });
	assert.deepEqual(failed.messages, [['qc-failed', '计算结果 ./assets/stop.out：优化没有收敛（走了 2 步就停了）']]);
	assert.match(failed.html, /data-state="failed"[\s\S]*<span class="job-state" data-state="failed">没收敛<\/span>[\s\S]*<p class="job-card-line is-problem">优化没有收敛/u);
	const leaked = fixture('co2-g16.log').replace('/apps/g16/l1.exe', '/home/someone/g16/l1.exe');
	assert.deepEqual((await render(fence('./assets/co2.log'), { 'co2.log': leaked })).messages, [['qc-private', './assets/co2.log 里有服务器上的路径 /home/someone，发布后谁都能看到']]);
});
