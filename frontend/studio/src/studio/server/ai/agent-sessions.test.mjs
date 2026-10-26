import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { AgentSessions, withContext } from './agent-sessions.mjs';
import { ChatStore } from './chat-store.mjs';

const standIn = fileURLToPath(new URL('../../../../tests/e2e/fake-agents/claude-agent-acp', import.meta.url));
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
	// Never spoken to: not in the list.
	assert.deepEqual(await sessions.list(), []);
});

/** Resolves once `holds` of `session`, checked as each event comes. */
function until(session, holds) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`等不到：${holds}`)), 5000);
		const stop = session.subscribe(() => {
			if (!holds(session)) return;
			clearTimeout(timer);
			resolve();
			queueMicrotask(() => stop());
		});
	});
}

test('kept in chats/ as a page; read back after the Studio restarts, as it was; gone on with, its agent’s session loaded again', async (t) => {
	const cwd = await realpath(await mkdtemp(join(tmpdir(), 'agent-sessions-')));
	t.after(() => rm(cwd, { recursive: true, force: true }));
	const store = new ChatStore(join(cwd, 'chats'));
	const restarted = () => {
		const sessions = new AgentSessions({ binFolder: join(cwd, 'none'), env: process.env, store });
		t.after(() => sessions.closeAll());
		return sessions;
	};
	const env = { PATH: process.env.PATH };

	const first = restarted();
	const said = await first.start({ agent, cwd, env });
	assert.match(said.id, /^chat-\d{8}-\d{6}$/u);
	// Begun, not spoken to: nothing kept.
	assert.deepEqual(await store.list(), []);
	said.prompt('几块');
	await until(said, (s) => s.state === 'idle');
	const adapterSession = `fake-session-`;
	// The server stopping: what changed last written at once.
	first.closeAll();
	const page = await readFile(join(cwd, 'chats', said.id, 'index.md'), 'utf8');
	assert.match(page, /^---\ntitle: "几块"\npubDate: \d{4}-\d\d-\d\d\ndraft: true\n---\n\n```ask\n几块\n```\n\n能量和质量的关系：\n\n\$\$\nE = mc\^2\n\$\$\n\n- 要点一\n- 要点二\n$/u);
	// The page is the author's to edit: a turn after is added at its end, the edit kept.
	await writeFile(join(cwd, 'chats', said.id, 'index.md'), page.replace('- 要点一', '- 我改的要点'));

	// After a restart: listed, read back as it was, no agent running.
	const second = restarted();
	const listed = await second.list();
	assert.deepEqual(listed.map((entry) => [entry.id, entry.state, entry.title]), [[said.id, 'saved', '几块']]);
	const back = await second.find(said.id);
	assert.equal(back.state, 'saved');
	assert.deepEqual(back.items.map((item) => item.kind), ['user', 'message']);
	// Spoken to: its session of before loaded again, what the adapter tells again of it not added.
	await second.wake(back, { agent, env });
	assert.equal(back.state, 'idle');
	back.prompt('接上了吗');
	await until(back, (s) => s.state === 'idle');
	assert.match(back.items.at(-1).text, new RegExp(`^接上了 ${adapterSession}\\d+$`, 'u'));
	assert.equal(back.items.some((item) => item.text?.includes('重放的历史')), false);
	assert.deepEqual(back.items.map((item) => item.kind), ['user', 'message', 'user', 'message']);
	await until(back, (s) => s.pageThrough === s.items.at(-1).id);
	assert.match(await readFile(join(cwd, 'chats', said.id, 'index.md'), 'utf8'), /\n- 我改的要点\n- 要点二\n\n```ask\n接上了吗\n```\n\n接上了 fake-session-\d+\n$/u);
	second.closeAll();

	// Its session not there any more: a new one, told where what was said is.
	const record = JSON.parse(await readFile(join(cwd, 'chats', said.id, 'ai', 'conversation.json'), 'utf8'));
	await writeFile(join(cwd, 'chats', said.id, 'ai', 'conversation.json'), JSON.stringify({ ...record, acpSessionId: 'gone' }));
	const third = restarted();
	const forgot = await third.wake(await third.find(said.id), { agent, env });
	forgot.prompt('上下文');
	await until(forgot, (s) => s.state === 'idle');
	assert.match(forgot.items.at(-1).text, new RegExp(`之前说过的话记在 chats/${said.id}/index\\.md，需要时去读`, 'u'));
	// Told once: what is said next is as it is.
	forgot.prompt('上下文 再说');
	await until(forgot, (s) => s.state === 'idle');
	assert.doesNotMatch(forgot.items.at(-1).text, /之前说过的话/u);

	// Gone: its folder too.
	await third.remove(said.id);
	await assert.rejects(stat(join(cwd, 'chats', said.id)), /ENOENT/u);
	assert.deepEqual(await third.list(), []);
});

test('what is said is told where the author is, marked as the Studio’s; with nothing to tell, as it was said', () => {
	assert.equal(withContext('总结一下'), '总结一下');
	const told = withContext('总结一下', {
		article: { title: '方法', path: 'method/index.md', brief: 'method/ai/brief.md' },
		selection: { start: 12, end: 14, text: '```py\nx = 1\n```' },
		mentions: [{ title: '结果', path: 'result/index.md', brief: null }],
	});
	assert.equal(told, [
		'总结一下',
		'',
		'<studio-context>',
		'（Studio 自动附上的，说明用户现在在看什么；不是用户写的话）',
		'当前打开的文章：《方法》，文件 method/index.md；它的写作要求在 method/ai/brief.md，先读',
		'选中的是这篇的第 12–14 行：',
		'````markdown',
		'```py\nx = 1\n```',
		'````',
		'用 @ 提到的文章：《结果》，文件 result/index.md（没有 ai/brief.md，不用找）',
		'回答里说到这些或别的文章时，写出标题并用《》括起来：Studio 会把它变成能点开的链接',
		'</studio-context>',
	].join('\n'));
});

test('one made ready is taken by the next begun with the same (no adapter started then); the idle beyond the latest few are put to sleep, woken when spoken to', async (t) => {
	const cwd = await realpath(await mkdtemp(join(tmpdir(), 'agent-sessions-')));
	t.after(() => rm(cwd, { recursive: true, force: true }));
	const log = join(cwd, 'adapters.log');
	const started = async () => (await readFile(log, 'utf8').catch(() => '')).trim().split('\n').filter(Boolean).length;
	const sessions = new AgentSessions({ binFolder: join(cwd, 'none'), env: process.env, store: new ChatStore(join(cwd, 'chats')) });
	t.after(() => sessions.closeAll());
	const env = { PATH: process.env.PATH, FAKE_ACP_LOG: log };
	sessions.prepare({ agent, cwd, env });
	for (let waited = 0; (await started()) < 1 && waited < 5000; waited += 50) await new Promise((done) => setTimeout(done, 50));
	assert.equal(await started(), 1);
	// Not listed while made ready.
	assert.deepEqual(await sessions.list(), []);
	const first = await sessions.start({ agent, cwd, env });
	assert.equal(first.state, 'idle');
	assert.equal(await started(), 1, 'the one made ready, no other started');
	// For another service: not that one.
	const other = await sessions.start({ agent, cwd, env: { ...env, OTHER: '1' } });
	assert.equal(await started(), 2);

	// Spoken in one after the other: of those idle, beyond the latest three, the oldest put to sleep.
	const spoken = [first, other];
	for (let more = 0; more < 3; more += 1) {
		for (const session of spoken) {
			if (session.items.length || session.state !== 'idle') continue;
			session.prompt('几块');
			await until(session, (s) => s.state === 'idle');
		}
		if (more < 2) spoken.push(await sessions.start({ agent, cwd, env }));
	}
	await sessions.start({ agent, cwd, env });
	assert.deepEqual(spoken.map((session) => session.state), ['saved', 'saved', 'idle', 'idle']);
	// Spoken to again: woken, its session loaded again.
	await sessions.wake(first, { agent, env });
	first.prompt('接上了吗');
	await until(first, (s) => s.state === 'idle');
	assert.match(first.items.at(-1).text, /^接上了 fake-session-\d+$/u);
	assert.equal(first.items.some((item) => item.kind === 'error'), false, 'put to sleep is not a failure');
});
