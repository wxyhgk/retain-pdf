import assert from 'node:assert/strict';
import test from 'node:test';

import { jobFenceMeta, jobStructure, newJobId, parseJobFence, runFolder, runName } from '../job-fence.mjs';

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

