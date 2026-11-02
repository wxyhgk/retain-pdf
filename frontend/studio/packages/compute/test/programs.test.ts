import assert from 'node:assert/strict';
import test from 'node:test';

import { applyPlugins, Context } from '@blog/kernel/index.mjs';

import { JobPrograms } from '../programs.mjs';

const program = (name: string, order?: number) => ({ name, label: name, ...(order === undefined ? {} : { order }) });

test('programs are registered by name, listed by their order, and go with their plugin', async () => {
	const ctx = new Context() as any;
	await ctx.plugin(JobPrograms);
	const results = await applyPlugins(ctx, [
		{ id: 'crest', module: { inject: ['jobs'], apply: (c: any) => c.jobs.register(program('crest', 20)) } },
		{ id: 'orca', module: { inject: ['jobs'], apply: (c: any) => c.jobs.register(program('orca')) } },
		{ id: 'xtb', module: { inject: ['jobs'], apply: (c: any) => c.jobs.register(program('xtb', 10)) } },
		{ id: 'xtb-again', module: { inject: ['jobs'], apply: (c: any) => c.jobs.register(program('xtb')) } },
		{ id: 'bad', module: { inject: ['jobs'], apply: (c: any) => c.jobs.register(program('Bad Name')) } },
	]);
	assert.deepEqual(results.map((result) => result.state), ['active', 'active', 'active', 'failed', 'failed']);
	assert.deepEqual(ctx.jobs.list().map((entry: any) => entry.name), ['xtb', 'crest', 'orca']);
	assert.equal(ctx.jobs.get('XTB').name, 'xtb');
	assert.equal(ctx.jobs.get('g16'), null);
	await results[0].fiber!.dispose();
	assert.deepEqual(ctx.jobs.list().map((entry: any) => entry.name), ['xtb', 'orca']);
});
