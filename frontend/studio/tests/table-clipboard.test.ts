import assert from 'node:assert/strict';
import test from 'node:test';

import { cellsOf, copiedText, pastedValue, tableText } from '../src/studio/editor/database/table-clipboard.ts';
import type { Column, Row } from '../src/studio/editor/database/database-config.ts';

test('cells as a spreadsheet copies them, and back: tabs, lines, a quoted cell with a tab, a line break or a quote', () => {
	const grid = [['方法', '能量'], ['B3LYP', '-76.41'], ['说 "好"', '一行\n两行'], ['a\tb', '']];
	const text = tableText(grid);
	assert.equal(text, '方法\t能量\nB3LYP\t-76.41\n"说 ""好"""\t"一行\n两行"\n"a\tb"\t');
	assert.deepEqual(cellsOf(text), grid);
	// Excel's: CRLF, a last line break.
	assert.deepEqual(cellsOf('1\t2\r\n3\t4\r\n'), [['1', '2'], ['3', '4']]);
	assert.deepEqual(cellsOf('一个值'), [['一个值']]);
});

test('a value copied as it reads, pasted as its column keeps it', () => {
	const row: Row = { slug: 'a', title: 'H2O', icon: '', props: { 能量: -76.41, 标签: ['opt', 'ts'], 收敛: true } };
	const column = (name: string, type: Column['type']): Column => ({ name, type });
	assert.equal(copiedText(row, '标题'), 'H2O');
	assert.equal(copiedText(row, column('能量', 'number')), '-76.41');
	assert.equal(copiedText(row, column('标签', 'multi')), 'opt, ts');
	assert.equal(copiedText(row, column('收敛', 'checkbox')), 'true');
	assert.equal(copiedText(row, column('备注', 'text')), '');
	assert.equal(pastedValue(column('能量', 'number'), ' 1,234.5 '), 1234.5);
	assert.equal(pastedValue(column('收敛', 'checkbox'), '是'), true);
	assert.equal(pastedValue(column('收敛', 'checkbox'), 'FALSE'), false);
	assert.equal(pastedValue(column('日期', 'date'), '2026/1/5'), '2026-01-05');
	assert.equal(pastedValue(column('日期', 'date'), '2026年10月20日'), '2026-10-20');
	assert.deepEqual(pastedValue(column('标签', 'multi'), 'opt, ts'), ['opt', 'ts']);
	assert.equal(pastedValue(column('备注', 'text'), ''), null);
});
