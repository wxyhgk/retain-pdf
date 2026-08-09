import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_INLINE_CUBE_LENGTH, parseCubeBlock } from '../src/science/parsers/index.ts';
import {
	resolveScienceResourceUrl,
	setScienceResourceBaseUrl,
} from '../src/science/browser/resource-context.ts';
import {
	CUBE_DISPLAY_DEFAULTS,
	isCubeDisplaySettings,
	normalizeCubeDisplaySettings,
} from '../src/science/cube-display.mjs';
import { cubeSurfaceSpecs } from '../src/science/browser/cube-renderer.ts';

const minimalCube = [
	'water orbital',
	'generated fixture',
	' 1 0.0 0.0 0.0',
	' 1 0.2 0.0 0.0',
	' 1 0.0 0.2 0.0',
	' 1 0.0 0.0 0.2',
	' 8 8.0 0.0 0.0 0.0',
	' 0.01',
].join('\n');

test('Cube plugin parser claims cube fences and preserves safe @file references', () => {
	assert.equal(parseCubeBlock('xyz', minimalCube), null);
	assert.deepEqual(parseCubeBlock('CUBE', '@file ./assets/orbitals/homo.cube'), {
		type: 'cube-volume',
		language: 'cube',
		resource: { kind: 'file', path: './assets/orbitals/homo.cube' },
	});
});

test('Cube parser validates inline headers and keeps large volumes out of placeholders', () => {
	assert.equal(parseCubeBlock('cube-3d', minimalCube)?.resource.kind, 'inline');
	assert.throws(() => parseCubeBlock('cube', 'not a cube'), /文件头不完整/u);
	assert.throws(
		() => parseCubeBlock('cube', `${minimalCube}\n${'0 '.repeat(MAX_INLINE_CUBE_LENGTH)}`),
		/@file/u,
	);
});

test('article resource URLs encode validated bundle-relative segments only', () => {
	setScienceResourceBaseUrl('/article-assets/chemistry-rendering/');
	assert.equal(
		resolveScienceResourceUrl('./assets/orbitals/HOMO orbital.cube'),
		'/article-assets/chemistry-rendering/assets/orbitals/HOMO%20orbital.cube',
	);
	assert.throws(() => resolveScienceResourceUrl('../private.cube'), /assets.*img/u);
	assert.throws(() => resolveScienceResourceUrl('./assets/../ai/private.md'), /无效/u);
});

test('Cube display settings normalize safely and generate enabled phase surfaces', () => {
	assert.equal(isCubeDisplaySettings(CUBE_DISPLAY_DEFAULTS), true);
	assert.equal(isCubeDisplaySettings({ ...CUBE_DISPLAY_DEFAULTS, isovalue: 0 }), false);
	assert.equal(isCubeDisplaySettings({ ...CUBE_DISPLAY_DEFAULTS, opacity: 1.5 }), false);
	assert.equal(isCubeDisplaySettings({ ...CUBE_DISPLAY_DEFAULTS, moleculeStyle: 'cartoon' }), false);
	assert.deepEqual(normalizeCubeDisplaySettings({ broken: true }), CUBE_DISPLAY_DEFAULTS);

	assert.deepEqual(cubeSurfaceSpecs({
		...CUBE_DISPLAY_DEFAULTS,
		isovalue: 0.035,
		opacity: 0.6,
		negative: false,
	}), [{ isoval: 0.035, color: '#2563eb', opacity: 0.6 }]);
	assert.deepEqual(cubeSurfaceSpecs({ ...CUBE_DISPLAY_DEFAULTS, positive: false, negative: false }), []);
});
