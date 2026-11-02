import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { pageVersion } from './page-version.mjs';

test('the mark changes with the open article’s files and with any article’s index.md, and only then', async (t) => {
	const blog = mkdtempSync(join(tmpdir(), 'page-version-'));
	t.after(() => rmSync(blog, { recursive: true, force: true }));
	const write = (path, text) => {
		mkdirSync(join(blog, path, '..'), { recursive: true });
		writeFileSync(join(blog, path), text);
	};
	write('water/index.md', '---\ntitle: 水\n---\n正文');
	write('water/img/a.png', 'png');
	write('other/index.md', '---\ntitle: 别的\n---\n');
	write('other/assets/run.log', 'log');

	const first = await pageVersion(blog, 'water');
	assert.match(first, /^[\w-]{22}$/u);
	assert.equal(await pageVersion(blog, 'water'), first, 'the same files, the same mark');

	// Another article's files are not on the page; its title is, in the sidebar.
	write('other/assets/run.log', 'longer log');
	assert.equal(await pageVersion(blog, 'water'), first);
	write('other/index.md', '---\ntitle: 改了\n---\n');
	const retitled = await pageVersion(blog, 'water');
	assert.notEqual(retitled, first);

	// The open article: its text, a file in a folder, a new file, a file's time alone.
	write('water/index.md', '---\ntitle: 水\n---\n正文改了');
	const edited = await pageVersion(blog, 'water');
	assert.notEqual(edited, retitled);
	write('water/img/b.png', 'png');
	const added = await pageVersion(blog, 'water');
	assert.notEqual(added, edited);
	utimesSync(join(blog, 'water/img/a.png'), new Date(2020, 0, 1), new Date(2020, 0, 1));
	assert.notEqual(await pageVersion(blog, 'water'), added);

	// A new article, and an article that is not there.
	write('third/index.md', '---\ntitle: 新\n---\n');
	assert.notEqual(await pageVersion(blog, 'other'), await pageVersion(blog, 'third'));
	assert.match(await pageVersion(blog, 'missing'), /^[\w-]{22}$/u);
});
