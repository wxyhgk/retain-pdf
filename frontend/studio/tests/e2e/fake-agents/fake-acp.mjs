// A stand-in for an agent's ACP adapter (the AI panel's browser tests): an agent that thinks a little, says what it
// will do, asks leave to run a command, runs it (or not) and says how it went, with a plan; told 「慢」 it goes on
// until it is stopped; told 「退出」 it exits; told 「环境」 it says the service it was started for. Its options: a
// mode and a model.
import { Readable, Writable } from 'node:stream';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const { agent, ndJsonStream, PROTOCOL_VERSION } = await import(require.resolve('@agentclientprotocol/sdk'));

const options = () => [
	{ id: 'mode', name: 'Mode', category: 'mode', type: 'select', currentValue: state.mode, options: [{ value: 'default', name: 'Manual' }, { value: 'plan', name: 'Plan' }] },
	{ id: 'model', name: 'Model', category: 'model', type: 'select', currentValue: state.model, options: [{ value: 'small', name: 'Small' }, { value: 'large', name: 'Large' }] },
];
const state = { mode: 'default', model: 'small', turns: 0 };
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const app = agent({ name: 'fake' })
	.onRequest('initialize', () => ({ protocolVersion: PROTOCOL_VERSION, agentCapabilities: {}, authMethods: [] }))
	.onRequest('session/new', () => ({ sessionId: 'fake-session', configOptions: options(), modes: { currentModeId: state.mode, availableModes: [{ id: 'default', name: 'Manual' }, { id: 'plan', name: 'Plan' }] } }))
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
		// The service it was started for (AI 面板 ⚙): what Claude Code would be told.
		if (said.includes('环境')) {
			await words('agent_message_chunk', `地址 ${process.env.ANTHROPIC_BASE_URL ?? '无'} 模型 ${process.env.ANTHROPIC_MODEL ?? '无'} key ${process.env.ANTHROPIC_AUTH_TOKEN ? '有' : '无'}`);
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
