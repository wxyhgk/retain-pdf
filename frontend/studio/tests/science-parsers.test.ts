import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
	gaussianToXyz,
	InvalidScienceResourcePathError,
	parseMoleculeBlock,
	parseScienceResourceRef,
	sdfHas3DCoordinates,
	UnsupportedGaussianCoordinatesError,
} from '../src/science/parsers/index.ts';

const fixture = (name: string) => readFile(new URL(`./fixtures/science/${name}`, import.meta.url), 'utf8');

test('classifies the existing chemistry fence languages', async () => {
	assert.deepEqual(parseMoleculeBlock('smiles', 'CCO'), {
		type: 'molecule', language: 'smiles', view: '2d', resource: { kind: 'inline', text: 'CCO' },
	});
	const gjf = await fixture('water.gjf');
	assert.deepEqual(parseMoleculeBlock('GJF', gjf), {
		type: 'molecule', language: 'gjf', view: '3d', resource: { kind: 'inline', text: gjf.trim() }, viewerFormat: 'xyz',
	});
	assert.equal(parseMoleculeBlock('typescript', 'const molecule = true'), null);
});

test('auto-detects 2D and 3D SDF coordinates while explicit suffixes win', async () => {
	const twoD = await fixture('water-2d.sdf');
	const threeD = await fixture('water-3d.sdf');
	assert.equal(sdfHas3DCoordinates(twoD), false);
	assert.equal(sdfHas3DCoordinates(threeD), true);
	assert.equal(parseMoleculeBlock('sdf', twoD)?.view, '2d');
	assert.equal(parseMoleculeBlock('mol', threeD)?.view, '3d');
	assert.equal(parseMoleculeBlock('sdf-2d', threeD)?.view, '2d');
	assert.equal(parseMoleculeBlock('sdf-3d', twoD)?.view, '3d');
	assert.equal(sdfHas3DCoordinates([
		'Water', '  ChemBlog', '', '  0  0  0     0  0            999 V3000',
		'M  V30 BEGIN CTAB', 'M  V30 BEGIN ATOM', 'M  V30 1 O 0.0 0.0 0.1173 0',
		'M  V30 END ATOM', 'M  V30 END CTAB', 'M  END',
	].join('\n')), true);
});

test('converts Gaussian Cartesian coordinates, atomic numbers, and D exponents to XYZ', async () => {
	assert.equal(
		gaussianToXyz(await fixture('water.gjf')),
		'3\nGaussian input\nO 0.000000 0.000000 0.000000\nH 0.758602E+00 0.000000 0.504284\nH -0.758602 0.000000 0.504284',
	);
	assert.equal(gaussianToXyz('# test\n\n0 1\n79 0 0 0\n'), '1\nGaussian input\nAu 0 0 0');
});

test('rejects Gaussian Z-matrices with an actionable typed error', () => {
	assert.throws(
		() => gaussianToXyz('# test\n\n0 1\nO\nH 1 0.96\nH 1 0.96 2 104.5\n'),
		(error) => error instanceof UnsupportedGaussianCoordinatesError && /Z-matrix/.test(error.message),
	);
});

test('recognizes an exact @file line without reading the filesystem', () => {
	assert.deepEqual(parseScienceResourceRef('@file ./assets/trajectory.xyz'), {
		kind: 'file', path: './assets/trajectory.xyz',
	});
	assert.deepEqual(parseMoleculeBlock('xyz', '@file ./assets/trajectory.xyz'), {
		type: 'molecule', language: 'xyz', view: '3d',
		resource: { kind: 'file', path: './assets/trajectory.xyz' }, viewerFormat: 'xyz',
	});
	assert.equal(parseMoleculeBlock('sdf', '@file ./assets/water.sdf')?.view, 'auto');
});

test('rejects unsafe or ambiguous @file directives', () => {
	for (const source of [
		'@file ../secret.xyz',
		'@file /tmp/water.xyz',
		'@file ./assets/../secret.xyz',
		'@file .\\assets\\water.xyz',
		'@file ./assets/water.xyz\nextra',
	]) {
		assert.throws(() => parseScienceResourceRef(source), InvalidScienceResourcePathError);
	}
});
