import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { childPi, subagentsSaid } from './pi-agent.mjs';
import studioGuard from './pi-child-guard.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../../../..');

test('pi in the Studio’s server: pi started again by its extensions is pi-child.mjs, handed the AIs’ environment without the keys', () => {
	const [argv, handed] = [process.argv[1], process.env.STUDIO_PI_CHILD_ENV];
	try {
		childPi({ ...process.env, DEEPSEEK_API_KEY: 'sk-secret', STUDIO_NOTES_DIR: '/notes', GIT_CONFIG_COUNT: '9' });
		assert.match(process.argv[1], /pi-child\.mjs$/u);
		const env = JSON.parse(process.env.STUDIO_PI_CHILD_ENV);
		assert.deepEqual(env, { STUDIO_NOTES_DIR: '/notes', GIT_CONFIG_COUNT: '9' });
	} finally {
		process.argv[1] = argv;
		if (handed === undefined) delete process.env.STUDIO_PI_CHILD_ENV;
		else process.env.STUDIO_PI_CHILD_ENV = handed;
	}
});

test('a subagent’s shell commands: what may not be done, and what the author would be asked first, refused; the rest let be', () => {
	let hook = null;
	studioGuard({ on: (name, listener) => name === 'tool_call' && (hook = listener) });
	const run = (command) => hook({ toolName: 'bash', input: { command } }, { cwd: tmpdir() });
	assert.equal(run('ls -la'), undefined);
	assert.equal(hook({ toolName: 'read', input: { path: 'a' } }, {}), undefined);
	assert.equal(run('git push origin main').block, true);
	const asked = run('rm -r ~/Documents/notes');
	assert.equal(asked.block, true);
	assert.match(asked.reason, /子代理不能问作者/u);
	// An article's text: through the `studio` command, not its file tools.
	assert.match(hook({ toolName: 'edit', input: { path: '/notes/blog/hf/index.md' } }, { cwd: tmpdir() }).reason, /studio edit-page/u);
});

test('the Studio’s server started with pi’s options is pi, never a second Studio', async (t) => {
	const blog = await mkdtemp(join(tmpdir(), 'studio-pi-child-'));
	t.after(() => rm(blog, { recursive: true, force: true }));
	const out = await new Promise((done, fail) => {
		execFile(process.execPath, [join(ROOT, 'src/studio/serve.mjs'), '--mode', 'json', '--version'], { cwd: blog, env: { ...process.env, STUDIO_BLOG_DIR: blog, PI_OFFLINE: '1' }, timeout: 60_000 }, (error, stdout, stderr) => (error ? fail(new Error(`${error.message}\n${stderr}`)) : done(`${stdout}${stderr}`)));
	});
	assert.match(out, /\d+\.\d+\.\d+/u);
	assert.doesNotMatch(out, /Studio: http/u);
});

test('the subagents there are, said to pi by name (its tool names none)', async (t) => {
	const dir = await mkdtemp(join(tmpdir(), 'studio-pi-agents-'));
	t.after(() => rm(dir, { recursive: true, force: true }));
	assert.equal(subagentsSaid(dir), '');
	await mkdir(join(dir, 'agents'));
	await writeFile(join(dir, 'agents', 'worker.md'), '---\nname: worker\ndescription: General-purpose subagent\n---\nYou work.\n');
	await writeFile(join(dir, 'agents', 'scout.md'), '---\nname: scout\n---\n');
	assert.match(subagentsSaid(dir), /worker（General-purpose subagent）/u);
	assert.match(subagentsSaid(dir), /scout/u);
});
