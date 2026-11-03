import assert from 'node:assert/strict';
import test from 'node:test';

import { createArticleSource, localDay } from './schemas.mjs';

test('a new page is dated by the day where the Studio runs, not UTC’s, and holds no text of its own', () => {
	// 7 in the morning in China is still yesterday in UTC.
	const morning = new Date(2026, 10, 2, 7, 30);
	assert.equal(localDay(morning), '2026-11-02');
	const source = createArticleSource({ title: '日志', date: morning });
	assert.match(source, /\npubDate: '2026-11-02'\n/u);
	assert.match(source, /\n---\n\n$/u);
	assert.match(createArticleSource({ title: '子页', body: '一节正文' }), /\n---\n\n一节正文\n$/u);
});
