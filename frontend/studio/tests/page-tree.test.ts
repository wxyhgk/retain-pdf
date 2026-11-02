import assert from 'node:assert/strict';
import test from 'node:test';

import { isFolded, pageTree, visibleOrder } from '../src/studio/pages/tree/page-tree.ts';
import type { ArticleSummary } from '../src/studio/types.ts';

const page = (slug: string, extra: Partial<ArticleSummary> = {}): ArticleSummary => ({ slug, title: slug, ...extra });

test('a database in the tree: its rows under it, folded till it is unfolded', () => {
	const articles = [
		page('book'),
		page('chapters', { parent: 'book', type: 'database' }),
		page('ch1', { parent: 'chapters', order: 10 }),
		page('ch2', { parent: 'chapters', order: 20 }),
		page('preface', { parent: 'book' }),
	];
	const tree = pageTree(articles);
	assert.deepEqual(tree.children.get('book')?.map((each) => each.slug), ['chapters', 'preface']);
	assert.deepEqual(tree.children.get('chapters')?.map((each) => each.slug), ['ch1', 'ch2']);
	// Its rows shown only when it is unfolded; a page's, till it is folded.
	assert.deepEqual(visibleOrder(tree, new Set()), ['book', 'chapters', 'preface']);
	assert.deepEqual(visibleOrder(tree, new Set(), new Set(['chapters'])), ['book', 'chapters', 'ch1', 'ch2', 'preface']);
	assert.deepEqual(visibleOrder(tree, new Set(['book']), new Set(['chapters'])), ['book']);
	assert.equal(isFolded(articles[1]!, new Set(), new Set()), true);
	assert.equal(isFolded(articles[0]!, new Set(), new Set()), false);
});
