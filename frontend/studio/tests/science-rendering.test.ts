import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import type { MoleculeBlock } from '../src/science/model.ts';
import { parseMoleculeBlock } from '../src/science/parsers/index.ts';
import { prepareMoleculeRenderInput } from '../src/science/rendering/index.ts';

const fixture = (name: string) => readFile(new URL(`./fixtures/science/${name}`, import.meta.url), 'utf8');

function molecule(language: string, source: string): MoleculeBlock {
	const block = parseMoleculeBlock(language, source);
	assert.ok(block, `${language} should be recognized as a molecule block`);
	return block;
}

test('prepares the same RDKit input for blog and Studio adapters', () => {
	const input = prepareMoleculeRenderInput(molecule('smiles', ' CCO '));
	assert.equal(input.status, 'ready');
	assert.equal(input.renderer, 'rdkit');
	assert.equal(input.source, 'CCO');
	assert.equal(input.label, 'SMILES · CCO');
});

test('prepares GJF as XYZ before a 3D renderer sees it', async () => {
	const input = prepareMoleculeRenderInput(molecule('gjf', await fixture('water.gjf')));
	assert.equal(input.status, 'ready');
	assert.equal(input.renderer, '3dmol');
	assert.equal(input.format, 'xyz');
	assert.match(input.source, /^3\nGaussian input\nO /);
	assert.doesNotMatch(input.source, /%chk|#p b3lyp/);
});

test('passes native 3D formats through unchanged', () => {
	const xyz = '1\nhelium\nHe 0 0 0';
	const input = prepareMoleculeRenderInput(molecule('xyz', xyz));
	assert.equal(input.status, 'ready');
	assert.equal(input.renderer, '3dmol');
	assert.equal(input.format, 'xyz');
	assert.equal(input.source, xyz);
});

test('returns a resource request instead of reading @file itself', () => {
	const block = molecule('xyz', '@file ./assets/trajectory.xyz');
	assert.deepEqual(prepareMoleculeRenderInput(block), {
		status: 'needs-resource',
		resource: { kind: 'file', path: './assets/trajectory.xyz' },
		requestedView: '3d',
		block,
	});
});

test('classifies an auto SDF only after a host resolves its file source', async () => {
	const block = molecule('sdf', '@file ./assets/water.sdf');
	const twoD = prepareMoleculeRenderInput(block, await fixture('water-2d.sdf'));
	const threeD = prepareMoleculeRenderInput(block, await fixture('water-3d.sdf'));
	assert.equal(twoD.status, 'ready');
	assert.equal(twoD.renderer, 'rdkit');
	assert.equal(threeD.status, 'ready');
	assert.equal(threeD.renderer, '3dmol');
	assert.equal(threeD.format, 'sdf');
});
