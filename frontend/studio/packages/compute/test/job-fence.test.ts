import assert from 'node:assert/strict';
import test from 'node:test';

import { jobFenceMeta, jobStructure, newJobId, parseJobFence, runFolder, runName } from '../job-fence.mjs';
import { describeJob, jobCommand, readJobOptions, splitArgs, writeJobArgs } from '../job-options.mjs';

const WATER = '3\nwater\nO 0 0 0.1173\nH 0 0.7572 -0.4692\nH 0 -0.7572 -0.4692\n';

test('a job fence: its options, unknown ones kept, and its structure written in place or as a file', () => {
	const fence = parseJobFence('id=water-opt program=xtb args="--opt tight --alpb water" host=zh-5090 threads=8 title="水的 优化" run=20261019-153012 keep=me loose', WATER);
	assert.deepEqual({ ...fence, structure: fence.structure.kind }, {
		id: 'water-opt', program: 'xtb', args: '--opt tight --alpb water', host: 'zh-5090', threads: 8, title: '水的 优化', run: '20261019-153012', rest: ['keep=me', 'loose'], structure: 'inline',
	});
	assert.equal(jobFenceMeta(fence), 'id=water-opt program=xtb args="--opt tight --alpb water" host=zh-5090 threads=8 title="水的 优化" run=20261019-153012 keep=me loose');
	assert.deepEqual(jobStructure('@file ./assets/mol.xyz\n'), { kind: 'file', written: './assets/mol.xyz', path: 'assets/mol.xyz' });
	assert.deepEqual(jobStructure('  \n'), { kind: 'none' });
	assert.deepEqual(jobStructure('\n  RDKit\n\n  0  0  0  0  0  0  0  0  0  0999 V2000\nM  END\n'), { kind: 'inline', text: '\n  RDKit\n\n  0  0  0  0  0  0  0  0  0  0999 V2000\nM  END\n', format: 'mol' });
	// Nothing given: an xtb job here.
	assert.deepEqual({ ...parseJobFence('', ''), structure: undefined }, { id: '', program: 'xtb', args: '', host: 'local', threads: 0, title: '', run: '', rest: [], structure: undefined });
	assert.equal(jobFenceMeta({ id: 'a', program: 'crest', args: `say "hi"`, title: '', threads: 0 }), `id=a program=crest args='say "hi"'`);
});

test('runs are kept by job and by when they started; names that would leave the folder are refused', () => {
	assert.equal(runFolder('water-opt', '20261019-153012'), 'assets/jobs/water-opt/20261019-153012');
	assert.equal(runFolder('a', '20261019-153012-2'), 'assets/jobs/a/20261019-153012-2');
	assert.throws(() => runFolder('../x', '20261019-153012'));
	assert.throws(() => runFolder('a', '../../index'));
	assert.equal(runName(new Date(2026, 9, 9, 7, 5, 3)), '20261009-070503');
	let call = 0;
	const sequence = [0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
	assert.equal(newJobId(['job-000000'], () => sequence[call++]), 'job-iiiiii');
});

test('the form reads the command line it knows, keeps what it does not, and writes it back', () => {
	const options = readJobOptions('xtb', '--ohess vtight --gfn 1 --chrg -1 --uhf 1 --alpb water --cycles 500 --input "x control"');
	assert.deepEqual(options, { task: 'ohess', method: 'gfn1', level: 'vtight', charge: -1, uhf: 1, solvent: { model: 'alpb', name: 'water' }, ewin: null, extra: ['--cycles', '500', '--input', 'x control'] });
	assert.equal(writeJobArgs('xtb', options), "--ohess vtight --gfn 1 --chrg -1 --uhf 1 --alpb water --cycles 500 --input 'x control'");
	assert.equal(writeJobArgs('xtb', { ...options, task: 'sp', method: 'gfn2', charge: 0, uhf: 0, solvent: null, extra: [] }), '');
	assert.equal(readJobOptions('xtb', '').task, 'sp');
	assert.equal(writeJobArgs('xtb', readJobOptions('xtb', '--gfnff --opt')), '--opt --gfnff');

	const crest = readJobOptions('crest', '--gfn2//gfnff --gbsa thf --ewin 4 --noreftopo');
	assert.deepEqual(crest, { task: 'conformers', method: 'gfn2//gfnff', level: '', charge: 0, uhf: 0, solvent: { model: 'gbsa', name: 'thf' }, ewin: 4, extra: ['--noreftopo'] });
	assert.equal(writeJobArgs('crest', crest), '--gfn2//gfnff --gbsa thf --ewin 4 --noreftopo');
	assert.equal(describeJob('xtb', options), '优化 + 频率 · GFN1-xTB · 电荷 -1 · 1 个未成对电子 · 水（ALPB）');
});

test('what a run executes: the threads added unless the command line says how many', () => {
	assert.deepEqual(splitArgs(` --opt  'a b' "c"d `), ['--opt', 'a b', 'cd']);
	assert.deepEqual(jobCommand('xtb', '--opt', 'input.xyz', 8), ['xtb', 'input.xyz', '--opt', '--parallel', '8']);
	assert.deepEqual(jobCommand('xtb', '--opt -P 2', 'input.xyz', 8), ['xtb', 'input.xyz', '--opt', '-P', '2']);
	assert.deepEqual(jobCommand('crest', '--gfn2', 'input.xyz', 16), ['crest', 'input.xyz', '--gfn2', '-T', '16']);
	assert.deepEqual(jobCommand('crest', '--gfn2', 'input.xyz', 0), ['crest', 'input.xyz', '--gfn2']);
});
