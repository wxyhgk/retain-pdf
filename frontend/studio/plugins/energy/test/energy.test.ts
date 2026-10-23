import assert from 'node:assert/strict';
import test from 'node:test';

import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { VFile } from 'vfile';

import { buildBlocks } from '@blog/kernel/testing.mjs';
import { markdownPlugins } from '@blog/markdown/pipeline.mjs';
import * as energy from '../build.mjs';
import { energyColumns, energyLabels, parseEnergy } from '../energy.mjs';

const { remarkPlugins, rehypePlugins } = markdownPlugins({ blocks: await buildBlocks(energy) });

async function render(markdown: string) {
	const file = await unified()
		.use(remarkParse)
		.use(remarkPlugins as never)
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypePlugins as never)
		.use(rehypeStringify)
		.process(new VFile({ value: markdown, path: '/blog/note/index.md' }));
	return { html: String(file), messages: file.messages.map((message) => [message.ruleId, message.reason]) };
}

const TWO_PATHS = 'y: ΔG / kcal·mol⁻¹\ntitle: 两条路径\n# 分步\n反应物 + Nu⁻ 0\nTS1 12.3\n中间体 -4.1\nTS2 8.0\n产物 -15.2\n# 协同\n反应物 + Nu⁻ 0\nTS 18.5\n产物 −15.2';

test('a species a line, its name (spaces and all) then its energy; # starts a path, y: and title: are options', () => {
	const profile = parseEnergy(TWO_PATHS);
	assert.equal(profile.axis, 'ΔG / kcal·mol⁻¹');
	assert.equal(profile.title, '两条路径');
	assert.deepEqual(
		profile.paths.map((path) => [path.name, path.levels.map((level) => [level.name, level.value, level.shown])]),
		[
			['分步', [['反应物 + Nu⁻', 0, '0'], ['TS1', 12.3, '12.3'], ['中间体', -4.1, '−4.1'], ['TS2', 8, '8.0'], ['产物', -15.2, '−15.2']]],
			['协同', [['反应物 + Nu⁻', 0, '0'], ['TS', 18.5, '18.5'], ['产物', -15.2, '−15.2']]],
		],
	);
	assert.deepEqual(profile.problems, []);
});

test('lines that are no species are told by their line; a species another path gives another energy is no mistake', () => {
	const profile = parseEnergy('反应物 0\n过渡态\nTS 1e1\n# 水中\n反应物 2\n12');
	assert.deepEqual(profile.paths.map((path) => path.levels.map((level) => level.value)), [[0, 10], [2]]);
	assert.deepEqual(profile.problems.map((problem) => problem.line), [2, 6]);
});

test('a later path’s species another has stand in its column, those between spread evenly', () => {
	const { paths } = parseEnergy(TWO_PATHS);
	assert.deepEqual(energyColumns(paths), [[0, 1, 2, 3, 4], [0, 2, 4]]);
	// Before the first species shared, and after the last, a column a step; none shared, from where the first path starts.
	const more = parseEnergy('A 0\nB 1\n# x\nZ 3\nA 0\nC 2\n# y\nP 1\nQ 2');
	assert.deepEqual(energyColumns(more.paths), [[1, 2], [0, 1, 2], [1, 2]]);
});

test('in a column, a name the level below shares is said once; a number with no room over its level goes under it', () => {
	const at = (y: number, name: string, column = 0) => ({ column, y, level: { name } });
	const laid = energyLabels([at(100, '产物'), at(130, '产物'), at(145, 'P'), at(50, 'TS', 1)]);
	assert.deepEqual(
		laid.map((column) => column.map((level) => [level.level.name, level.y, level.named, level.valueBelow])),
		[
			[['产物', 100, false, false], ['产物', 130, true, false], ['P', 145, true, true]],
			[['TS', 50, true, false]],
		],
	);
});

test('the blog draws the diagram as SVG: a level a species, the paths dashed between, shared species once', async () => {
	const { html, messages } = await render(`前文\n\n\`\`\`energy\n${TWO_PATHS}\n\`\`\`\n`);
	assert.deepEqual(messages, []);
	assert.match(html, /<figure class="note-energy"><svg class="note-energy-plot" viewBox="0 0 \d+ \d+" role="img" aria-label="两条路径"/u);
	assert.equal(html.match(/class="energy-level/gu)?.length, 6);
	assert.equal(html.match(/class="energy-link energy-path-0"/gu)?.length, 4 + 1);
	assert.equal(html.match(/class="energy-link energy-path-1"/gu)?.length, 2 + 1);
	assert.match(html, /<text class="energy-value"[^>]*>−15.2<\/text>/u);
	assert.match(html, /<text class="energy-name"[^>]*>反应物 \+ Nu⁻<\/text>/u);
	assert.match(html, /<text class="energy-legend"[^>]*>协同<\/text>/u);
	assert.match(html, /<text class="energy-axis-name"[^>]*transform="rotate\(-90\)">ΔG \/ kcal·mol⁻¹<\/text>/u);
	assert.match(html, /<figcaption>两条路径<\/figcaption><\/figure>/u);
});

test('an article with HTML of its own (made safe) keeps the diagram as it was', async () => {
	const plain = await render(`\`\`\`energy\n${TWO_PATHS}\n\`\`\`\n`);
	const withHtml = await render(`<sup>1</sup>\n\n\`\`\`energy\n${TWO_PATHS}\n\`\`\`\n`);
	const svg = (html: string) => html.slice(html.indexOf('<svg'), html.indexOf('</svg>'));
	assert.equal(svg(withHtml.html), svg(plain.html));
	assert.match(svg(withHtml.html), /viewBox=/u);
});

test('what could not be read is reported for the check before publishing; an empty diagram says how to write one', async () => {
	const { html, messages } = await render('```energy\ny: E\nTS\n```\n');
	assert.deepEqual(messages, [
		['energy-line', '能量图第 2 行：读不出「TS」：要写成「名字 能量」，比如「TS1 12.3」'],
		['energy-empty', '能量图还没有数据'],
	]);
	assert.match(html, /<figure class="note-energy is-empty"><p class="note-energy-empty">能量图还没有数据/u);
});
