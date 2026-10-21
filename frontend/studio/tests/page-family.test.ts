import assert from 'node:assert/strict';
import test from 'node:test';

import { pageFamily } from '../src/articles/page-family.mjs';
import { comparePages } from '../src/articles/page-order.mjs';

// On the blog, a page's place in the tree of pages: the pages above it (its path) and those under it.

const entry = (id: string, title: string, parent?: string) => ({ id, data: { title, parent } });

test('the pages above a page, the nearest last, and those right under it, by title', () => {
	const top = entry('project', '项目');
	const method = entry('method', '方法', 'project');
	const basis = entry('basis', '基组', 'method');
	const results = entry('results', '结果', 'project');
	const all = [top, method, basis, results];
	const { ancestors, children } = pageFamily(all, basis);
	assert.deepEqual(ancestors.map((page) => page.id), ['project', 'method']);
	assert.deepEqual(children, []);
	assert.deepEqual(pageFamily(all, top).children.map((page) => page.id), ['method', 'results']);
});

test('a page above that is not published ends the path; a loop is cut', () => {
	const basis = entry('basis', '基组', 'draft-method');
	assert.deepEqual(pageFamily([basis], basis).ancestors, []);
	const one = entry('one', '一', 'two');
	const two = entry('two', '二', 'one');
	assert.deepEqual(pageFamily([one, two], one).ancestors.map((page) => page.id), ['two']);
});

test('the pages under a page: those given an order first, by it; the rest by title, numbers read as numbers', () => {
	const pages = [
		{ title: '第10章' },
		{ title: '附录', order: 5 },
		{ title: '第2章' },
		{ title: '前言', order: 1 },
	];
	assert.deepEqual([...pages].sort(comparePages).map((page) => page.title), ['前言', '附录', '第2章', '第10章']);
	const top = { id: 'top', data: { title: '项目' } };
	const late = { id: 'late', data: { title: '甲', parent: 'top', order: 20 } };
	const early = { id: 'early', data: { title: '乙', parent: 'top', order: 10 } };
	assert.deepEqual(pageFamily([top, late, early], top).children.map((page) => page.id), ['early', 'late']);
});
