import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { AgentSessions, withContext } from './agent-sessions.mjs';

const standIn = fileURLToPath(new URL('../../../tests/e2e/fake-agents/claude-agent-acp', import.meta.url));
const agent = { id: 'claude', name: 'Claude', acp: standIn };

/** A conversation with the stand-in agent (tests/e2e/fake-agents/fake-acp.mjs), and every event it sends. */
async function conversation(t) {
	const cwd = await mkdtemp(join(tmpdir(), 'agent-sessions-'));
	const sessions = new AgentSessions({ binFolder: join(cwd, 'none'), env: process.env });
	t.after(async () => {
		sessions.closeAll();
		await rm(cwd, { recursive: true, force: true });
	});
	const session = await sessions.start({ agent, cwd, env: { PATH: process.env.PATH } });
	const events = [];
	session.subscribe((event) => events.push(event));
	/** Resolves once `test` holds of the session, checked as each event comes. */
	const until = (holds) =>
		new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error(`等不到：${holds}`)), 5000);
			const check = () => {
				if (!holds(session)) return;
				clearTimeout(timer);
				resolve();
				stop();
			};
			const stop = session.subscribe(check);
		});
	return { sessions, session, events, until };
}

test('a conversation: thinking, words, a tool call asking leave, run once allowed, its plan; the options set', async (t) => {
	const { session, events, until } = await conversation(t);
	assert.equal(session.state, 'idle');
	assert.deepEqual(session.configOptions.map((option) => [option.id, option.currentValue]), [['mode', 'default'], ['model', 'small']]);

	await session.configure('model', 'large');
	assert.equal(session.configOptions.find((option) => option.id === 'model').currentValue, 'large');

	session.prompt('跑一下');
	assert.equal(session.state, 'running');
	await until((s) => s.items.some((item) => item.kind === 'permission'));
	const asked = session.items.find((item) => item.kind === 'permission');
	assert.deepEqual(asked.options.map((option) => option.kind), ['allow_once', 'allow_always', 'reject_once']);
	session.answer(asked.id, 'yes');
	await until((s) => s.state === 'idle');

	const kinds = session.items.map((item) => item.kind);
	assert.deepEqual(kinds, ['user', 'thought', 'message', 'plan', 'tool', 'permission', 'tool', 'message']);
	assert.equal(session.items[1].text, '先看看要做什么。');
	assert.equal(session.items[2].text, '收到（模型 large）。我来运行命令。');
	const run = session.items.find((item) => item.id === 'run-1');
	assert.equal(run.status, 'completed');
	assert.equal(run.toolKind, 'execute');
	assert.equal(run.content[0].content.text, '```console\nhi\n```');
	assert.equal(session.items.find((item) => item.kind === 'permission').chosen, 'yes');
	assert.deepEqual(session.items.find((item) => item.kind === 'plan').entries.map((entry) => entry.status), ['completed', 'completed']);
	assert.equal(session.items.find((item) => item.kind === 'tool' && item.toolKind === 'edit').content[0].newText, '新的一行');
	assert.equal(session.title, '问：跑一下');
	// Words come as pieces added to their item; a follower that came late is told it all at once.
	assert.ok(events.some((event) => event.type === 'append'));
	const late = [];
	session.subscribe((event) => late.push(event));
	assert.equal(late[0].type, 'all');
	assert.deepEqual(late[0].items.map((item) => item.kind), kinds);
	// One thing at a time.
	assert.throws(() => session.answer(asked.id, 'yes'), /回答过了/u);
});

test('leave refused, a turn stopped, an agent that exits: each said', async (t) => {
	const { session, until } = await conversation(t);
	session.prompt('跑一下');
	await until((s) => s.items.some((item) => item.kind === 'permission'));
	session.answer(session.items.find((item) => item.kind === 'permission').id, 'no');
	await until((s) => s.state === 'idle');
	assert.equal(session.items.at(-1).text, '好，不运行了。');
	assert.equal(session.items.find((item) => item.id === 'run-1').status, 'failed');

	session.prompt('慢慢来');
	assert.throws(() => session.prompt('再来'), /还在做上一件事/u);
	await until((s) => s.items.some((item) => item.id === 'slow'));
	session.cancel();
	await until((s) => s.state === 'idle');
	assert.deepEqual(session.items.at(-1), { kind: 'stop', id: session.items.at(-1).id, reason: 'cancelled' });

	session.prompt('退出');
	await until((s) => s.state === 'failed');
	assert.match(session.items.at(-1).message, /Claude 停了：退出码 3/u);
	assert.throws(() => session.prompt('还在吗'), /已经结束/u);
});

test('an adapter that is not there: the conversation fails, saying so', async (t) => {
	const cwd = await mkdtemp(join(tmpdir(), 'agent-sessions-'));
	t.after(() => rm(cwd, { recursive: true, force: true }));
	const sessions = new AgentSessions({ binFolder: join(cwd, 'none') });
	await assert.rejects(sessions.start({ agent: { ...agent, acp: join(cwd, 'missing-acp') }, cwd, env: { PATH: '/usr/bin:/bin' } }), /Claude 没能启动：.*ENOENT/u);
	assert.equal(sessions.list()[0].state, 'failed');
});

test('what is said is told where the author is, marked as the Studio’s; with nothing to tell, as it was said', () => {
	assert.equal(withContext('总结一下'), '总结一下');
	const told = withContext('总结一下', {
		article: { title: '方法', path: 'method/index.md' },
		selection: { start: 12, end: 14, text: '```py\nx = 1\n```' },
		mentions: [{ title: '结果', path: 'result/index.md' }],
	});
	assert.equal(told, [
		'总结一下',
		'',
		'<studio-context>',
		'（Studio 自动附上的，说明用户现在在看什么；不是用户写的话）',
		'当前打开的文章：《方法》，文件 method/index.md',
		'选中的是这篇的第 12–14 行：',
		'````markdown',
		'```py\nx = 1\n```',
		'````',
		'用 @ 提到的文章：《结果》，文件 result/index.md',
		'</studio-context>',
	].join('\n'));
});
