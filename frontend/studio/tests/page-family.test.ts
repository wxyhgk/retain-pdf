import assert from 'node:assert/strict';
import test from 'node:test';

import { pageFamily } from '../src/articles/page-family.mjs';

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
