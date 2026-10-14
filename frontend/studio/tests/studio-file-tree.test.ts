import assert from 'node:assert/strict';
import test from 'node:test';

import { referencedPaths } from '../src/studio/shared/article-references.mjs';
import type { ArticleFileEntry } from '../src/studio/types.ts';
import {
	buildFileTree,
	formatSize,
	isUnused,
	markdownReference,
	referenceCount,
	uploadFolderFor,
	visibleNodes,
} from '../src/studio/workspace/file-tree.ts';

const file = (path: string): ArticleFileEntry => ({ path, kind: 'file', size: 1, modified: 0 });
const folder = (path: string, locked = false): ArticleFileEntry => ({ path, kind: 'directory', modified: 0, ...(locked ? { locked } : {}) });

// As the server sorts them: path by path.
const entries: ArticleFileEntry[] = [
	folder('ai', true),
	{ ...file('article.config.yaml'), locked: true },
	{ ...file('article.views.json'), locked: true },
	folder('assets', true),
	file('assets/a.cube'),
	folder('assets/frames'),
	file('assets/frames/10.xyz'),
	file('assets/frames/2.xyz'),
	file('assets/frames-2.xyz'),
	folder('img', true),
	file('img/plot.png'),
	{ ...file('index.md'), locked: true },
];

test('the tree puts the article first and folders before files', () => {
	const tree = buildFileTree(entries);
	assert.deepEqual(tree.map((node) => node.name), ['index.md', 'img', 'assets', 'ai', 'article.config.yaml', 'article.views.json']);
	const rows = visibleNodes(tree, new Set(['assets', 'assets/frames']));
	assert.deepEqual(rows.map((node) => `${'  '.repeat(node.depth)}${node.name}`), [
		'index.md',
		'img',
		'assets',
		'  frames',
		'    2.xyz',
		'    10.xyz',
		'  a.cube',
		'  frames-2.xyz',
		'ai',
		'article.config.yaml',
		'article.views.json',
	]);
});

test('uploads land in the folder they are dropped on, or by kind', () => {
	const png = { name: 'Screen Shot.PNG' };
	const cube = { name: 'homo.cube' };
	assert.equal(uploadFolderFor(folder('assets/frames'), png), 'assets/frames');
	assert.equal(uploadFolderFor(file('assets/frames/2.xyz'), png), 'assets/frames');
	assert.equal(uploadFolderFor(file('index.md'), png), 'img');
	assert.equal(uploadFolderFor(null, png), 'img');
	assert.equal(uploadFolderFor(null, cube), 'assets');
});

test('only published files nothing points at are unused', () => {
	const referenced = referencedPaths('![a](./img/plot.png)\n\n```cube\n@file ./assets/a.cube\n```\n');
	assert.equal(isUnused(file('img/plot.png'), referenced), false);
	assert.equal(isUnused(file('assets/a.cube'), referenced), false);
	assert.equal(isUnused(file('assets/frames/2.xyz'), referenced), true);
	assert.equal(isUnused(file('ai/notes.md'), referenced), false);
	assert.equal(isUnused(file('index.md'), referenced), false);
	assert.equal(isUnused(folder('assets/frames'), referenced), false);
});

test('a folder counts the references to everything inside it', () => {
	const source = '![a](./img/a.png) ![b](img/sub/b.png) [c](./img/sub/b.png#x) ![d](./img2/d.png)\n';
	assert.equal(referenceCount(source, 'img/a.png'), 1);
	assert.equal(referenceCount(source, 'img/sub'), 2);
	assert.equal(referenceCount(source, 'img'), 3);
});

test('each kind of file is pasted the way the article uses it', () => {
	assert.equal(markdownReference('img/水分子 (1).png'), '![水分子 (1)](./img/%E6%B0%B4%E5%88%86%E5%AD%90%20(1).png)');
	assert.equal(markdownReference('assets/orbitals/homo.cube'), '```cube\n@file ./assets/orbitals/homo.cube\n```');
	assert.equal(markdownReference('assets/run.log'), '[run.log](./assets/run.log)');
	assert.equal(markdownReference('assets/[draft].csv'), '[\\[draft\\].csv](./assets/[draft].csv)');
	assert.equal(markdownReference('ai/notes.md'), null);
	assert.deepEqual([...referencedPaths(markdownReference('img/水分子 (1).png')!)], ['img/水分子 (1).png']);
});

test('sizes read like a file manager’s', () => {
	assert.equal(formatSize(512), '512 B');
	assert.equal(formatSize(1536), '1.5 KB');
	assert.equal(formatSize(200 * 1024), '200 KB');
	assert.equal(formatSize(3.25 * 1024 * 1024), '3.3 MB');
});
