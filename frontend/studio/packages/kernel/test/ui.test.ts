import assert from 'node:assert/strict';
import test from 'node:test';

import { applyPlugins, Context } from '../index.mjs';
import { Commands, matchesShortcut, Panels, parseShortcut, Recognizers, shortcutName } from '../ui.ts';

async function kernel() {
	const ctx = new Context();
	await ctx.plugin(Panels);
	await ctx.plugin(Commands);
	await ctx.plugin(Recognizers);
	return ctx as any;
}

const press = (key: string, code: string, held: { meta?: boolean; ctrl?: boolean; shift?: boolean; alt?: boolean } = {}) => ({
	key,
	code,
	metaKey: Boolean(held.meta),
	ctrlKey: Boolean(held.ctrl),
	shiftKey: Boolean(held.shift),
	altKey: Boolean(held.alt),
});

test('a shortcut is Mod or Alt and one key, written one way', () => {
	assert.deepEqual(parseShortcut('Mod-Shift-D'), { key: 'd', mod: true, shift: true, alt: false });
	assert.equal(shortcutName(parseShortcut('shift-mod-d')), 'Mod-Shift-d');
	assert.equal(shortcutName(parseShortcut('Alt-enter')), 'Alt-Enter');
	assert.equal(parseShortcut('Mod--').key, '-');
	assert.equal(parseShortcut('F2').key, 'F2');
	assert.throws(() => parseShortcut('Shift-d'), /Mod 或 Alt/u);
	assert.throws(() => parseShortcut('d'), /Mod 或 Alt/u);
	assert.throws(() => parseShortcut('Cmd-d'), /Mod-Shift-d/u);
	assert.throws(() => parseShortcut('Mod-Mod-d'), /Mod-Shift-d/u);
	assert.throws(() => parseShortcut('Mod-Space'), /没有叫 Space 的键/u);
	assert.throws(() => parseShortcut(''), /Mod-Shift-d/u);
});

test('a key press matches by the key’s place, whatever Alt or Shift makes it type', () => {
	const shortcut = parseShortcut('Mod-Alt-d');
	assert.ok(matchesShortcut(shortcut, press('∂', 'KeyD', { meta: true, alt: true })));
	assert.ok(matchesShortcut(shortcut, press('d', 'KeyD', { ctrl: true, alt: true })));
	assert.ok(!matchesShortcut(shortcut, press('d', 'KeyD', { meta: true })));
	assert.ok(!matchesShortcut(shortcut, press('D', 'KeyD', { meta: true, alt: true, shift: true })));
	assert.ok(matchesShortcut(parseShortcut('Mod-Shift-1'), press('!', 'Digit1', { meta: true, shift: true })));
	assert.ok(matchesShortcut(parseShortcut('Alt-Enter'), press('Enter', 'Enter', { alt: true })));
});

test('commands come and go with their plugin, and are found by id, place and keys', async () => {
	const ctx = await kernel();
	const ran: string[] = [];
	let heard = 0;
	ctx.commands.watch(() => heard++);
	const [result] = await applyPlugins(ctx, [{ id: 'date', module: { inject: ['commands'], apply(c: any) {
		c.commands.register({ id: 'date.today', label: '今天的日期', keys: 'Mod-Shift-d', places: ['slash', 'sidebar'], run: (context: any) => void ran.push(context.from) });
		c.commands.register({ id: 'date.count', label: '字数', places: ['page-menu'], run: () => void ran.push('count') });
	} } }]);
	assert.equal(result.state, 'active');
	assert.equal(heard, 2);
	assert.deepEqual(ctx.commands.list().map((command: any) => command.id), ['date.today', 'date.count']);
	assert.deepEqual(ctx.commands.list('slash').map((command: any) => command.id), ['date.today']);
	assert.deepEqual(ctx.commands.list('page-menu').map((command: any) => command.id), ['date.count']);
	assert.equal(ctx.commands.forKey(press('D', 'KeyD', { meta: true, shift: true }))?.id, 'date.today');
	assert.equal(ctx.commands.forKey(press('d', 'KeyD', { meta: true })), null);
	await ctx.commands.run('date.count');
	await ctx.commands.run('date.today', { from: 'keys' });
	assert.deepEqual(ran, ['count', 'keys']);
	await assert.rejects(ctx.commands.run('date.yesterday'), /没有叫 date.yesterday 的命令/u);
	await result.fiber!.dispose();
	assert.equal(heard, 4);
	assert.deepEqual(ctx.commands.list(), []);
	assert.equal(ctx.commands.forKey(press('D', 'KeyD', { meta: true, shift: true })), null);
});

test('a command is refused for a taken id or shortcut, the Studio’s keys, or a place there is not', async () => {
	const ctx = await kernel();
	const run = () => {};
	ctx.commands.register({ id: 'a.one', label: '一', keys: 'Mod-Shift-d', run });
	assert.throws(() => ctx.commands.register({ id: 'a.one', label: '一', run }), /已经有叫 a.one 的命令/u);
	assert.throws(() => ctx.commands.register({ id: 'b.two', label: '二', keys: 'shift-mod-D', run }), /已经给了命令 a.one/u);
	assert.throws(() => ctx.commands.register({ id: 'b.save', label: '存', keys: 'Mod-s', run }), /Studio 或浏览器自己的/u);
	assert.throws(() => ctx.commands.register({ id: 'b.copy', label: '复制', keys: 'Mod-C', run }), /Studio 或浏览器自己的/u);
	assert.throws(() => ctx.commands.register({ id: 'b.three', label: '三', places: ['toolbar'], run }), /没有 toolbar 这个地方/u);
	assert.throws(() => ctx.commands.register({ id: 'B three', label: '三', run }), /id 要用小写字母开头/u);
	assert.throws(() => ctx.commands.register({ id: 'b.four', label: ' ', run }), /要有 label/u);
	assert.throws(() => ctx.commands.register({ id: 'b.five', label: '五' }), /要有 run/u);
	assert.equal(ctx.commands.list().length, 1);
});

test('a panel is a tab of its own, in order, gone with its plugin', async () => {
	const ctx = await kernel();
	let heard = 0;
	ctx.panels.watch(() => heard++);
	const draw = () => {};
	const results = await applyPlugins(ctx, [
		{ id: 'notes', module: { inject: ['panels'], apply: (c: any) => c.panels.register({ key: 'notes', label: '便签', order: 20, draw }) } },
		{ id: 'chat', module: { inject: ['panels'], apply: (c: any) => c.panels.register({ key: 'chat', label: '对话', order: 10, draw }) } },
		{ id: 'todo', module: { inject: ['panels'], apply: (c: any) => c.panels.register({ key: 'todo', label: '待办', order: 20, draw }) } },
	]);
	assert.deepEqual(results.map((result) => result.state), ['active', 'active', 'active']);
	assert.deepEqual(ctx.panels.list().map((panel: any) => panel.key), ['chat', 'notes', 'todo']);
	assert.equal(heard, 3);
	await results[0]!.fiber!.dispose();
	assert.deepEqual(ctx.panels.list().map((panel: any) => panel.key), ['chat', 'todo']);
	assert.equal(heard, 4);
});

test('a panel is refused for a taken key, the Studio’s own tabs, or no way to draw it', async () => {
	const ctx = await kernel();
	const draw = () => {};
	ctx.panels.register({ key: 'chat', label: '对话', draw });
	assert.throws(() => ctx.panels.register({ key: 'chat', label: '对话', draw }), /已经有叫 chat 的面板/u);
	assert.throws(() => ctx.panels.register({ key: 'terminal', label: '终端', draw }), /Studio 自己的/u);
	assert.throws(() => ctx.panels.register({ key: 'Chat', label: '对话', draw }), /小写字母开头/u);
	assert.throws(() => ctx.panels.register({ key: 'notes', label: '', draw }), /要有 label/u);
	assert.throws(() => ctx.panels.register({ key: 'notes', label: '便签' }), /draw\(pane\)/u);
	// A listener that throws keeps the others from nothing.
	let heard = 0;
	ctx.panels.watch(() => {
		throw new Error('坏了');
	});
	ctx.panels.watch(() => heard++);
	const error = console.error;
	console.error = () => {};
	try {
		ctx.panels.register({ key: 'notes', label: '便签', draw });
	} finally {
		console.error = error;
	}
	assert.equal(heard, 1);
});

test('what pictures are read as (识别) comes and goes with its plugin; the answer made Markdown as it says', async () => {
	const ctx = await kernel();
	let heard = 0;
	ctx.recognizers.watch(() => heard++);
	const [result] = await applyPlugins(ctx, [{ id: 'read', module: { inject: ['recognizers'], apply(c: any) {
		c.recognizers.register({ id: 'read.formula', label: '公式 → LaTeX', prompt: 'LaTeX', toMarkdown: (answer: string) => `$$\n${answer}\n$$` });
		c.recognizers.register({ id: 'read.text', label: '文字', prompt: 'text' });
	} } }]);
	assert.equal(result.state, 'active');
	assert.equal(heard, 2);
	const [formula, text] = ctx.recognizers.list();
	assert.deepEqual([formula.id, text.id], ['read.formula', 'read.text']);
	assert.equal(Recognizers.markdown(formula, 'E = mc^2'), '$$\nE = mc^2\n$$');
	assert.equal(Recognizers.markdown(text, '一段话'), '一段话');
	await result.fiber!.dispose();
	assert.deepEqual(ctx.recognizers.list(), []);
	assert.equal(heard, 4);
});

test('a way of reading pictures is refused without an id of the right form, a label or a prompt, or for a taken id', async () => {
	const ctx = await kernel();
	const tried = (recognizer: object) => () => ctx.recognizers.register(recognizer);
	assert.throws(tried({ id: 'Formula', label: 'a', prompt: 'b' }), /小写字母开头/u);
	assert.throws(tried({ id: 'a.b', label: ' ', prompt: 'b' }), /label/u);
	assert.throws(tried({ id: 'a.b', label: 'a', prompt: '' }), /prompt/u);
	assert.throws(tried({ id: 'a.b', label: 'a', prompt: 'b', toMarkdown: 'x' }), /toMarkdown/u);
	ctx.recognizers.register({ id: 'a.b', label: 'a', prompt: 'b' });
	assert.throws(tried({ id: 'a.b', label: 'c', prompt: 'd' }), /已经有叫 a.b 的识别了/u);
});
