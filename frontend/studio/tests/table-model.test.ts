import assert from 'node:assert/strict';
import test from 'node:test';

import {
	DEFAULT_SETTINGS,
	groupArticles,
	knownTags,
	matchArticles,
	readSettings,
	sortArticles,
} from '../src/studio/workspace/table-model.ts';
import type { ArticleSummary } from '../src/studio/types.ts';

const articles: ArticleSummary[] = [
	{ slug: 'hf', title: 'Hartree–Fock 方程', draft: false, kind: 'post', tags: ['量子化学', 'HF'], pubDate: '2026-08-09', description: '从头推导', modified: 300 },
	{ slug: 'basis', title: '基组', draft: false, kind: 'wiki', tags: ['量子化学'], pubDate: '2026-09-01', description: '', modified: 100 },
	{ slug: 'draft-note', title: '草稿笔记', draft: true, kind: 'post', tags: [], pubDate: '', description: '还没写完', modified: 200 },
];
const slugs = (list: ArticleSummary[]) => list.map((article) => article.slug);

test('filters by status, kind and tag, and by words in the title, description, tags or folder', () => {
	assert.deepEqual(slugs(matchArticles(articles, { ...DEFAULT_SETTINGS, status: 'draft' })), ['draft-note']);
	assert.deepEqual(slugs(matchArticles(articles, { ...DEFAULT_SETTINGS, kind: 'wiki' })), ['basis']);
	assert.deepEqual(slugs(matchArticles(articles, { ...DEFAULT_SETTINGS, tag: '量子化学' })), ['hf', 'basis']);
	assert.deepEqual(slugs(matchArticles(articles, DEFAULT_SETTINGS, '推导')), ['hf']);
	assert.deepEqual(slugs(matchArticles(articles, DEFAULT_SETTINGS, 'hf  量子')), ['hf']);
	assert.deepEqual(slugs(matchArticles(articles, DEFAULT_SETTINGS, 'BASIS')), ['basis']);
	assert.deepEqual(slugs(matchArticles(articles, { ...DEFAULT_SETTINGS, status: 'published', tag: 'HF' }, '没有')), []);
});

test('sorts by any column; no date is last both ways; ties by title', () => {
	assert.deepEqual(slugs(sortArticles(articles, 'modified', true)), ['hf', 'draft-note', 'basis']);
	assert.deepEqual(slugs(sortArticles(articles, 'pubDate', false)), ['hf', 'basis', 'draft-note']);
	assert.deepEqual(slugs(sortArticles(articles, 'pubDate', true)), ['basis', 'hf', 'draft-note']);
	// Titles as Chinese sorts them: 草 (cao), 基 (ji), then Latin.
	assert.deepEqual(slugs(sortArticles(articles, 'title', false)), ['draft-note', 'basis', 'hf']);
	assert.deepEqual(slugs(sortArticles(articles, 'title', true)), ['hf', 'basis', 'draft-note']);
	assert.deepEqual(slugs(sortArticles(articles, 'status', false)), ['draft-note', 'basis', 'hf']);
	assert.deepEqual(slugs(sortArticles(articles, 'kind', true)), ['basis', 'draft-note', 'hf']);
});

test('the board’s columns, empty ones too', () => {
	assert.deepEqual(groupArticles(articles, 'status').map(({ name, articles: inside }) => [name, slugs(inside)]), [['草稿', ['draft-note']], ['已发布', ['hf', 'basis']]]);
	assert.deepEqual(groupArticles([articles[1]], 'kind').map(({ name, articles: inside }) => [name, slugs(inside)]), [['博客', []], ['维基', ['basis']]]);
});

test('tags by use; settings read back whatever was kept', () => {
	assert.deepEqual(knownTags(articles), ['量子化学', 'HF']);
	assert.deepEqual(readSettings(null), DEFAULT_SETTINGS);
	assert.deepEqual(readSettings({ layout: 'board', sort: 'nope', descending: 'yes', group: 'kind', status: 'draft', kind: 'x', tag: 'HF' }), {
		...DEFAULT_SETTINGS, layout: 'board', group: 'kind', status: 'draft', tag: 'HF',
	});
});
