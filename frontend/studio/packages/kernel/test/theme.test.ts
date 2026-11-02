import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { applyPlugins, Context } from '../index.mjs';
import { checkToken, DESIGN_TOKENS, Styles, Theme, themeCss } from '../theme.ts';

test('a token is set only by its name, with a value that stays one declaration', () => {
	assert.throws(() => checkToken('editor-widht', '700px'), /没有叫 editor-widht 的设计变量；有：.*editor-width/u);
	assert.throws(() => checkToken('editor-width', ''), /非空/u);
	assert.throws(() => checkToken('editor-width', '700px; } body { display: none'), /不能含/u);
	assert.throws(() => checkToken('surface', 'red /* x */'), /不能含/u);
	assert.throws(() => checkToken('editor-line-height', '1.6em'), /一个数/u);
	assert.equal(checkToken('editor-line-height', ' 1.6 ').value, '1.6');
	assert.equal(checkToken('editor-width', 'min(90vw, 720px)').value, 'min(90vw, 720px)');
});

test('the grays kept as "r, g, b" take #hex too', () => {
	assert.equal(checkToken('text', '#333').value, '51, 51, 51');
	assert.equal(checkToken('line', '#E9E8E5').value, '233, 232, 229');
	assert.equal(checkToken('text', '10,20, 30').value, '10, 20, 30');
	assert.throws(() => checkToken('text', 'gray'), /#rrggbb/u);
	assert.throws(() => checkToken('text', '300, 0, 0'), /#rrggbb/u);
});

test('settings become one rule per mode, the later over the earlier', () => {
	const css = themeCss([
		{ values: { 'editor-width': '700px', surface: '#fafafa' } },
		{ values: { surface: '#111111' }, scheme: 'dark' },
		{ values: { 'editor-width': '760px' } },
	]);
	assert.equal(css, [
		"html:root:not([data-theme='dark']) {",
		'\t--studio-editor-width: 760px;',
		'\t--surface: #fafafa;',
		'}',
		"html:root[data-theme='dark'] {",
		'\t--studio-editor-width: 760px;',
		'\t--surface: #111111;',
		'}',
		'',
	].join('\n'));
	assert.equal(themeCss([]), '');
});

test('the defaults listed are the ones the stylesheets have', () => {
	const sheets = ['../../../src/styles/global.css', '../../../src/studio/tokens.css'].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));
	// The first (light, :root) value of each property.
	const declared = new Map<string, string>();
	for (const sheet of sheets) {
		for (const [, name, value] of sheet.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gmu)) if (!declared.has(name)) declared.set(name, value.trim());
	}
	for (const token of DESIGN_TOKENS) {
		assert.ok(declared.has(token.css), `${token.css} 不在 global.css 或 tokens.css 里`);
		assert.equal(checkToken(token.name, declared.get(token.css)).value, checkToken(token.name, token.default).value, token.name);
	}
	assert.equal(new Set(DESIGN_TOKENS.map((token) => token.name)).size, DESIGN_TOKENS.length);
});

test('what a plugin set or added goes with it', async () => {
	// Just what the services touch of a page.
	const head: Array<{ textContent: string }> = [];
	(globalThis as any).document = {
		head: { append: (element: any) => head.push(element) },
		createElement: () => {
			const element: any = { textContent: '', setAttribute() {}, remove: () => head.splice(head.indexOf(element), 1) };
			return element;
		},
	};
	try {
		const ctx = new Context();
		await ctx.plugin(Theme);
		await ctx.plugin(Styles);
		const [result] = await applyPlugins(ctx, [{ id: 'compact', module: { inject: ['theme', 'styles'], apply(c: any) {
			c.theme.set({ 'editor-width': '700px' });
			c.styles.add('.page-head { padding-top: 0; }');
		} } }]);
		assert.equal(result.state, 'active');
		assert.equal(head.length, 2);
		assert.match(head[0].textContent, /--studio-editor-width: 700px/u);
		assert.throws(() => (ctx as any).theme.set({ 'editor-widht': '1px' }), /没有叫/u);
		await result.fiber!.dispose();
		assert.equal(head.length, 1);
		assert.equal(head[0].textContent, '');
	} finally {
		delete (globalThis as any).document;
	}
});
