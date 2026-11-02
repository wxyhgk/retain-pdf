import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { keepLastGood, lastGood } from './last-good.mjs';

test('the last good version is the commit that started, kept only when the code is as committed', async (t) => {
	const root = mkdtempSync(join(tmpdir(), 'last-good-'));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
	git('init', '-q');
	git('config', 'user.email', 'test@example.com');
	git('config', 'user.name', 'test');
	mkdirSync(join(root, 'src'));
	mkdirSync(join(root, 'blog'));
	writeFileSync(join(root, 'src', 'main.ts'), 'ok');
	git('add', '.');
	git('commit', '-qm', 'one');
	const first = await keepLastGood(root);
	assert.equal(first.commit, git('rev-parse', 'HEAD'));
	assert.deepEqual(await lastGood(root), first);

	// An article written: still the code as committed.
	writeFileSync(join(root, 'blog', 'note.md'), '# 笔记');
	assert.equal((await keepLastGood(root)).commit, first.commit);
	// The code changed and not committed: what started is not a commit; the last good one stays.
	writeFileSync(join(root, 'src', 'main.ts'), 'changed');
	assert.deepEqual(await keepLastGood(root), { commit: null, why: 'uncommitted' });
	assert.equal((await lastGood(root)).commit, first.commit);

	const outside = mkdtempSync(join(tmpdir(), 'no-git-'));
	t.after(() => rmSync(outside, { recursive: true, force: true }));
	assert.deepEqual(await keepLastGood(outside), { commit: null, why: 'no-git' });
});
