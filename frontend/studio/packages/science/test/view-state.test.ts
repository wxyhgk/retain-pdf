import assert from 'node:assert/strict';
import test from 'node:test';
import { moleculeViewKey } from '../browser/molecule-renderer.ts';
import { copyView, is3DmolView, isFastMolView } from '../view-state.mjs';

test('keys saved views by both molecule format and exact source', () => {
	const source = '2\nH2\nH 0 0 0\nH 0 0 1';
	assert.equal(moleculeViewKey('xyz', source), moleculeViewKey('xyz', source));
	assert.notEqual(moleculeViewKey('xyz', source), moleculeViewKey('pdb', source));
	assert.notEqual(moleculeViewKey('xyz', source), moleculeViewKey('xyz', `${source}\n`));
});

test('a fast-mol view is its orientation (3×3), zoom and pan; a 3Dmol one, saved before, 8 to 16 numbers', () => {
	const view = { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], zoom: 1, pan: { x: 0, y: 0 } };
	assert.equal(isFastMolView(view), true);
	assert.equal(isFastMolView({ ...view, rotation: [1, 0, 0] }), false);
	assert.equal(isFastMolView({ ...view, zoom: Number.NaN }), false);
	assert.equal(isFastMolView([0, 1, 2, 3, 0, 0, 0, 1]), false);
	assert.equal(is3DmolView([0, 1, 2, 3, 0, 0, 0, 1]), true);
	assert.equal(is3DmolView([0, 1, 2]), false);
	// A copy has nothing else in it.
	assert.deepEqual(copyView({ ...view, extra: true }), view);
	assert.equal(copyView('view'), null);
});
