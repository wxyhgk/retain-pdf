import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { Tasks, commandWords, loginShell, runProgram, stopAllPrograms } from './tasks.mjs';

const over = (tasks, id) => new Promise((resolve) => {
	const check = () => (tasks.get(id).state !== 'running' ? resolve(tasks.get(id)) : setTimeout(check, 10));
	check();
});

test('a task runs a program, its output in its log and to who follows it; what it returns is its result', async (t) => {
	const folder = await mkdtemp(join(tmpdir(), 'studio-tasks-'));
	t.after(() => rm(folder, { recursive: true, force: true }));
	const tasks = new Tasks();
	const events = [];
	tasks.subscribe((event) => events.push(event));
	const task = tasks.start({ kind: 'test', title: '写一个文件', slug: 'note' }, async ({ log, signal }) => {
		// The words reach the program as they are: nothing in them is run.
		await runProgram(['/bin/sh', '-c', 'printf "%s|" "$@"; echo; printf done > out.txt', 'sh', 'a b', '$(echo no)', '"quoted"'], { cwd: folder, log, signal, shell: '/bin/sh' });
		return { file: 'out.txt' };
	});
	const done = await over(tasks, task.id);
	assert.equal(done.state, 'done');
	assert.equal(done.log, 'a b|$(echo no)|"quoted"|\n');
	assert.deepEqual(done.result, { file: 'out.txt' });
	assert.equal(await readFile(join(folder, 'out.txt'), 'utf8'), 'done');
	assert.deepEqual(events.map((event) => (event.type === 'task' ? event.task.state : 'log')), ['running', 'log', 'done']);
	assert.equal(tasks.list()[0].id, task.id);
	assert.equal('log' in tasks.list()[0], false);
});

test('a task cancelled stops what it runs; one that fails says why', async () => {
	const tasks = new Tasks();
	const long = tasks.start({ kind: 'test', title: '很久' }, ({ log, signal }) => runProgram(['/bin/sh', '-c', 'echo started; sleep 30'], { cwd: tmpdir(), log, signal, shell: '/bin/sh' }));
	while (!tasks.get(long.id).log) await new Promise((resolve) => setTimeout(resolve, 10));
	const at = Date.now();
	assert.equal(tasks.cancel(long.id), true);
	assert.equal((await over(tasks, long.id)).state, 'cancelled');
	assert.ok(Date.now() - at < 5000);
	assert.equal(tasks.cancel(long.id), false);

	const failing = tasks.start({ kind: 'test', title: '出错' }, ({ log, signal }) => runProgram(['/bin/sh', '-c', 'echo oops >&2; exit 3'], { cwd: tmpdir(), log, signal, shell: '/bin/sh' }));
	const failed = await over(tasks, failing.id);
	assert.equal(failed.state, 'failed');
	assert.equal(failed.error, '退出码 3');
	assert.equal(failed.log, 'oops\n');
});

test('a command line is split as a shell would, nothing in it run', () => {
	assert.deepEqual(commandWords(`claude -p --settings '{"sandbox":{"enabled":true}}' {prompt}`), ['claude', '-p', '--settings', '{"sandbox":{"enabled":true}}', '{prompt}']);
	assert.deepEqual(commandWords('codex exec -c sandbox_mode="workspace-write" "a \\"b\\"" c\\ d'), ['codex', 'exec', '-c', 'sandbox_mode=workspace-write', 'a "b"', 'c d']);
	assert.deepEqual(commandWords("''"), ['']);
	// In double quotes a backslash escapes only what sh says; a full-width space is a character, not a gap.
	assert.deepEqual(commandWords('run "C:\\x" "\\$HOME" 甲\u3000乙'), ['run', 'C:\\x', '$HOME', '甲\u3000乙']);
	assert.throws(() => commandWords('pi "open'), /引号/u);
});

test('a program that will not stop is killed after a while; all of them end with the server', async () => {
	const tasks = new Tasks();
	const stubborn = tasks.start({ kind: 'test', title: '不肯停' }, ({ log, signal }) =>
		runProgram(['/bin/sh', '-c', "trap '' TERM; echo started; sleep 30"], { cwd: tmpdir(), log, signal, shell: '/bin/sh', grace: 200 }),
	);
	while (!tasks.get(stubborn.id).log) await new Promise((resolve) => setTimeout(resolve, 10));
	const at = Date.now();
	tasks.cancel(stubborn.id);
	assert.equal((await over(tasks, stubborn.id)).state, 'cancelled');
	assert.ok(Date.now() - at < 3000);

	const left = tasks.start({ kind: 'test', title: '还在跑' }, ({ log, signal }) => runProgram(['/bin/sh', '-c', 'echo started; sleep 30'], { cwd: tmpdir(), log, signal, shell: '/bin/sh' }));
	while (!tasks.get(left.id).log) await new Promise((resolve) => setTimeout(resolve, 10));
	stopAllPrograms();
	const ended = await over(tasks, left.id);
	assert.equal(ended.state, 'failed');
	assert.match(ended.error, /SIGTERM/u);
	// A shell that runs no `exec "$@"` (fish) has sh start programs.
	assert.equal(loginShell('/opt/homebrew/bin/fish'), '/bin/sh');
	assert.equal(loginShell('/bin/zsh'), '/bin/zsh');
});
