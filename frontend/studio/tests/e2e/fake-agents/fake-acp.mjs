// A stand-in for an agent's ACP adapter (the AI panel's browser tests): an agent that thinks a little, says what it
// will do, asks leave to run a command, runs it (or not) and says how it went, with a plan; told 「慢」 it goes on
// until it is stopped (or, as Claude Code, told something in between); told 「退出」 it exits; told 「环境」 it says the
// service it was started for; told 「问我」 it asks a question (a form); given pictures, it counts them; a slash
// command it says back. Its options: a mode, a model and how hard it thinks; its commands: /compact, /review.
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
	{ id: 'thought_level', name: 'Thinking', category: 'thought_level', type: 'select', currentValue: state.thought_level, options: [{ value: 'low', name: 'Low' }, { value: 'medium', name: 'Medium' }, { value: 'high', name: 'High' }] },
];
const state = { mode: 'default', model: MODELS[0].value, thought_level: 'medium', turns: 0 };
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const app = agent({ name: 'fake' })
	.onRequest('initialize', async () => {
		// Each adapter started, told (the tests count them).
		if (process.env.FAKE_ACP_LOG) (await import('node:fs')).appendFileSync(process.env.FAKE_ACP_LOG, `${process.pid}\n`);
		// As Claude Code: words taken while it works (ACP's steering extension); as pi-acp, not.
		return { protocolVersion: PROTOCOL_VERSION, agentCapabilities: { loadSession: true, promptCapabilities: { image: true } }, authMethods: [], ...(asPi ? {} : { _meta: { steering: { supported: true } } }) };
	})
	.onRequest('session/new', ({ client }) => {
		const sessionId = `fake-session-${process.pid}`;
		// Its commands, once the session is there.
		setTimeout(() => void client.notify('session/update', { sessionId, update: { sessionUpdate: 'available_commands_update', availableCommands: [{ name: 'compact', description: '压缩上下文' }, { name: 'review', description: '审一遍', input: { hint: '要审的内容' } }] } }), 50);
		return { sessionId, configOptions: options(), modes: { currentModeId: state.mode, availableModes: [{ id: 'default', name: 'Manual' }, { id: 'plan', name: 'Plan' }] } };
	})
	// Words while it works: taken into the turn going on.
	.onRequest('_session/steering', { parse: (params) => params }, ({ params }) => {
		state.steered = params.prompt.map((block) => block.text ?? '').join('');
		return { outcome: 'injected' };
	})
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
		const pictures = params.prompt.filter((block) => block.type === 'image');
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
		// Files given with it: read where the Studio says they are, on this machine.
		const given = [...said.matchAll(/^- (\/.+)$/gmu)].map((match) => match[1]).filter(() => said.includes('随这句话附上的文件'));
		if (given.length) {
			const { readFileSync } = await import('node:fs');
			await words('agent_message_chunk', given.map((path) => `读到 ${path.split('/').pop()}：${readFileSync(path, 'utf8').trim()}`).join('；'));
			return { stopReason: 'end_turn' };
		}
		if (pictures.length) {
			await words('agent_message_chunk', `看到 ${pictures.length} 张图（${pictures.map((block) => block.mimeType).join('、')}）`);
			return { stopReason: 'end_turn' };
		}
		// Its context compacted: in progress, its summary, done.
		if (said.startsWith('/compact')) {
			await update({ sessionUpdate: 'compaction_update', compactionId: 'c1', status: 'in_progress' });
			await update({ sessionUpdate: 'compaction_summary_chunk', compactionId: 'c1', content: { type: 'text', text: '之前聊了基组的选择。' } });
			await update({ sessionUpdate: 'compaction_update', compactionId: 'c1', status: 'completed' });
			await update({ sessionUpdate: 'usage_update', used: 20000, size: 200000 });
			await words('agent_message_chunk', '压缩好了。');
			return { stopReason: 'end_turn' };
		}
		// A slash command, as it came (nothing added after it).
		if (said.startsWith('/')) {
			await words('agent_message_chunk', `命令 ${said}`);
			return { stopReason: 'end_turn' };
		}
		// How much of its context is used: nearly all.
		if (said.startsWith('用量')) {
			await update({ sessionUpdate: 'usage_update', used: 170000, size: 200000, cost: { amount: 0.42, currency: 'USD' } });
			await words('agent_message_chunk', '用了不少。');
			return { stopReason: 'end_turn' };
		}
		// Fails the first time it is asked, answers the next.
		if (said.startsWith('出错')) {
			state.failures = (state.failures ?? 0) + 1;
			if (state.failures === 1) throw new Error('服务忙');
			await words('agent_message_chunk', `第 ${state.failures} 次好了`);
			return { stopReason: 'end_turn' };
		}
		// Leave asked to change a file: the change in the asking.
		if (said.startsWith('改文件')) {
			const diff = { type: 'diff', path: '/tmp/note.md', oldText: '旧的一行', newText: '新的一行' };
			await update({ sessionUpdate: 'tool_call', toolCallId: 'change', title: 'Edit note.md', kind: 'edit', status: 'pending', content: [diff] });
			const leave = await client.request('session/request_permission', { sessionId, toolCall: { toolCallId: 'change', title: 'Edit note.md', kind: 'edit' }, options: [{ optionId: 'yes', name: 'Yes', kind: 'allow_once' }, { optionId: 'no', name: 'No', kind: 'reject_once' }] });
			await words('agent_message_chunk', leave.outcome.optionId === 'yes' ? '改好了。' : '不改了。');
			return { stopReason: 'end_turn' };
		}
		// A question, as Claude Code's AskUserQuestion is asked: a form.
		if (said.startsWith('问我')) {
			const asked = await client.request('elicitation/create', {
				mode: 'form',
				sessionId,
				message: '用哪个基组？',
				requestedSchema: { type: 'object', properties: { question_0: { type: 'string', title: '基组', oneOf: [{ const: 'def2-SVP', title: 'def2-SVP', description: '快' }, { const: 'def2-TZVP', title: 'def2-TZVP' }] }, question_0_custom: { type: 'string', title: 'Other' } } },
			});
			await words('agent_message_chunk', asked.action === 'accept' ? `就用 ${asked.content.question_0_custom || asked.content.question_0}` : `没答（${asked.action}）`);
			return { stopReason: 'end_turn' };
		}
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
		// The blog's articles named: by title, by a link to the file, by its path; and one not there.
		if (said.startsWith('提到')) {
			await words('agent_message_chunk', '参见《另一篇笔记》，还有[这篇夹具](studio-fixture/index.md)和 `other-note/index.md`；《没有这篇》不是。');
			return { stopReason: 'end_turn' };
		}
		// Code, and formulas in a line and on their own, to copy.
		if (said.startsWith('代码')) {
			await words('agent_message_chunk', '```python\nprint(1)\n```\n\n行内 $a+b$ 和\n\n$$\nE = mc^2\n$$');
			return { stopReason: 'end_turn' };
		}
		// A formula with its $$ against it, as answers write it.
		if (said.startsWith('积分')) {
			await words('agent_message_chunk', '分部积分。\n\n$$\\begin{aligned}\n\\int \\ln x\\, dx &= x\\ln x - \\int dx \\\\\n&= x\\ln x - x + C\n\\end{aligned}$$\n\n验算一下：$(x\\ln x - x)\' = \\ln x$，对的。');
			return { stopReason: 'end_turn' };
		}
		// A long answer, streamed slowly: paragraphs with formulas, then a list (the panel kept quick, a selection in it kept).
		if (said.startsWith('长回答')) {
			const paragraph = (at) => `第 ${at} 段：能量 $E_{${at}} = \\frac{1}{2} m v^2 + \\int_0^{${at}} F\\,dx$，再看 $\\sum_{i=1}^{n} x_i^2$。\n\n`;
			const text = Array.from({ length: 60 }, (_, at) => paragraph(at + 1)).join('') + '- 要点一\n- 要点二\n';
			for (const piece of text.match(/.{1,6}/gsu) ?? []) {
				if (state.cancelled) return { stopReason: 'cancelled' };
				await update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: piece }, messageId: 'long' });
				await pause(8);
			}
			return { stopReason: 'end_turn' };
		}
		// Words with a formula in them, to quote.
		if (said.startsWith('公式')) {
			await words('agent_message_chunk', '质能关系 $E = mc^2$ 说明质量就是能量。\n\n第二段。');
			return { stopReason: 'end_turn' };
		}
		// Subagents at work, as the Studio's pi reports them (pi-agent.mjs subagentsOf): one calling a command while the
		// other waits; then one done, one failed.
		if (said.startsWith('子代理')) {
			const begun = Date.now() - 65_000;
			const agent = (over) => ({ id: 'sub/0', name: 'scout', task: '找认证代码', status: 'running', model: 'fake/m1', step: null, steps: [], toolUses: 0, turns: 0, tokens: 0, cost: 0, doing: '', output: '', error: '', startedAt: begun, endedAt: null, ...over });
			const scoutGoing = agent({ steps: [{ title: 'grep -rn auth src', kind: 'execute', failed: false }], toolUses: 1, turns: 1, tokens: 1800, doing: 'grep -rn auth src' });
			const plannerWaiting = agent({ id: 'sub/1', name: 'planner', task: '定计划', status: 'waiting' });
			await update({ sessionUpdate: 'tool_call', toolCallId: 'sub', title: '2 个子代理并行', kind: 'other', status: 'in_progress' });
			await update({ sessionUpdate: 'tool_call_update', toolCallId: 'sub', status: 'in_progress', _meta: { studio: { subagents: [scoutGoing, plannerWaiting] } } });
			await pause(2500);
			const scoutDone = agent({ ...scoutGoing, status: 'completed', doing: '', turns: 2, tokens: 3500, cost: 0.004, output: '认证代码在 **src/auth.ts**。', endedAt: begun + 72_000 });
			const plannerFailed = agent({ id: 'sub/1', name: 'planner', task: '定计划', status: 'failed', error: '模型拒绝了请求', endedAt: begun + 66_000 });
			await update({ sessionUpdate: 'tool_call_update', toolCallId: 'sub', status: 'completed', content: [{ type: 'content', content: { type: 'text', text: 'Parallel: 1/2 succeeded' } }], _meta: { studio: { subagents: [scoutDone, plannerFailed] } } });
			await words('agent_message_chunk', '分头做完了。');
			return { stopReason: 'end_turn' };
		}
		// A widget that speaks to it (note.ask, note.tell), written slowly: the panel waits for it whole.
		if (said.startsWith('小模块')) {
			const widget = [
				'```widget title="参数" height=140',
				'<input id="a" type="range" min="1" max="10" value="3"> <button id="go">重算</button> <span id="shown"></span> <span id="self"></span>',
				'<script>',
				'const a = document.querySelector("#a");',
				'if (note.state) a.value = note.state.a;',
				'const show = () => { document.querySelector("#shown").textContent = (note.canAsk ? "能问" : "不能问") + " a=" + a.value; };',
				'a.addEventListener("input", () => { note.tell({ a: Number(a.value) }); show(); });',
				'document.querySelector("#go").addEventListener("click", () => note.ask("上下文：用 a=" + a.value + " 重算"));',
				'show();',
				'note.ask("上下文：自己问的").then((said) => { document.querySelector("#self").textContent = said ? "自己问了" : "自己问不了"; });',
				'</script>',
				'```',
			].join('\n');
			for (const piece of `调一调：\n\n${widget}`.match(/.{1,8}/gsu) ?? []) {
				await update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: piece }, messageId: 'widget' });
				await pause(25);
			}
			return { stopReason: 'end_turn' };
		}
		// What it was told, as it came (with what the Studio adds of where the author is; what was quoted, before).
		if (said.startsWith('上下文') || said.startsWith('> ')) {
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
			state.steered = '';
			while (!state.cancelled && !state.steered) await pause(20);
			if (state.steered) {
				await update({ sessionUpdate: 'tool_call_update', toolCallId: 'slow', status: 'completed' });
				await words('agent_message_chunk', `插话收到：${state.steered}`);
				return { stopReason: 'end_turn' };
			}
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
