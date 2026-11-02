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

test('Alt+Enter: the AI is told where the line is and what it says, not the article; it runs in the article’s folder', async (t) => {
	const { instructionPrompt, startInstruction } = await import('../ai/instructions.mjs');
	const { AgentSettings } = await import('../ai/agent-settings.mjs');
	const prompt = instructionPrompt({ text: '画一个 sin x 的图', start: 12, end: 12, heading: '3.2 势能面' });
	assert.match(prompt, /index\.md 第 12 行（「3\.2 势能面」这一节）/u);
	assert.match(prompt, /画一个 sin x 的图/u);
	assert.match(prompt, /ai\/work\/log\.md/u);

	const root = await mkdtemp(join(tmpdir(), 'studio-instruct-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { writeFile, chmod } = await import('node:fs/promises');
	// A stand-in that says where it ran, whether it goes on from before, and what it was told.
	await writeFile(join(root, 'agent'), '#!/bin/sh\necho "in $(basename "$PWD") for $STUDIO_ARTICLE"\nfor a in "$@"; do echo "arg:$a"; done\n');
	await chmod(join(root, 'agent'), 0o755);
	const folder = join(root, 'note');
	await (await import('node:fs/promises')).mkdir(folder);
	const settings = new AgentSettings(join(root, 'settings.json'), { env: { PATH: '/usr/bin:/bin' }, shell: '/bin/sh' });
	await settings.set({ list: [{ id: 'stand-in', name: '替身', launch: `${root}/agent`, run: `${root}/agent {prompt}`, resume: `${root}/agent --continue {prompt}` }], default: 'stand-in' });
	const tasks = new Tasks();
	const line = { text: '画一个 sin x 的图', start: 3, end: 3, heading: '' };
	// The first in the folder: nothing to go on from.
	const first = await over(tasks, (await startInstruction({ tasks, agents: settings, slug: 'note', folder, env: { STUDIO_ARTICLE: 'note' }, line })).id);
	assert.equal(first.state, 'done', first.error ?? '');
	assert.equal(first.title, '替身：画一个 sin x 的图');
	assert.match(first.log, /^in note for note\narg:作者在这篇文章的 index\.md 第 3 行/u);
	// Work done here before (its log): it goes on from there, unless told to start anew.
	await (await import('node:fs/promises')).mkdir(join(folder, 'ai', 'work'), { recursive: true });
	await writeFile(join(folder, 'ai', 'work', 'log.md'), '- 2026-10-25 画图\n');
	const done = await over(tasks, (await startInstruction({ tasks, agents: settings, slug: 'note', folder, env: {}, line })).id);
	assert.match(done.log, /^in note for \narg:--continue\narg:作者在这篇文章的 index\.md 第 3 行/u);
	const fresh = await over(tasks, (await startInstruction({ tasks, agents: settings, slug: 'note', folder, env: {}, line, fresh: true })).id);
	assert.doesNotMatch(fresh.log, /--continue/u);
	await assert.rejects(startInstruction({ tasks, agents: settings, slug: 'note', folder, env: {}, line: { ...line, text: '  ' } }), /空/u);
	await assert.rejects(startInstruction({ tasks, agents: settings, slug: 'note', folder, env: {}, line: { ...line, text: '长'.repeat(30_001) } }), /太长/u);
});

test('Alt+Enter twice in one article: the second waits for the first, and can be cancelled while it waits', async (t) => {
	const { startInstruction } = await import('../ai/instructions.mjs');
	const { AgentSettings } = await import('../ai/agent-settings.mjs');
	const { writeFile, chmod, mkdir } = await import('node:fs/promises');
	const root = await mkdtemp(join(tmpdir(), 'studio-instruct-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	// Says so when another is running beside it.
	await writeFile(join(root, 'agent'), `#!/bin/sh\n[ -e '${root}/running' ] && echo overlap\ntouch '${root}/running'; sleep 0.3; rm '${root}/running'; echo ran\n`);
	await chmod(join(root, 'agent'), 0o755);
	const folder = join(root, 'note');
	await mkdir(folder);
	const settings = new AgentSettings(join(root, 'settings.json'), { env: { PATH: '/usr/bin:/bin' }, shell: '/bin/sh' });
	await settings.set({ list: [{ id: 'stand-in', name: '替身', launch: `${root}/agent`, run: `${root}/agent {prompt}`, resume: `${root}/agent {prompt}` }], default: 'stand-in' });
	const tasks = new Tasks();
	const line = { text: '算一下', start: 1, end: 1, heading: '' };
	const one = await startInstruction({ tasks, agents: settings, slug: 'note', folder, env: {}, line });
	const two = await startInstruction({ tasks, agents: settings, slug: 'note', folder, env: {}, line });
	const three = await startInstruction({ tasks, agents: settings, slug: 'note', folder, env: {}, line });
	tasks.cancel(three.id);
	const [first, second, third] = await Promise.all([over(tasks, one.id), over(tasks, two.id), over(tasks, three.id)]);
	assert.equal(third.state, 'cancelled');
	assert.match(second.log, /^这篇文章里还有一件事在做/u);
	assert.equal(first.log, 'ran\n');
	assert.match(second.log, /\nran\n$/u);
	assert.doesNotMatch(second.log, /overlap/u);
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
