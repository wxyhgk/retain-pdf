import assert from 'node:assert/strict';
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

	// Where the author is: in its system prompt for this run, not in what was said.
	session.prompt('你好', { article: { title: '甲', path: 'note-a/index.md' } });
	await until(session, (s) => s.state === 'idle');
	assert.equal(session.items.at(-1).text, '收到：你好');
	const system = service.asked.at(-1).find((message) => message.role === 'system' || message.role === 'developer');
	assert.match(JSON.stringify(system), /当前打开的文章：《甲》/u);
	assert.equal(JSON.stringify(service.asked.at(-1).filter((message) => message.role === 'user')).includes('当前打开的文章'), false);
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
