// A stand-in for an agent's ACP adapter (the AI panel's browser tests): an agent that thinks a little, says what it
// will do, asks leave to run a command, runs it (or not) and says how it went, with a plan; told 「慢」 it goes on
// until it is stopped; told 「退出」 it exits; told 「环境」 it says the service it was started for. Its options: a
// mode and a model.
import { Readable, Writable } from 'node:stream';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const { agent, ndJsonStream, PROTOCOL_VERSION } = await import(require.resolve('@agentclientprotocol/sdk'));

// As pi (pi-acp): models of several services, `service/model`.
const asPi = Boolean(process.env.PI_ACP_PI_COMMAND);
const MODELS = asPi
	? [{ value: 'other/one', name: 'other/one' }, { value: 'deepseek/deepseek-flash', name: 'deepseek/deepseek-flash' }, { value: 'deepseek/deepseek-v4-pro', name: 'deepseek/deepseek-v4-pro' }]
	: [{ value: 'small', name: 'Small' }, { value: 'large', name: 'Large' }];
const options = () => [
	{ id: 'mode', name: 'Mode', category: 'mode', type: 'select', currentValue: state.mode, options: [{ value: 'default', name: 'Manual' }, { value: 'plan', name: 'Plan' }] },
	{ id: 'model', name: 'Model', category: 'model', type: 'select', currentValue: state.model, options: MODELS },
];
const state = { mode: 'default', model: MODELS[0].value, turns: 0 };
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const app = agent({ name: 'fake' })
	.onRequest('initialize', () => ({ protocolVersion: PROTOCOL_VERSION, agentCapabilities: { loadSession: true }, authMethods: [] }))
	.onRequest('session/new', () => ({ sessionId: `fake-session-${process.pid}`, configOptions: options(), modes: { currentModeId: state.mode, availableModes: [{ id: 'default', name: 'Manual' }, { id: 'plan', name: 'Plan' }] } }))
	// A session gone on with (after the Studio restarted): what was said in it told again first, as adapters do; one
	// whose id says 「gone」 is not there any more.
	.onRequest('session/load', async ({ params, client }) => {
		if (params.sessionId.includes('gone')) throw new Error('Session not found');
		state.loaded = params.sessionId;
		await client.notify('session/update', { sessionId: params.sessionId, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: '（重放的历史）' } } });
		return { configOptions: options() };
	})
	.onRequest('session/set_config_option', ({ params }) => {
		state[params.configId] = params.value;
		return { configOptions: options() };
	})
	.onNotification('session/cancel', () => {
		state.cancelled = true;
	})
	.onRequest('session/prompt', async ({ params, client }) => {
		const sessionId = params.sessionId;
		const said = params.prompt.map((block) => block.text ?? '').join('');
		const update = (value) => client.notify('session/update', { sessionId, update: value });
		const words = async (kind, text) => {
			for (const piece of text.match(/.{1,4}/gsu) ?? []) {
				await update({ sessionUpdate: kind, content: { type: 'text', text: piece }, messageId: `${kind}-${said.length}` });
				await pause(5);
			}
		};
		state.cancelled = false;
		state.turns += 1;
		const run = `run-${state.turns}`;
		if (said.includes('退出')) process.exit(3);
		// The AI in the editor's asks: a paragraph rewritten, or one written where the caret is.
		if (said.includes('只输出改好的这一段')) {
			await words('agent_message_chunk', `这是 AI 改写后的段落（第 ${state.turns} 次）。`);
			return { stopReason: 'end_turn' };
		}
		if (said.includes('只输出要放进去的')) {
			await words('agent_message_chunk', 'AI 写的新段落。');
			return { stopReason: 'end_turn' };
		}
		// An answer of several blocks, to put in the article (dragged, or clicked).
		if (said.startsWith('几块')) {
			await words('agent_message_chunk', '能量和质量的关系：\n\n$$\nE = mc^2\n$$\n\n- 要点一\n- 要点二');
			return { stopReason: 'end_turn' };
		}
		// The plugins' blocks in what it says: molecules (2D, 3D), an energy diagram, a widget, a bookmark.
		if (said.startsWith('组件')) {
			const blocks = [
				'```smiles\nCC(=O)Oc1ccccc1C(=O)O\n```',
				'```xyz\n3\nwater\nO   0.000000   0.000000   0.117300\nH   0.000000   0.757200  -0.469200\nH   0.000000  -0.757200  -0.469200\n```',
				'```energy\n反应物 0\nTS1 12.3\n产物 -15.2\n```',
				'```widget title="问候" height=120\n<p id="hello">你好，交互模块</p>\n```',
				'```bookmark\nhttps://example.com/\ntitle: 例子网页\ndescription: 一个书签\n```',
			];
			await words('agent_message_chunk', `这些块：\n\n${blocks.join('\n\n')}`);
			return { stopReason: 'end_turn' };
		}
				// A picture it looked at with its read tool (seen only by it), and one it sends as an attachment.
		if (said.startsWith('看图')) {
			const plot = new URL('../fixtures/plot.png', import.meta.url).pathname;
			await update({ sessionUpdate: 'tool_call', toolCallId: 'look', title: 'read', kind: 'read', status: 'completed', locations: [{ path: plot }], rawInput: { path: plot }, content: [{ type: 'content', content: { type: 'text', text: 'Read image file [image/png]' } }] });
			await update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: '附上的图：' } });
			await update({ sessionUpdate: 'agent_message_chunk', content: { type: 'image', mimeType: 'image/png', data: (await import('node:fs')).readFileSync(plot).toString('base64') } });
			return { stopReason: 'end_turn' };
		}
				// A picture it drew on this machine, shown by its path.
		if (said.startsWith('画图')) {
			const plot = new URL('../fixtures/plot.png', import.meta.url).pathname;
			await words('agent_message_chunk', `图画好了：\n\n![势能曲线](${plot})`);
			return { stopReason: 'end_turn' };
		}
				// A plugin's block in what it says (an energy diagram): drawn as the editor draws it.
		if (said.startsWith('能量图')) {
			await words('agent_message_chunk', '路径如下：\n\n```energy\n反应物 0\nTS1 12.3\n产物 -15.2\n```');
			return { stopReason: 'end_turn' };
		}
		// A turn over after thinking, nothing said (as some models end one).
		if (said.startsWith('只想不说')) {
			await words('agent_thought_chunk', '想了很多，结论是……');
			return { stopReason: 'end_turn' };
		}
		if (said.startsWith('接着说')) {
			await words('agent_message_chunk', '结论是这样的。');
			return { stopReason: 'end_turn' };
		}
		// A turn over after thinking, nothing said (as some models end one); asked to go on, it says it.
		if (said.startsWith('只想不说')) {
			await words('agent_thought_chunk', '想了很多，结论是……');
			return { stopReason: 'end_turn' };
		}
		if (said.startsWith('接着说')) {
			await words('agent_message_chunk', '结论是这样的。');
			return { stopReason: 'end_turn' };
		}
		// Which session it goes on with: the one loaded, if one was.
		if (said.startsWith('接上了吗')) {
			await words('agent_message_chunk', state.loaded ? `接上了 ${state.loaded}` : `新的会话 ${sessionId}`);
			return { stopReason: 'end_turn' };
		}
		// What it was told, as it came (with what the Studio adds of where the author is).
		if (said.startsWith('上下文')) {
			await words('agent_message_chunk', `收到的是：\n\n~~~~~~text\n${said}\n~~~~~~`);
			return { stopReason: 'end_turn' };
		}
		// The service it was started for (AI 面板 ⚙): what Claude Code would be told.
		if (said.includes('环境')) {
			await words('agent_message_chunk', asPi ? `pi 模型 ${state.model} DeepSeek key ${process.env.DEEPSEEK_API_KEY ?? '无'}` : `地址 ${process.env.ANTHROPIC_BASE_URL ?? '无'} 模型 ${process.env.ANTHROPIC_MODEL ?? '无'} key ${process.env.ANTHROPIC_AUTH_TOKEN ? '有' : '无'}`);
			return { stopReason: 'end_turn' };
		}
		if (said.includes('慢')) {
			await update({ sessionUpdate: 'tool_call', toolCallId: 'slow', title: 'sleep 100', kind: 'execute', status: 'in_progress' });
			while (!state.cancelled) await pause(20);
			await update({ sessionUpdate: 'tool_call_update', toolCallId: 'slow', status: 'failed' });
			return { stopReason: 'cancelled' };
		}
		await update({ sessionUpdate: 'session_info_update', title: `问：${said.slice(0, 10)}` });
		await words('agent_thought_chunk', '先看看要做什么。');
		await words('agent_message_chunk', `收到（模型 ${state.model}）。我来运行命令。`);
		await update({ sessionUpdate: 'plan', entries: [{ content: '运行 echo', priority: 'high', status: 'in_progress' }, { content: '说结果', priority: 'medium', status: 'pending' }] });
		await update({ sessionUpdate: 'tool_call', toolCallId: run, title: 'echo hi', kind: 'execute', status: 'pending', rawInput: { command: 'echo hi' } });
		const leave = await client.request('session/request_permission', {
			sessionId,
			toolCall: { toolCallId: run, title: 'echo hi', kind: 'execute' },
			options: [{ optionId: 'yes', name: 'Yes', kind: 'allow_once' }, { optionId: 'always', name: 'Always', kind: 'allow_always' }, { optionId: 'no', name: 'No', kind: 'reject_once' }],
		});
		const allowed = leave.outcome.outcome === 'selected' && leave.outcome.optionId !== 'no';
		if (!allowed) {
			await update({ sessionUpdate: 'tool_call_update', toolCallId: run, status: 'failed' });
			await words('agent_message_chunk', '好，不运行了。');
			return { stopReason: state.cancelled ? 'cancelled' : 'end_turn' };
		}
		await update({ sessionUpdate: 'tool_call_update', toolCallId: run, status: 'in_progress' });
		await update({ sessionUpdate: 'tool_call_update', toolCallId: run, status: 'completed', content: [{ type: 'content', content: { type: 'text', text: '```console\nhi\n```' } }] });
		await update({ sessionUpdate: 'tool_call', toolCallId: `edit-${state.turns}`, title: 'Edit index.md', kind: 'edit', status: 'completed', locations: [{ path: `${process.cwd()}/index.md` }], content: [{ type: 'diff', path: `${process.cwd()}/index.md`, oldText: '旧的一行', newText: '新的一行' }] });
		await update({ sessionUpdate: 'plan', entries: [{ content: '运行 echo', priority: 'high', status: 'completed' }, { content: '说结果', priority: 'medium', status: 'completed' }] });
		await words('agent_message_chunk', '运行完了，输出是 **hi**。能量 $E = mc^2$。');
		return { stopReason: 'end_turn' };
	});

app.connect(ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin)));
