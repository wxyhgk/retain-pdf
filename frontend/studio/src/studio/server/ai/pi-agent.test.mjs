import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { AgentSessions } from './agent-sessions.mjs';
import { ChatStore } from './chat-store.mjs';

/**
 * A service as OpenAI's chat completions (streamed): asked to run something, it calls pi's shell tool, then says what
 * that printed; else it says what it was told last. A key other than `good` is refused.
 */
async function fakeService(t, picturePath = '') {
	const asked = [];
	const server = createServer(async (request, response) => {
		let body = '';
		for await (const piece of request) body += piece;
		const { messages } = JSON.parse(body);
		asked.push(messages);
		if (request.headers.authorization !== 'Bearer good') {
			response.writeHead(401, { 'content-type': 'application/json' });
			response.end(JSON.stringify({ error: { message: 'invalid api key' } }));
			return;
		}
		response.writeHead(200, { 'content-type': 'text/event-stream' });
		// Each answer says what it used (the context counted from it).
		const chunk = (delta, finish = null) => response.write(`data: ${JSON.stringify({ id: 'c', object: 'chat.completion.chunk', created: 0, model: 'm1', choices: [{ index: 0, delta, finish_reason: finish }], ...(finish ? { usage: { prompt_tokens: 1200, completion_tokens: 30, total_tokens: 1230 } } : {}) })}\n\n`);
		const call = (name, args) => {
			chunk({ role: 'assistant', tool_calls: [{ index: 0, id: `call_${asked.length}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }] });
			chunk({}, 'tool_calls');
		};
		const last = messages.at(-1);
		const said = typeof last.content === 'string' ? last.content : last.content?.map?.((part) => part.text ?? '').join('') ?? '';
		if (last.role === 'user' && said.includes('运行')) call('bash', { command: 'echo "mark=$STUDIO_MARK"' });
		else if (last.role === 'user' && said.includes('读页面')) call('read_page', { slug: 'note-a' });
		else if (last.role === 'user' && said.includes('看图')) call('show_picture', { path: picturePath, caption: '一张图' });
		else if (last.role === 'user' && said.includes('推上去')) call('bash', { command: 'git -C . push origin main' });
		else if (last.role === 'user' && said.includes('删掉旧的')) call('bash', { command: 'cd . && rm -rf old-notes' });
		else if (last.role === 'user' && said.includes('分头')) call('subagent', { tasks: [{ agent: 'scout', task: '找认证代码' }, { agent: 'planner', task: '定计划' }] });
		else {
			// Slow, to be spoken to meanwhile.
			if (said.includes('慢慢说')) await new Promise((done) => setTimeout(done, 1500));
			chunk({ role: 'assistant', content: last.role === 'tool' ? `输出是 ${said.trim().slice(0, 200)}` : `收到：${said}` });
			chunk({}, 'stop');
		}
		response.end('data: [DONE]\n\n');
	});
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	t.after(() => server.close());
	return { url: `http://127.0.0.1:${server.address().port}/v1`, asked };
}

/** pi's own folder for the test: the service above its only model, chosen. */
async function piFolder(cwd, url, key) {
	const folder = join(cwd, 'pi');
	await mkdir(folder, { recursive: true });
	await writeFile(join(folder, 'models.json'), JSON.stringify({ providers: { fake: { baseUrl: url, api: 'openai-completions', apiKey: key, authHeader: true, models: [{ id: 'm1', name: 'm1', reasoning: false }] } } }));
	await writeFile(join(folder, 'settings.json'), JSON.stringify({ defaultProvider: 'fake', defaultModel: 'm1' }));
	return folder;
}

const until = (session, holds) =>
	new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`等不到：${holds}`)), 15000);
		const stop = session.subscribe(() => {
			if (!holds(session)) return;
			clearTimeout(timer);
			resolve();
			queueMicrotask(() => stop());
		});
	});

test('pi in this process: no process started; words and a command (in the Studio’s environment) as an adapter’s; gone on with after a restart; a service that refuses, said', async (t) => {
	process.env.PI_OFFLINE = '1';
	const cwd = await realpath(await mkdtemp(join(tmpdir(), 'pi-agent-')));
	t.after(() => rm(cwd, { recursive: true, force: true }));
	await mkdir(join(cwd, 'blog', 'note-a'), { recursive: true });
	await writeFile(join(cwd, 'blog', 'note-a', 'index.md'), "---\ntitle: '甲'\npubDate: '2026-10-20'\ndraft: true\n---\n\n甲的正文。\n");
	const picturePath = join(cwd, 'plot.png');
	await writeFile(picturePath, 'png');
	const service = await fakeService(t, picturePath);
	const agent = { id: 'pi', name: 'pi', acp: 'pi-acp' };
	const env = { PATH: process.env.PATH, PI_CODING_AGENT_DIR: await piFolder(cwd, service.url, 'good'), STUDIO_MARK: 'studio' };
	const store = new ChatStore(join(cwd, 'chats'));
	// No adapter there to start: binFolder has none.
	const first = new AgentSessions({ binFolder: join(cwd, 'none'), env: process.env, store });
	const session = await first.start({ agent, cwd, env });
	assert.equal(session.state, 'idle');
	assert.deepEqual(session.summary().configOptions.find((option) => option.id === 'model').currentValue, 'fake/m1');

	// Where the author is: in its system prompt for this run, and a line of it with what was said (told once in the
	// system prompt, it was lost after a long run).
	session.prompt('你好', { article: { title: '甲', path: 'note-a/index.md' } });
	await until(session, (s) => s.state === 'idle');
	assert.match(session.items.at(-1).text, /^收到：你好\n\n<studio-context>\n.*\n当前打开的文章：《甲》，文件 note-a\/index\.md\n<\/studio-context>$/u);
	const system = service.asked.at(-1).find((message) => message.role === 'system' || message.role === 'developer');
	assert.match(JSON.stringify(system), /当前打开的文章：《甲》/u);
	// Its thinking asked for in Chinese, every run.
	assert.match(JSON.stringify(system), /思考过程.*也一律用简体中文写/u);
	// How much of the context is used.
	assert.ok(session.usage?.used >= 1200, `用量：${JSON.stringify(session.usage)}`);

	// The Studio's operations are its tools: a page read, named as the panel names it.
	session.prompt('读页面');
	await until(session, (s) => s.state === 'idle');
	const read = session.items.filter((item) => item.kind === 'tool').at(-1);
	assert.equal(read.title, '读页面 note-a');
	assert.equal(read.toolKind, 'read');
	assert.match(session.items.at(-1).text, /甲的正文/u);
	// A picture shown to the author: in its words.
	session.prompt('看图');
	await until(session, (s) => s.state === 'idle');
	assert.ok(session.items.some((item) => item.kind === 'message' && item.text.includes(`![一张图](${picturePath})`)));
	// Spoken to while it works: taken once its step is done, the turn going on.
	assert.equal(session.summary().canSteer, true);
	session.prompt('慢慢说');
	await until(session, (s) => s.state === 'running');
	await new Promise((done) => setTimeout(done, 300));
	session.steer('插一句');
	await until(session, (s) => s.state === 'idle');
	assert.equal(session.items.filter((item) => item.kind === 'user').at(-1).text, '插一句');
	assert.ok(session.items.some((item) => item.kind === 'message' && item.text.includes('收到：插一句')), JSON.stringify(session.items.slice(-4)));

	session.prompt('运行一下');
	await until(session, (s) => s.state === 'idle');
	const run = session.items.find((item) => item.kind === 'tool' && item.toolKind === 'execute');
	assert.equal(run.title, 'echo "mark=$STUDIO_MARK"');
	assert.equal(run.toolKind, 'execute');
	assert.equal(run.status, 'completed');
	assert.match(run.content[0].content.text, /mark=studio/u);
	assert.match(session.items.at(-1).text, /^输出是 .*mark=studio/u);
	first.closeAll();

	// After a restart: woken, pi's own session of before loaded, what was said there.
	const second = new AgentSessions({ binFolder: join(cwd, 'none'), env: process.env, store });
	t.after(() => second.closeAll());
	const back = await second.find(session.id);
	await second.wake(back, { agent, env });
	back.prompt('还在吗');
	await until(back, (s) => s.state === 'idle');
	assert.equal(back.items.at(-1).text, '收到：还在吗');
	const told = service.asked.at(-1).map((message) => message.role);
	assert.ok(told.filter((role) => role === 'user').length >= 3, `pi 带上了之前说过的话：${told}`);

	// A key the service refuses: said where the answer would be.
	const refused = new AgentSessions({ binFolder: join(cwd, 'none'), env: process.env });
	t.after(() => refused.closeAll());
	const wrong = await refused.start({ agent, cwd, env: { ...env, PI_CODING_AGENT_DIR: await piFolder(join(cwd, 'wrong'), service.url, 'bad') } });
	wrong.prompt('你好');
	await until(wrong, (s) => s.state === 'idle');
	assert.match(wrong.items.at(-1).message ?? '', /401|invalid api key/u);
});

/**
 * pi's subagent extension, as it reports (its `details`: each agent's messages and usage, as they come), without the
 * agents: two side by side, one calling a command, then done; the other failing.
 */
const FAKE_SUBAGENT = `
const usage = (input, output, turns, cost) => ({ input, output, cacheRead: 0, cacheWrite: 0, cost, contextTokens: input, turns });
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
export default function (pi) {
	pi.registerTool({
		name: 'subagent',
		label: 'Subagent',
		description: 'Delegate tasks to subagents.',
		parameters: { type: 'object', properties: { tasks: { type: 'array', items: { type: 'object', properties: { agent: { type: 'string' }, task: { type: 'string' } } } } } },
		async execute(_id, params, _signal, onUpdate) {
			const results = params.tasks.map(({ agent, task }) => ({ agent, agentSource: 'user', task, exitCode: -1, messages: [], stderr: '', usage: usage(0, 0, 0, 0) }));
			const report = (text) => onUpdate?.({ content: [{ type: 'text', text }], details: { mode: 'parallel', agentScope: 'user', projectAgentsDir: null, results: structuredClone(results) } });
			report('Parallel: 0/2 done, 2 running...');
			await wait(150);
			results[0].messages = [{ role: 'assistant', content: [{ type: 'text', text: '先搜一下。' }, { type: 'toolCall', id: 'c1', name: 'bash', arguments: { command: 'grep -rn auth src' } }] }];
			results[0].usage = usage(1500, 300, 1, 0.002);
			report('Parallel: 0/2 done, 2 running...');
			await wait(150);
			results[0].messages.push({ role: 'toolResult', toolCallId: 'c1', toolName: 'bash', content: [{ type: 'text', text: 'src/auth.ts:1' }], isError: false }, { role: 'assistant', content: [{ type: 'text', text: '认证代码在 src/auth.ts。' }] });
			results[0].usage = usage(3000, 500, 2, 0.004);
			results[0].exitCode = 0;
			results[1].messages = [{ role: 'assistant', content: [{ type: 'text', text: '' }] }];
			results[1].exitCode = 1;
			results[1].errorMessage = '模型拒绝了请求';
			report('Parallel: 1/2 done, 0 running...');
			return { content: [{ type: 'text', text: 'Parallel: 1/2 succeeded' }], details: { mode: 'parallel', agentScope: 'user', projectAgentsDir: null, results } };
		},
	});
}
`;

test('pi’s subagents (its subagent extension): each shown apart as it goes, what it is doing, its steps, how much; done or failed', async (t) => {
	process.env.PI_OFFLINE = '1';
	const cwd = await realpath(await mkdtemp(join(tmpdir(), 'pi-subagents-')));
	t.after(() => rm(cwd, { recursive: true, force: true }));
	const service = await fakeService(t);
	const folder = await piFolder(cwd, service.url, 'good');
	await mkdir(join(folder, 'extensions'), { recursive: true });
	await writeFile(join(folder, 'extensions', 'fake-subagent.js'), FAKE_SUBAGENT);
	const sessions = new AgentSessions({ binFolder: join(cwd, 'none'), env: process.env, store: new ChatStore(join(cwd, 'chats')) });
	t.after(() => sessions.closeAll());
	const session = await sessions.start({ agent: { id: 'pi', name: 'pi', acp: 'pi-acp' }, cwd, env: { PATH: process.env.PATH, PI_CODING_AGENT_DIR: folder } });
	const seen = [];
	const stop = session.subscribe(() => {
		const call = session.items.find((item) => item.kind === 'tool' && item.subagents);
		if (call) seen.push(structuredClone(call));
	});
	t.after(() => stop());
	session.prompt('分头去做');
	await until(session, (s) => s.state === 'idle');
	const call = session.items.find((item) => item.kind === 'tool' && item.subagents);
	assert.equal(call.title, '2 个子代理并行');
	// As it went: the scout calling its command, the planner not begun.
	const going = seen.find((item) => item.subagents[0].steps.length === 1 && item.subagents[0].status === 'running');
	assert.ok(going, JSON.stringify(seen.map((item) => item.subagents.map((agent) => agent.status))));
	assert.equal(going.subagents[0].doing, 'grep -rn auth src');
	assert.equal(going.subagents[0].tokens, 1800);
	assert.equal(going.subagents[1].status, 'waiting');
	assert.ok(seen.some((item) => item.subagents[0].status === 'waiting'));
	// Done: the scout's steps, what it said, how much; the planner failed, saying why.
	const [scout, planner] = call.subagents;
	assert.deepEqual({ name: scout.name, task: scout.task, status: scout.status, toolUses: scout.toolUses, turns: scout.turns, tokens: scout.tokens, cost: scout.cost, output: scout.output, doing: scout.doing }, { name: 'scout', task: '找认证代码', status: 'completed', toolUses: 1, turns: 2, tokens: 3500, cost: 0.004, output: '认证代码在 src/auth.ts。', doing: '' });
	assert.deepEqual(scout.steps, [{ title: 'grep -rn auth src', kind: 'execute', failed: false }]);
	assert.ok(scout.endedAt >= scout.startedAt);
	assert.equal(planner.status, 'failed');
	assert.equal(planner.error, '模型拒绝了请求');
	assert.equal(call.status, 'completed');
});

test('pi asks no one before a command, so the Studio does: a push refused, deleting a folder asked of the author first', async (t) => {
	process.env.PI_OFFLINE = '1';
	const cwd = await realpath(await mkdtemp(join(tmpdir(), 'pi-risky-')));
	t.after(() => rm(cwd, { recursive: true, force: true }));
	await mkdir(join(cwd, 'old-notes'));
	const service = await fakeService(t);
	const folder = await piFolder(cwd, service.url, 'good');
	const sessions = new AgentSessions({ binFolder: join(cwd, 'none'), env: process.env, store: new ChatStore(join(cwd, 'chats')) });
	t.after(() => sessions.closeAll());
	const session = await sessions.start({ agent: { id: 'pi', name: 'pi', acp: 'pi-acp' }, cwd, env: { PATH: process.env.PATH, PI_CODING_AGENT_DIR: folder } });

	// A push: not done, nothing asked, the model told why.
	session.prompt('推上去');
	await until(session, (s) => s.state === 'idle');
	const pushed = session.items.find((item) => item.kind === 'tool' && item.rawInput?.command?.includes('push'));
	assert.equal(pushed.status, 'failed');
	assert.equal(session.items.some((item) => item.kind === 'permission'), false);
	assert.match(JSON.stringify(service.asked.at(-1).at(-1)), /推送由作者自己做/u);

	// A folder deleted: asked; said no, not done.
	session.prompt('删掉旧的');
	await until(session, (s) => s.items.some((item) => item.kind === 'permission' && !item.chosen));
	const asked = session.items.find((item) => item.kind === 'permission');
	assert.match(asked.title, /rm -rf old-notes.*会删掉文件夹/u);
	assert.deepEqual(asked.options.map((option) => option.optionId), ['allow', 'reject']);
	session.answer(asked.id, 'reject');
	await until(session, (s) => s.state === 'idle');
	assert.ok(existsSync(join(cwd, 'old-notes')));
	assert.equal(session.items.find((item) => item.kind === 'tool' && item.id === asked.toolCallId)?.status, 'failed');
	assert.match(JSON.stringify(service.asked.at(-1).at(-1)), /作者没有同意运行这条命令/u);

	// Asked again, allowed: done.
	session.prompt('删掉旧的');
	await until(session, (s) => s.items.some((item) => item.kind === 'permission' && !item.chosen));
	session.answer(session.items.findLast((item) => item.kind === 'permission').id, 'allow');
	await until(session, (s) => s.state === 'idle');
	assert.equal(existsSync(join(cwd, 'old-notes')), false);
});
