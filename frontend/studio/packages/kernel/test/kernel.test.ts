import assert from 'node:assert/strict';
import test from 'node:test';
import { Blocks } from '../blocks.mjs';
import { applyPlugins, Context, pluginProblems, pluginStatus, syncPlugins } from '../index.mjs';
import { created, readAnswer, Routes } from '../routes.mjs';

async function kernel() {
	const ctx = new Context();
	await ctx.plugin(Blocks);
	await ctx.plugin(Routes);
	return ctx as any;
}

test('a block is registered by its fence and goes with its plugin', async () => {
	const ctx = await kernel();
	const [result] = await applyPlugins(ctx, [{ id: 'job', module: { name: 'block-job', inject: ['blocks'], apply: (c: any) => c.blocks.register({ name: 'block-job', fence: ['job', 'Calc'] }) } }]);
	assert.equal(result.state, 'active');
	assert.equal(ctx.blocks.get('JOB').name, 'block-job');
	assert.equal(ctx.blocks.get('calc').name, 'block-job');
	assert.deepEqual(ctx.blocks.list().map((block: any) => block.name), ['block-job']);
	await result.fiber!.dispose();
	assert.equal(ctx.blocks.get('job'), null);
	assert.deepEqual(ctx.blocks.fences(), []);
});

test('a fence claimed twice is refused, and the first owner keeps it', async () => {
	const ctx = await kernel();
	const results = await applyPlugins(ctx, [
		{ id: 'a', module: { inject: ['blocks'], apply: (c: any) => c.blocks.register({ name: 'a', fence: 'job' }) } },
		{ id: 'b', module: { inject: ['blocks'], apply: (c: any) => c.blocks.register({ name: 'b', fence: 'job' }) } },
	]);
	assert.equal(results[0].state, 'active');
	assert.notEqual(results[1].state, 'active');
	assert.equal(ctx.blocks.get('job').name, 'a');
});

test('a plugin waiting for a service nobody provides is reported, not silently dropped', async () => {
	const ctx = await kernel();
	const results = await applyPlugins(ctx, [
		{ id: 'needs-jobs', module: { inject: ['jobs'], apply() {} } },
		{ id: 'broken', module: { apply() { throw new Error('坏了'); } } },
		{ id: 'empty', module: {} },
	]);
	const problems = pluginProblems(results);
	assert.equal(problems.length, 3);
	assert.match(problems[0], /needs-jobs.*等/u);
	assert.match(problems[2], /empty.*apply/u);
});

test('routes match methods and named segments, and go with their plugin', async () => {
	const ctx = await kernel();
	const [result] = await applyPlugins(ctx, [{ id: 'job', module: { inject: ['routes'], apply(c: any) {
		c.routes.get('/job/articles/:slug/jobs/:id/runs', ({ params }: any) => params);
		c.routes.post('/job/articles/:slug/jobs/:id/runs', () => created({ ok: true }));
	} } }]);
	const found = ctx.routes.match('GET', '/job/articles/a%20b/jobs/x1/runs');
	assert.deepEqual(found.params, { slug: 'a b', id: 'x1' });
	assert.equal(ctx.routes.match('DELETE', '/job/articles/a/jobs/x/runs'), null);
	assert.equal(ctx.routes.match('GET', '/job/articles/a/jobs/x/runs/extra'), null);
	const post = ctx.routes.match('POST', '/job/articles/a/jobs/x/runs');
	assert.deepEqual(readAnswer(await post.handler({})), { status: 201, value: { ok: true } });
	assert.deepEqual(readAnswer([1]), { status: 200, value: [1] });
	await result.fiber!.dispose();
	assert.equal(ctx.routes.match('GET', '/job/articles/a/jobs/x/runs'), null);
});

test('plugins are brought in line with a new version of their modules: only what changed is undone and applied again', async () => {
	const ctx = await kernel();
	const applied: string[] = [];
	const block = (name: string, fence: string) => ({ name, inject: ['blocks'], apply: (c: any) => {
		applied.push(name);
		c.blocks.register({ name, fence });
	} });
	const job = block('job', 'job');
	const cube = block('cube', 'cube');
	const loaded = new Map();
	assert.deepEqual(await syncPlugins(ctx, loaded, [{ id: 'job', module: job }, { id: 'cube', module: cube }]), { changed: ['job', 'cube'], problems: [] });
	assert.deepEqual(ctx.blocks.fences(), ['job', 'cube']);

	// job edited (another module), cube untouched, a new one, one gone next time.
	const job2 = block('job-2', 'job');
	const widget = block('widget', 'widget');
	applied.length = 0;
	assert.deepEqual(await syncPlugins(ctx, loaded, [{ id: 'job', module: job2 }, { id: 'cube', module: cube }, { id: 'widget', module: widget }]), { changed: ['job', 'widget'], problems: [] });
	assert.deepEqual(applied, ['job-2', 'widget']);
	assert.equal(ctx.blocks.get('job').name, 'job-2');

	assert.deepEqual((await syncPlugins(ctx, loaded, [{ id: 'job', module: job2 }, { id: 'widget', module: widget }])).changed, ['cube']);
	assert.equal(ctx.blocks.get('cube'), null);
	assert.deepEqual([...loaded.keys()], ['job', 'widget']);
});

test('a plugin that failed is not tried again until it changes, and one that is fixed starts', async () => {
	const ctx = await kernel();
	const loaded = new Map();
	let tries = 0;
	const broken = { apply() { tries += 1; throw new Error('坏了'); } };
	assert.match((await syncPlugins(ctx, loaded, [{ id: 'look', module: broken }])).problems[0], /look.*坏了/u);
	assert.deepEqual(pluginStatus(loaded.get('look')), { state: 'failed', error: '坏了' });
	assert.deepEqual(pluginStatus(undefined), { state: 'off' });
	assert.deepEqual(await syncPlugins(ctx, loaded, [{ id: 'look', module: broken }]), { changed: [], problems: [] });
	assert.equal(tries, 1);
	const fixed = { inject: ['blocks'], apply: (c: any) => c.blocks.register({ name: 'look', fence: 'look' }) };
	assert.deepEqual(await syncPlugins(ctx, loaded, [{ id: 'look', module: fixed }]), { changed: ['look'], problems: [] });
	assert.equal(ctx.blocks.get('look').name, 'look');
	assert.deepEqual(pluginStatus(loaded.get('look')), { state: 'active' });
	await syncPlugins(ctx, loaded, [{ id: 'waits', module: { inject: ['nothing'], apply() {} } }]);
	assert.deepEqual(pluginStatus(loaded.get('waits')), { state: 'waiting' });
});

test('a plugin that needs a service a later one provides is not reported as waiting', async () => {
	const ctx = await kernel();
	const results = await applyPlugins(ctx, [
		{ id: 'crest', module: { inject: ['jobs'], apply() {} } },
		{ id: 'job', module: { apply: (c: any) => c.provide('jobs', {}) } },
	]);
	assert.deepEqual(results.map((result) => result.state), ['active', 'active']);
	assert.deepEqual(pluginProblems(results), []);
});

test('a plugin whose apply never finishes, or whose file never finishes loading, is said to have failed; the rest start', async () => {
	const ctx = await kernel();
	const results = await applyPlugins(ctx, [
		{ id: 'stuck', module: { name: 'stuck', apply: () => new Promise(() => {}) } },
		{ id: 'fine', module: { name: 'fine', inject: ['blocks'], apply: (c: any) => c.blocks.register({ name: 'fine', fence: 'fine' }) } },
	], { patience: 50 });
	assert.deepEqual(results.map((result) => result.state), ['failed', 'active']);
	assert.match(pluginProblems(results)[0]!, /插件 stuck 没能启动：0\.05 秒内没有启动完/u);
	assert.equal(ctx.blocks.get('fine').name, 'fine');

	const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
	const { join } = await import('node:path');
	const { tmpdir } = await import('node:os');
	const { pluginModules } = await import('../node.mjs');
	const root = mkdtempSync(join(tmpdir(), 'kernel-plugins-'));
	try {
		for (const [name, code] of [['hangs', 'await new Promise(() => {});\nexport function apply() {}\n'], ['broken', 'export function apply( {\n'], ['works', 'export function apply() {}\n']]) {
			mkdirSync(join(root, 'plugins', name), { recursive: true });
			writeFileSync(join(root, 'plugins', name, 'build.mjs'), code);
		}
		const loaded = await pluginModules(root, 'build.mjs', { patience: 200 });
		assert.deepEqual(loaded.map((plugin: any) => [plugin.id, Boolean(plugin.module), Boolean(plugin.error)]), [['broken', false, true], ['hangs', false, true], ['works', true, false]]);
		assert.match(String((loaded[1] as any).error.message), /0\.2 秒内没有载入完/u);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('a block that claims no fence adds to the editor without owning a code block', async () => {
	const ctx = await kernel();
	const [result] = await applyPlugins(ctx, [{ id: 'menu-only', module: { name: 'menu-only', inject: ['blocks'], apply: (c: any) => c.blocks.register({ name: 'run-menu', fence: [] }) } }]);
	assert.equal(result.state, 'active');
	assert.deepEqual(ctx.blocks.list().map((block: any) => block.name), ['run-menu']);
	assert.deepEqual(ctx.blocks.fences(), []);
	await result.fiber!.dispose();
	assert.deepEqual(ctx.blocks.list(), []);
});
