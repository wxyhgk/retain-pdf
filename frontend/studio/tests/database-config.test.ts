import assert from 'node:assert/strict';
import test from 'node:test';

import { boardLists, readConfig, visibleRows, writeConfig, type Row } from '../src/studio/editor/database/database-config.ts';

const rows: Row[] = [
	{ slug: 'a', title: 'TS1', icon: '', props: { 方法: 'B3LYP', 能量: -76.4, 标签: ['opt', 'ts'], 完成: true } },
	{ slug: 'b', title: 'IM1', icon: '', props: { 方法: 'PBE0', 能量: -76.5 } },
	{ slug: 'c', title: 'TS2', icon: '', props: { 方法: 'B3LYP' } },
];

test('settings read as far as they are right; written back without what a new one has', () => {
	const config = readConfig(JSON.stringify({ columns: [{ name: '方法', type: 'select', options: ['B3LYP', 'PBE0', ''] }, { name: '能量', type: 'number' }, { name: '方法', type: 'text' }, { name: '坏的', type: 'formula' }, { name: '标题', type: 'text' }], view: 'board', sort: { column: '能量', dir: 'up' }, group: '能量' }));
	assert.deepEqual(config.columns, [{ name: '方法', type: 'select', options: ['B3LYP', 'PBE0'] }, { name: '能量', type: 'number' }]);
	assert.equal(config.view, 'board');
	assert.equal(config.sort, null);
	assert.equal(config.group, null);
	assert.deepEqual(readConfig('not json'), { columns: [], view: 'table', sort: null, filter: [], group: null, template: null });
	assert.deepEqual(JSON.parse(writeConfig(readConfig(''))), { columns: [], view: 'table' });
});

test('rows sorted (a number as one, the empty last) and filtered (a choice, a list’s item, words)', () => {
	const config = readConfig(JSON.stringify({ columns: [{ name: '方法', type: 'select', options: ['B3LYP', 'PBE0'] }, { name: '能量', type: 'number' }, { name: '标签', type: 'multi' }, { name: '完成', type: 'checkbox' }], sort: { column: '能量', dir: 'asc' } }));
	assert.deepEqual(visibleRows(rows, config).map((row) => row.slug), ['b', 'a', 'c']);
	assert.deepEqual(visibleRows(rows, { ...config, sort: { column: '能量', dir: 'desc' } }).map((row) => row.slug), ['a', 'b', 'c']);
	assert.deepEqual(visibleRows(rows, { ...config, sort: null, filter: [{ column: '方法', value: 'B3LYP' }] }).map((row) => row.slug), ['a', 'c']);
	assert.deepEqual(visibleRows(rows, { ...config, sort: null, filter: [{ column: '标签', value: 'ts' }] }).map((row) => row.slug), ['a']);
	assert.deepEqual(visibleRows(rows, { ...config, sort: null, filter: [{ column: '标题', value: 'ts' }] }).map((row) => row.slug), ['a', 'c']);
	assert.deepEqual(visibleRows(rows, { ...config, sort: null, filter: [{ column: '完成', value: 'true' }] }).map((row) => row.slug), ['a']);
});

test('the board’s lists: one for each choice, and the rows with none', () => {
	const config = readConfig(JSON.stringify({ columns: [{ name: '方法', type: 'select', options: ['B3LYP', 'PBE0', 'M06'] }], view: 'board', group: '方法' }));
	assert.deepEqual(boardLists(rows, config).map((list) => [list.value, list.rows.map((row) => row.slug)]), [['B3LYP', ['a', 'c']], ['PBE0', ['b']], ['M06', []], [null, []]]);
});

test('the board has a list too for a choice a row has that the column does not (written in its page)', () => {
	const config = readConfig(JSON.stringify({ columns: [{ name: '方法', type: 'select', options: ['B3LYP'] }], view: 'board', group: '方法' }));
	assert.deepEqual(boardLists(rows, config).map((list) => [list.value, list.rows.map((row) => row.slug)]), [['B3LYP', ['a', 'c']], ['PBE0', ['b']], [null, []]]);
});
