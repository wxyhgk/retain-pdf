import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { checkWidgets, widgetsIn } from './widget-check.mjs';

test('an article’s widgets, wherever they are, with their lines and options', () => {
	const source = '---\ntitle: x\n---\n\n```widget title="甲" height=300\n<p>甲</p>\n```\n\n- 列表里\n\n  ```widget\n  @file ./assets/b.html\n  ```\n';
	assert.deepEqual(widgetsIn(source).map(({ line, title, height, source: text }) => [line, title, height, text.trim()]), [
		[5, '甲', 300, '<p>甲</p>'],
		[11, '', 240, '@file ./assets/b.html'],
	]);
});

test('widgets run in a headless browser: what went wrong and on which line, what they drew, a picture of each', async (t) => {
	const folder = await mkdtemp(join(tmpdir(), 'widget-check-'));
	t.after(() => rm(folder, { recursive: true, force: true }));
	await mkdir(join(folder, 'assets'));
	await writeFile(join(folder, 'assets', 'data.txt'), '-76.41\n');
	await writeFile(join(folder, 'assets', 'plot.html'), [
		'<p id="out">…</p>',
		'<canvas id="c" width="200" height="100"></canvas>',
		'<script>',
		'note.file("assets/data.txt").then((text) => { out.textContent = "能量 " + text.trim(); });',
		'const g = c.getContext("2d"); g.fillRect(10, 10, 50, 50);',
		'</script>',
	].join('\n'));
	const source = [
		'```widget title="好的"',
		'@file ./assets/plot.html',
		'```',
		'',
		'```widget title="坏的"',
		'<canvas id="c" width="200" height="100"></canvas>',
		'<script>',
		'const T = 10;',
		'T(1);',
		'</script>',
		'```',
		'',
		'```widget',
		'@file ./assets/none.html',
		'```',
		'',
		'```widget',
		'<script src="http://127.0.0.1:9/plotly.js"></script>',
		'```',
	].join('\n');
	let checked;
	try {
		checked = await checkWidgets(folder, source, { settle: 300 });
	} catch (error) {
		if (/找不到能用的浏览器|要用 Playwright/u.test(error.message)) return t.skip(error.message);
		throw error;
	}
	const [good, bad, missing, unloaded] = checked.widgets;
	assert.deepEqual(good.errors, []);
	assert.equal(good.shows.text, '能量 -76.41');
	assert.deepEqual([good.shows.canvases, good.shows.blankCanvases], [1, 0]);
	assert.ok(good.height > 100);
	assert.ok(existsSync(good.picture));
	// The line as the widget's own source counts it (its fence's first line is 1).
	assert.equal(bad.errors.length, 1);
	assert.match(bad.errors[0].message, /T is not a function/u);
	assert.equal(bad.errors[0].line, 4);
	assert.equal(bad.shows.blankCanvases, 1);
	assert.match(missing.errors[0].message, /找不到 \.\/assets\/none\.html/u);
	// A script from the web not loaded: said which.
	assert.match(unloaded.errors[0].message, /^没加载到 http:\/\/127\.0\.0\.1:9\/plotly\.js$/u);
	// One of them only.
	const one = await checkWidgets(folder, source, { only: 2, settle: 100 });
	assert.deepEqual(one.widgets.map((widget) => widget.widget), [2]);
});
