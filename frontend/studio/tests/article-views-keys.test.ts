import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { moleculeViewKey } from '@blog/science/view-key.mjs';

// The blog's own articles, as saved by the Studio.
test('saved 3D views are keyed by the @file path as written', async () => {
	const views = JSON.parse(await readFile(new URL('../blog/chemistry-rendering/article.views.json', import.meta.url), 'utf8'));
	assert.equal(views.molecules[moleculeViewKey('cube', './assets/s0_homo.cube')]?.format, 'cube');
});
