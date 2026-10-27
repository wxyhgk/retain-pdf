import assert from 'node:assert/strict';
import test from 'node:test';

import { SELECTION_END, SELECTION_START, sourceLinesOf } from '@blog/document/source-lines.ts';

const SOURCE = [
	'---',
	"title: '笔记'",
	'---',
	'',
	'第一段。',
	'',
	'- 甲',
	'- 乙',
	'',
	'$$',
	'E = mc^2',
	'$$',
	'',
	'<details>',
	'<summary>推导</summary>',
	'',
	'藏起来的。',
	'',
	'</details>',
	'',
	'最后一段。',
	'',
].join('\n');

/** The editor's body with the marks around the blocks numbered `from`…`to` (0-based) of these. */
function marked(blocks: string[], from: number, to: number): string {
	const out = [...blocks];
	out.splice(to + 1, 0, SELECTION_END);
	out.splice(from, 0, SELECTION_START);
	return `${out.join('\n\n')}\n`;
}

// As the editor writes the body: its own way, a toggle as one block.
const EDITOR = ['第一段。', '* 甲\n* 乙', '$$\nE = mc^2\n$$', '<details>\n<summary>推导</summary>\n\n藏起来的。\n\n</details>', '最后一段。'];

test('a block maps to its lines in the file, properties counted', () => {
	assert.deepEqual(sourceLinesOf(SOURCE, marked(EDITOR, 0, 0)), { start: 5, end: 5, text: '第一段。' });
	assert.deepEqual(sourceLinesOf(SOURCE, marked(EDITOR, 1, 2)), { start: 7, end: 12, text: '- 甲\n- 乙\n\n$$\nE = mc^2\n$$' });
});

test('a toggle, one block in the editor and several in the file, maps to all its lines', () => {
	const lines = sourceLinesOf(SOURCE, marked(EDITOR, 3, 3));
	assert.equal(lines?.start, 14);
	assert.equal(lines?.end, 19);
	assert.equal(sourceLinesOf(SOURCE, marked(EDITOR, 4, 4))?.start, 21);
});

test('without the marks, nothing is told', () => {
	assert.equal(sourceLinesOf(SOURCE, `${EDITOR.join('\n\n')}\n`), null);
});
