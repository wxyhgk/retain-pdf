import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { articleGuard } from './article-guard.mjs';

const PAGE = "---\ntitle: '过渡态'\ndraft: true\n---\n\n正文第一段，title 这个词在正文里。\n\n第二段。\n";

async function blog(t) {
	const root = await mkdtemp(join(tmpdir(), 'studio-article-guard-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	await mkdir(join(root, 'blog', 'ts'), { recursive: true });
	await writeFile(join(root, 'blog', 'ts', 'index.md'), PAGE);
	return join(root, 'blog');
}

test('an article’s text edited by an AI’s file tool as any file; its properties, a write over it, a page written by hand refused', async (t) => {
	const cwd = await blog(t);
	const guard = articleGuard();
	const edit = (oldText, id = 'e1') => guard.before({ toolName: 'edit', toolCallId: id, input: { path: 'ts/index.md', edits: [{ oldText, newText: 'x' }] } }, cwd);
	assert.equal(edit('第二段。'), undefined);
	// Words that are in its text too, but also in its properties: refused (where it would change is not sure).
	assert.match(edit('title').reason, /studio update-page --slug ts/u);
	assert.match(edit("title: '过渡态'").reason, /属性里/u);
	assert.match(guard.before({ toolName: 'write', toolCallId: 'w', input: { path: join(cwd, 'ts', 'index.md') } }, cwd).reason, /update-page/u);
	assert.match(guard.before({ toolName: 'write', toolCallId: 'w2', input: { path: 'new-page/index.md' } }, cwd).reason, /create-page/u);
	// Its other files, other tools: let be.
	assert.equal(guard.before({ toolName: 'write', toolCallId: 'w3', input: { path: 'ts/img/plot.py' } }, cwd), undefined);
	assert.equal(guard.before({ toolName: 'read', toolCallId: 'r', input: { path: 'ts/index.md' } }, cwd), undefined);
	assert.equal(guard.before({ toolName: 'edit', toolCallId: 'o', input: { path: '/elsewhere/x/index.md', edits: [{ oldText: 'title', newText: '' }] } }, cwd), undefined);
});

test('an edit that left the properties unreadable put back as it was, the AI told; one that did not, let be', async (t) => {
	const cwd = await blog(t);
	const file = join(cwd, 'ts', 'index.md');
	const guard = articleGuard();
	assert.equal(guard.before({ toolName: 'edit', toolCallId: 'a', input: { path: 'ts/index.md', edits: [{ oldText: '第二段。', newText: '改过的第二段。' }] } }, cwd), undefined);
	await writeFile(file, PAGE.replace('第二段。', '改过的第二段。'));
	assert.equal(guard.after({ toolCallId: 'a', isError: false }), undefined);
	assert.match(await readFile(file, 'utf8'), /改过的第二段/u);
	// Broken after all (the edit tool matched loosely, into the properties).
	const before = await readFile(file, 'utf8');
	guard.before({ toolName: 'edit', toolCallId: 'b', input: { path: 'ts/index.md', edits: [{ oldText: '正文第一段', newText: 'x' }] } }, cwd);
	await writeFile(file, before.replace("title: '过渡态'", "title: '过渡态\n  : ["));
	const said = guard.after({ toolCallId: 'b', isError: false });
	assert.equal(said.isError, true);
	assert.match(said.content[0].text, /恢复/u);
	assert.equal(await readFile(file, 'utf8'), before);
});
