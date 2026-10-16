import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { publishArticleAssets } from '../src/plugins/article-assets.mjs';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c40000000049454e44ae426082', 'hex');

function write(root: string, path: string, content: string | Buffer): void {
	mkdirSync(dirname(join(root, path)), { recursive: true });
	writeFileSync(join(root, path), content);
}

const article = (draft: boolean) => `---\ntitle: '文章'\ndescription: ''\npubDate: '2026-10-16'\ntags: []\ndraft: ${draft}\n---\n\n正文\n`;

test('only published articles have their pictures and files published; drafts and ai/ stay private', async () => {
	const blog = mkdtempSync(join(tmpdir(), 'assets-blog-'));
	const out = mkdtempSync(join(tmpdir(), 'assets-dist-'));
	write(blog, 'public-one/index.md', article(false));
	write(blog, 'public-one/img/plot.png', PNG);
	write(blog, 'public-one/assets/run.log', 'Normal termination\n');
	write(blog, 'public-one/ai/notes.md', '私下的笔记\n');
	write(blog, 'secret-draft/index.md', article(true));
	write(blog, 'secret-draft/assets/run.log', '还没发表的结果\n');
	write(blog, 'no-article/assets/run.log', '没有文章\n');

	assert.deepEqual(await publishArticleAssets(blog, out), ['public-one']);
	assert.deepEqual(readFileSync(join(out, 'article-assets/public-one/img/plot.png')), PNG);
	assert.equal(readFileSync(join(out, 'article-assets/public-one/assets/run.log'), 'utf8'), 'Normal termination\n');
	assert.equal(existsSync(join(out, 'article-assets/public-one/ai')), false);
	assert.equal(existsSync(join(out, 'article-assets/secret-draft')), false);
	assert.equal(existsSync(join(out, 'article-assets/no-article')), false);
});
