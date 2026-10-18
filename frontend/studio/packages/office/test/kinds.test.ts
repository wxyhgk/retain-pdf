import assert from 'node:assert/strict';
import test from 'node:test';

import { fileSize, officeKind, tableSource } from '../kinds.mjs';

test('office files by extension, what reads as a table, sizes as people read them', () => {
	assert.equal(officeKind('assets/组会.PPTX'), 'slides');
	assert.equal(officeKind('a/b.docx'), 'document');
	assert.equal(officeKind('data.xls'), 'sheet');
	assert.equal(officeKind('old.doc'), 'old');
	assert.equal(officeKind('notes.pdf'), null);
	assert.deepEqual(tableSource('a.tsv'), { sheet: false, delimiter: '\t' });
	assert.deepEqual(tableSource('a.ods'), { sheet: true, delimiter: ',' });
	assert.equal(fileSize(512), '512 B');
	assert.equal(fileSize(5734), '5.6 KB');
	assert.equal(fileSize(1399422), '1.3 MB');
});
