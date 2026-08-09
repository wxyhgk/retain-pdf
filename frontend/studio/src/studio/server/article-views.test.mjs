import assert from 'node:assert/strict';
import test from 'node:test';
import { CUBE_DISPLAY_DEFAULTS } from '../../science/cube-display.mjs';
import {
	ArticleViewsError,
	readMoleculeViews,
	writeMoleculeView,
} from './article-views.mjs';

const view = [0, 0, 0, -12.5, 0, 0.382683, 0, 0.92388];

test('Cube display parameters round-trip beside the camera while old entries remain compatible', () => {
	const display = { ...CUBE_DISPLAY_DEFAULTS, isovalue: 0.035, opacity: 0.55, moleculeStyle: 'sphere' };
	const source = writeMoleculeView('', 'cube123', 'cube', view, display);
	assert.deepEqual(readMoleculeViews(source).cube123, { format: 'cube', view, display });

	const oldSource = JSON.stringify({ version: 1, molecules: { old123: { format: 'cube', view } } });
	assert.deepEqual(readMoleculeViews(oldSource).old123, { format: 'cube', view });
});

test('Cube display persistence rejects invalid or non-Cube display payloads', () => {
	assert.throws(
		() => writeMoleculeView('', 'cube123', 'cube', view, { ...CUBE_DISPLAY_DEFAULTS, opacity: 2 }),
		ArticleViewsError,
	);
	assert.throws(
		() => writeMoleculeView('', 'water123', 'xyz', view, CUBE_DISPLAY_DEFAULTS),
		ArticleViewsError,
	);
});

test('camera-only Cube saves preserve an already-valid display configuration', () => {
	const display = { ...CUBE_DISPLAY_DEFAULTS, positive: false, moleculeStyle: 'line' };
	const first = writeMoleculeView('', 'cube123', 'cube', view, display);
	const nextView = [...view];
	nextView[3] = -20;
	const second = writeMoleculeView(first, 'cube123', 'cube', nextView);
	assert.deepEqual(readMoleculeViews(second).cube123, { format: 'cube', view: nextView, display });
});
