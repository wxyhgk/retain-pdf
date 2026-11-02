import assert from 'node:assert/strict';
import test from 'node:test';

import { crest } from '../program.mjs';

test('the form reads the CREST command line it knows, keeps what it does not, and writes it back', () => {
	const options = crest.read('--gfn2//gfnff --gbsa thf --ewin 4 --noreftopo');
	assert.deepEqual(options, { task: 'conformers', method: 'gfn2//gfnff', charge: 0, uhf: 0, solvent: { model: 'gbsa', name: 'thf' }, ewin: 4, extra: ['--noreftopo'] });
	assert.equal(crest.write(options), '--gfn2//gfnff --gbsa thf --ewin 4 --noreftopo');
	assert.equal(crest.write(crest.read('')), '--gfn2');
	assert.equal(crest.describe(options), '构象搜索 · GFN2//GFN-FF · THF（GBSA）');
	const ewin = crest.fields.find((field) => field.key === 'ewin')!;
	assert.equal(ewin.set(options, '').ewin, null);
	assert.equal(ewin.set(options, '3.5').ewin, 3.5);
});

test('what a CREST run executes', () => {
	assert.deepEqual(crest.command('input.xyz', '--gfn2', 16), ['crest', 'input.xyz', '--gfn2', '-T', '16']);
	assert.deepEqual(crest.command('input.xyz', '--gfn2', 0), ['crest', 'input.xyz', '--gfn2']);
	assert.deepEqual(crest.command('input.xyz', '--gfn2 -T 4', 16), ['crest', 'input.xyz', '--gfn2', '-T', '4']);
});
