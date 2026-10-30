import assert from 'node:assert/strict';
import test from 'node:test';

import { boardLists, freeColumnName, readConfig, shownDate, visibleRows, writeConfig, type Row } from '../src/studio/editor/database/database-config.ts';

const rows: Row[] = [
	{ slug: 'a', title: 'TS1', icon: '', props: { 方法: 'B3LYP', 能量: -76.4, 标签: ['opt', 'ts'], 完成: true, 日期: '2026-10-20' } },
	{ slug: 'b', title: 'IM1', icon: '', props: { 方法: 'PBE0', 能量: -76.5, 日期: '2026-10-22' } },
	{ slug: 'c', title: 'TS2', icon: '', props: { 方法: 'B3LYP' } },
];

test('settings read as far as they are right; written back without what a new one has', () => {
	const config = readConfig(JSON.stringify({ columns: [{ name: '方法', type: 'select', options: ['B3LYP', 'PBE0', '', 'PBE0'] }, { name: '能量', type: 'number', width: 140, hidden: true }, { name: '方法', type: 'text' }, { name: '坏的', type: 'formula' }, { name: '标题', type: 'text' }], view: 'board', sort: { column: '能量', dir: 'up' }, group: '能量' }));
	assert.deepEqual(config.columns, [{ name: '方法', type: 'select', options: ['B3LYP', 'PBE0'] }, { name: '能量', type: 'number', width: 140, hidden: true }]);
	assert.equal(config.view, 'board');
	assert.deepEqual(config.sorts, []);
	assert.equal(config.group, null);
	assert.deepEqual(readConfig('not json'), { id: null, title: '', columns: [], view: 'table', sorts: [], filter: [], group: null, template: null });
	assert.deepEqual(JSON.parse(writeConfig(readConfig(''))), { columns: [], view: 'table' });
	// Its id kept, first; one not an id (a path, too short) not.
	assert.deepEqual(Object.keys(JSON.parse(writeConfig(readConfig('{"title": "计算", "id": "k3f9x2ab"}')))), ['id', 'title', 'columns', 'view']);
	assert.equal(readConfig('{"id": "../x"}').id, null);
	assert.equal(readConfig('{"id": "ab"}').id, null);
	// As written before: one `sort`, a filter without its `op` (words held).
	const before = readConfig(JSON.stringify({ columns: [{ name: '能量', type: 'number' }], sort: { column: '能量', dir: 'asc' }, filter: [{ column: '标题', value: 'TS' }] }));
	assert.deepEqual(before.sorts, [{ column: '能量', dir: 'asc' }]);
	assert.deepEqual(before.filter, [{ column: '标题', op: 'contains', value: 'TS' }]);
});

test('rows sorted (a number as one, the empty last, by a second when equal) and filtered by kind', () => {
	const config = readConfig(JSON.stringify({ columns: [{ name: '方法', type: 'select', options: ['PBE0', 'B3LYP'] }, { name: '能量', type: 'number' }, { name: '标签', type: 'multi' }, { name: '完成', type: 'checkbox' }, { name: '日期', type: 'date' }], sorts: [{ column: '能量', dir: 'asc' }] }));
	const slugs = (next: Partial<typeof config>, search = '') => visibleRows(rows, { ...config, ...next }, search).map((row) => row.slug);
	assert.deepEqual(slugs({}), ['b', 'a', 'c']);
	assert.deepEqual(slugs({ sorts: [{ column: '能量', dir: 'desc' }] }), ['a', 'b', 'c']);
	// A choice by the choices' order; then by the title.
	assert.deepEqual(slugs({ sorts: [{ column: '方法', dir: 'asc' }, { column: '标题', dir: 'desc' }] }), ['b', 'c', 'a']);
	assert.deepEqual(slugs({ sorts: [], filter: [{ column: '方法', op: 'any', value: ['B3LYP'] }] }), ['a', 'c']);
	assert.deepEqual(slugs({ sorts: [], filter: [{ column: '方法', op: 'none', value: ['B3LYP'] }] }), ['b']);
	assert.deepEqual(slugs({ sorts: [], filter: [{ column: '标签', op: 'any', value: ['ts'] }] }), ['a']);
	assert.deepEqual(slugs({ sorts: [], filter: [{ column: '标题', op: 'contains', value: 'ts' }] }), ['a', 'c']);
	assert.deepEqual(slugs({ sorts: [], filter: [{ column: '完成', op: 'checked', value: 'true' }] }), ['a']);
	assert.deepEqual(slugs({ sorts: [], filter: [{ column: '完成', op: 'checked', value: 'false' }] }), ['b', 'c']);
	assert.deepEqual(slugs({ sorts: [], filter: [{ column: '能量', op: 'lt', value: '-76.45' }] }), ['b']);
	assert.deepEqual(slugs({ sorts: [], filter: [{ column: '能量', op: 'empty', value: '' }] }), ['c']);
	assert.deepEqual(slugs({ sorts: [], filter: [{ column: '日期', op: 'after', value: '2026-10-21' }] }), ['b']);
	// A filter not filled in yet: all through.
	assert.deepEqual(slugs({ sorts: [], filter: [{ column: '方法', op: 'any', value: [] }] }), ['a', 'b', 'c']);
	assert.deepEqual(slugs({ sorts: [] }, 'pbe'), ['b']);
});

test('the board’s lists: the rows with none first, then one for each choice', () => {
	const config = readConfig(JSON.stringify({ columns: [{ name: '方法', type: 'select', options: ['B3LYP', 'PBE0', 'M06'] }, { name: '完成', type: 'checkbox' }], view: 'board', group: '方法' }));
	assert.deepEqual(boardLists(rows, config).map((list) => [list.value, list.rows.map((row) => row.slug)]), [[null, []], ['B3LYP', ['a', 'c']], ['PBE0', ['b']], ['M06', []]]);
	assert.deepEqual(boardLists(rows, { ...config, group: '完成' }).map((list) => [list.value, list.rows.map((row) => row.slug)]), [['false', ['b', 'c']], ['true', ['a']]]);
});

test('the board has a list too for a choice a row has that the column does not (written in its page)', () => {
	const config = readConfig(JSON.stringify({ columns: [{ name: '方法', type: 'select', options: ['B3LYP'] }], view: 'board', group: '方法' }));
	assert.deepEqual(boardLists(rows, config).map((list) => [list.value, list.rows.map((row) => row.slug)]), [[null, []], ['B3LYP', ['a', 'c']], ['PBE0', ['b']]]);
});

test('dates as they are shown; a column name not taken', () => {
	assert.equal(shownDate('2026-10-05'), '2026年10月5日');
	assert.equal(shownDate(''), '');
	const config = readConfig(JSON.stringify({ columns: [{ name: '数字', type: 'number' }, { name: '数字 2', type: 'number' }] }));
	assert.equal(freeColumnName(config, '数字'), '数字 3');
	assert.equal(freeColumnName(config, '日期'), '日期');
});
