import assert from 'node:assert/strict';
import test from 'node:test';

import { parseScienceFence } from '../science-block.ts';
import { scienceSlashEntries, SCIENCE_SLASH_LANGUAGES } from '../science-slash-menu.ts';

test('slash menu covers the five scientific languages and delete', () => {
	const entries = scienceSlashEntries();
	assert.deepEqual(
		entries.map((entry) => entry.key),
		[...SCIENCE_SLASH_LANGUAGES.map((entry) => entry.key), 'delete'],
	);
	for (const entry of entries.slice(0, -1)) {
		assert.match(entry.label, /化学/);
		assert.ok(entry.icon.length > 0);
		assert.equal(typeof entry.insert, 'function');
	}
	assert.equal(entries.at(-1)?.label, '删除当前块');
});

test('slash menu languages are all recognized scientific fences', () => {
	for (const entry of SCIENCE_SLASH_LANGUAGES) {
		assert.ok(parseScienceFence(entry.info, ''), `${entry.info} should classify as science`);
	}
});
