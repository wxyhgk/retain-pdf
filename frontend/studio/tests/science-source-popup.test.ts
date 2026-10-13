import assert from 'node:assert/strict';
import test from 'node:test';

import { placeSourcePopup } from '../src/studio/editor/source-popup.ts';

const viewport = { width: 1200, height: 800 };
const block = { top: 200, bottom: 440, left: 300, width: 600 };

test('over placement covers the block from its top edge, centered', () => {
	assert.deepEqual(placeSourcePopup(block, { width: 440, height: 160 }, viewport, 'over'), { left: 380, top: 200 });
});

test('below placement keeps the block visible', () => {
	assert.deepEqual(placeSourcePopup(block, { width: 600, height: 200 }, viewport, 'below'), { left: 300, top: 446 });
});

test('popup flips above when it would leave the viewport', () => {
	const low = { top: 600, bottom: 700, left: 300, width: 600 };
	assert.deepEqual(placeSourcePopup(low, { width: 600, height: 300 }, viewport, 'below'), { left: 300, top: 294 });
	assert.deepEqual(placeSourcePopup(low, { width: 440, height: 300 }, viewport, 'over'), { left: 380, top: 300 });
});

test('a popup that fits neither side is pinned inside the viewport', () => {
	const tall = { top: 100, bottom: 700, left: 300, width: 600 };
	assert.deepEqual(placeSourcePopup(tall, { width: 600, height: 400 }, viewport, 'below'), { left: 300, top: 388 });
});

test('popup stays inside the horizontal margins', () => {
	const edge = { top: 200, bottom: 300, left: 0, width: 100 };
	assert.equal(placeSourcePopup(edge, { width: 440, height: 100 }, viewport, 'over').left, 12);
	const right = { top: 200, bottom: 300, left: 1150, width: 50 };
	assert.equal(placeSourcePopup(right, { width: 440, height: 100 }, viewport, 'over').left, 1200 - 440 - 12);
});
