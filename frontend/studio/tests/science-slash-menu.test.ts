import assert from 'node:assert/strict';
import test from 'node:test';

import { buildScienceSlashMenu, SCIENCE_SLASH_LANGUAGES } from '../src/studio/editor/science-slash-menu.ts';
import { parseScienceFence } from '../src/studio/editor/science-block.ts';

type CapturedItem = { key: string; label: string; icon: string; onRun: (ctx: never) => void };
type CapturedGroup = { key: string; label: string; items: CapturedItem[] };

function stubBuilder(): { builder: Parameters<typeof buildScienceSlashMenu>[0]; groups: CapturedGroup[] } {
	const groups: CapturedGroup[] = [];
	const builder = {
		addGroup: (key: string, label: string) => {
			const group: CapturedGroup = { key, label, items: [] };
			groups.push(group);
			return {
				addItem: (itemKey: string, item: Omit<CapturedItem, 'key'>) => {
					group.items.push({ ...item, key: itemKey });
				},
			};
		},
	};
	return { builder, groups };
}

test('slash menu appends one chemistry group', () => {
	const { builder, groups } = stubBuilder();
	buildScienceSlashMenu(builder);
	assert.equal(groups.length, 1);
	assert.equal(groups[0].key, 'science');
	assert.equal(groups[0].label, '化学');
});

test('slash menu covers the five scientific languages and delete', () => {
	const { builder, groups } = stubBuilder();
	buildScienceSlashMenu(builder);
	assert.deepEqual(
		groups[0].items.map((item) => item.key),
		[...SCIENCE_SLASH_LANGUAGES.map((entry) => entry.key), 'delete'],
	);
	const languages = groups[0].items.slice(0, -1);
	for (const item of languages) {
		assert.match(item.label, /化学/);
		assert.ok(item.icon.length > 0);
		assert.equal(typeof item.onRun, 'function');
	}
	assert.equal(groups[0].items.at(-1)?.label, '删除当前块');
});

test('slash menu languages are all recognized scientific fences', () => {
	for (const entry of SCIENCE_SLASH_LANGUAGES) {
		assert.ok(parseScienceFence(entry.info, ''), `${entry.info} should classify as science`);
	}
});
