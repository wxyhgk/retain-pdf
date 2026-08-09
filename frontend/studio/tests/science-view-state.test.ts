import assert from 'node:assert/strict';
import test from 'node:test';
import {
	moleculeViewKey,
	parseStoredMoleculeView,
} from '../src/science/browser/molecule-renderer.ts';

test('keys saved views by both molecule format and exact source', () => {
	const source = '2\nH2\nH 0 0 0\nH 0 0 1';
	assert.equal(moleculeViewKey('xyz', source), moleculeViewKey('xyz', source));
	assert.notEqual(moleculeViewKey('xyz', source), moleculeViewKey('pdb', source));
	assert.notEqual(moleculeViewKey('xyz', source), moleculeViewKey('xyz', `${source}\n`));
});

test('accepts only finite 3Dmol view arrays', () => {
	const view = [0, 1, 2, 3, 0, 0, 0, 1];
	assert.deepEqual(parseStoredMoleculeView(JSON.stringify(view)), view);
	assert.equal(parseStoredMoleculeView('[0,1,2]'), null);
	assert.equal(parseStoredMoleculeView('[0,1,2,3,0,0,0,"1"]'), null);
	assert.equal(parseStoredMoleculeView('not json'), null);
});
