import assert from 'node:assert/strict';
import test from 'node:test';

import { xtb } from '../program.mjs';

test('the form reads the xtb command line it knows, keeps what it does not, and writes it back', () => {
	const options = xtb.read('--ohess vtight --gfn 1 --chrg -1 --uhf 1 --alpb water --cycles 500 --input "x control"');
	assert.deepEqual(options, { task: 'ohess', method: 'gfn1', level: 'vtight', charge: -1, uhf: 1, solvent: { model: 'alpb', name: 'water' }, extra: ['--cycles', '500', '--input', 'x control'] });
	assert.equal(xtb.write(options), "--ohess vtight --gfn 1 --chrg -1 --uhf 1 --alpb water --cycles 500 --input 'x control'");
	assert.equal(xtb.write({ ...options, task: 'sp', method: 'gfn2', charge: 0, uhf: 0, solvent: null, extra: [] }), '');
	assert.equal(xtb.read('').task, 'sp');
	assert.equal(xtb.write(xtb.read('--gfnff --opt')), '--opt --gfnff');
	assert.equal(xtb.describe(options), '优化 + 频率 · GFN1-xTB · 电荷 -1 · 1 个未成对电子 · 水（ALPB）');
});

test('what an xtb run executes: the threads added unless the command line says how many', () => {
	assert.deepEqual(xtb.command('input.xyz', '--opt', 8), ['xtb', 'input.xyz', '--opt', '--parallel', '8']);
	assert.deepEqual(xtb.command('input.xyz', '--opt -P 2', 8), ['xtb', 'input.xyz', '--opt', '-P', '2']);
	assert.deepEqual(xtb.command('input.xyz', '--opt', 0), ['xtb', 'input.xyz', '--opt']);
});

test('the form’s fields read and write the options: the level only for an optimization, the solvent only with a model', () => {
	const field = (key: string) => xtb.fields.find((entry) => entry.key === key)!;
	let options = xtb.read('--hess');
	assert.equal(field('level').shown!(options), false);
	options = field('task').set(options, 'opt');
	assert.equal(field('level').shown!(options), true);
	options = field('level').set(options, 'tight');
	assert.equal(field('solvent').shown!(options), false);
	options = field('solvent-model').set(options, 'gbsa');
	assert.deepEqual(options.solvent, { model: 'gbsa', name: 'water' });
	options = field('solvent').set(options, 'thf');
	options = field('charge').set(options, '+2');
	assert.equal(xtb.write(options), '--opt tight --chrg 2 --gbsa thf');
	assert.ok(field('solvent').choices!(xtb.read('--alpb heptane')).some(([value]) => value === 'heptane'));
});
