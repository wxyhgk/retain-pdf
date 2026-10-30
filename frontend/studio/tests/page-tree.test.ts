import assert from 'node:assert/strict';
import test from 'node:test';

import { pageTree, visibleOrder } from '../src/studio/pages/tree/page-tree.ts';
import type { ArticleSummary } from '../src/studio/types.ts';

const page = (slug: string, extra: Partial<ArticleSummary> = {}): ArticleSummary => ({ slug, title: slug, ...extra });

test('the rows of a page’s databases under them in the tree, not among its pages; a row of no database there, a page', () => {
	const articles = [
		page('book', { databases: [{ id: 'chapters', title: '各章' }, { id: null, title: '旧的' }] }),
		page('ch1', { parent: 'book', database: 'chapters', order: 10 }),
		page('ch2', { parent: 'book', database: 'chapters', order: 20 }),
		page('preface', { parent: 'book' }),
		// Says a database the page does not have (taken away): a page under it.
		page('stray', { parent: 'book', database: 'gone' }),
	];
	const tree = pageTree(articles);
	assert.deepEqual(tree.children.get('book')?.map((each) => each.slug), ['preface', 'stray']);
	const [table] = tree.tables.get('book')!;
	assert.deepEqual({ key: table!.key, title: table!.title, rows: table!.rows.map((each) => each.slug) }, { key: 'book#chapters', title: '各章', rows: ['ch1', 'ch2'] });
	assert.equal(tree.tables.get('book')!.length, 1);
	// Its rows shown only when it is opened.
	assert.deepEqual(visibleOrder(tree, new Set()), ['book', 'preface', 'stray']);
	assert.deepEqual(visibleOrder(tree, new Set(), new Set(['book#chapters'])), ['book', 'preface', 'stray', 'ch1', 'ch2']);
	assert.deepEqual(visibleOrder(tree, new Set(['book']), new Set(['book#chapters'])), ['book']);
});
