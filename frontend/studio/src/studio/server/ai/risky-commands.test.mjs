import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { articleWriteOf, noPushEnv, riskOf } from './risky-commands.mjs';

const cwd = '/notes/blog';

test('a push is refused, however it is written', () => {
	for (const command of ['git push', 'git push origin main', 'cd .. && git -C apps/x push --force', 'echo hi; /usr/bin/git push', 'GIT_TRACE=1 git push']) {
		assert.equal(riskOf(command, cwd)?.refuse, true, command);
	}
	assert.equal(riskOf('git commit -m "push it"', cwd), null);
	assert.equal(riskOf('git log --oneline | grep push', cwd), null);
});

test('what loses work or stops the Studio is asked about; the everyday is not', () => {
	const asked = ['rm -rf old', 'rm -r ../apps/scf-opt', 'git reset --hard HEAD~1', 'git clean -fd', 'git checkout -- .', 'git restore .', 'git stash drop', 'pkill -f node', 'kill 4321', 'npm run dev', 'nohup npm run dev --port 4311 &', 'npx astro dev', 'node src/studio/serve.mjs', 'npm run studio:serve'];
	for (const command of asked) assert.equal(riskOf(command, cwd)?.refuse, false, command);
	const left = ['rm old.png', 'rm -f a.tmp', 'rm -rf /tmp/studio-x', 'rm -rf "$TMPDIR/shots"', `rm -rf ${join(tmpdir(), 'x')}`, 'git reset --soft HEAD~1', 'git status', 'git checkout -b x', 'npm run build', 'ls -la', 'grep -rn kill src', 'echo "rm -rf /"'];
	for (const command of left) assert.equal(riskOf(command, cwd), null, command);
	// The temporary folders themselves are not.
	assert.equal(riskOf('rm -rf /tmp', cwd)?.refuse, false);
});

test('in an AI’s environment git pushes nowhere, and still fetches', (t) => {
	const root = mkdtempSync(join(tmpdir(), 'studio-no-push-'));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const git = (args, options = {}) => execFileSync('git', args, { cwd: join(root, 'work'), stdio: 'pipe', encoding: 'utf8', ...options });
	execFileSync('git', ['init', '-q', '--bare', join(root, 'remote.git')]);
	execFileSync('git', ['init', '-q', join(root, 'work')]);
	git(['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '--allow-empty', '-m', 'x']);
	git(['remote', 'add', 'origin', join(root, 'remote.git')]);
	const env = { ...process.env, ...noPushEnv(), PATH: `${resolve('bin')}:${process.env.PATH}` };
	assert.throws(() => git(['push', 'origin', 'HEAD:main'], { env }), (error) => /不能推送：Studio 里的 AI 可以提交，不推送/u.test(String(error.stderr)));
	git(['fetch', 'origin'], { env });
	// Its own settings (GIT_CONFIG_COUNT) kept.
	assert.equal(noPushEnv({ GIT_CONFIG_COUNT: '2' }).GIT_CONFIG_KEY_2, 'url.studio-ai-may-not-push::.pushInsteadOf');
	git(['push', '-q', 'origin', 'HEAD:main']);
});

test('an article’s text written by an AI’s file tools is refused (through studio edit-page instead); other files, other tools let be', () => {
	assert.match(articleWriteOf('edit', { path: 'hf-start/index.md' }, cwd), /studio edit-page --slug hf-start/u);
	assert.match(articleWriteOf('write', { path: '/notes/blog/new-page/index.md' }, '/elsewhere'), /studio create-page/u);
	assert.match(articleWriteOf('edit', { file_path: '/notes/blog/hf-start/index.md' }, '/notes/blog/hf-start'), /edit-page/u);
	assert.equal(articleWriteOf('edit', { path: 'hf-start/img/plot.py' }, cwd), null);
	assert.equal(articleWriteOf('write', { path: 'hf-start/ai/work/log.md' }, cwd), null);
	assert.equal(articleWriteOf('read', { path: 'hf-start/index.md' }, cwd), null);
	assert.equal(articleWriteOf('edit', { path: '/somewhere/else/x/index.md' }, cwd), null);
});

