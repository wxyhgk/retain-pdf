import {
	answerConversation,
	closeConversation,
	followConversation,
	listConversations,
	setConversationOption,
	startConversation,
	stopConversation,
	tellConversation,
	type Conversation,
	type ConversationEvent,
	type ConversationItem,
	type ConversationOption,
} from '../api/client';
import { renderAiMarkdown } from './ai-markdown';
import { createModelsSheet } from './ai-models-sheet';
import { showContextMenu, type MenuItem } from './context-menu';

/** What the AI panel needs of the Studio around it. */
export type AiPanelHost = {
	/** The article open, if one is. */
	article(): { slug: string; title: string } | null;
	toast(message: string): void;
	/** Runs a command in the 终端 tab (an account's login). */
	runInTerminal(command: string): void;
};

type ToolItem = Extract<ConversationItem, { kind: 'tool' }>;
type PermissionItem = Extract<ConversationItem, { kind: 'permission' }>;

const CONVERSATION_KEY = 'studio.ai.conversation';
const AGENT_KEY = 'studio.ai.agent';

/** The options shown under the input, in this order: who decides, which model, how hard it thinks. */
const SHOWN_OPTIONS = ['mode', 'model', 'thought_level'];
/**
 * Names the adapters give in English, said in Chinese as what they let it do without asking (the rest as they come).
 * Claude Code's "accept edits" lets it change files, but asks before a command that does something (python, rm…).
 */
const OPTION_NAMES: Record<string, string> = {
	default: '每步都问',
	acceptEdits: '自动改文件（命令要问）',
	plan: '只做计划',
	auto: '自动（只问危险的）',
	bypassPermissions: '全部允许（不再问）',
	'read-only': '只读（改动都要问）',
	'workspace-write': '可改文件夹（联网要问）',
	agent: '自动（只问不安全的）',
	'agent-full-access': '完全访问（不再问）',
};
/** The options the author chose for an AI, given again to each conversation begun with it. */
const OPTIONS_KEY = (agent: string) => `studio.ai.options.${agent}`;
const EFFORT_NAMES: Record<string, string> = { default: '思考：默认', low: '思考：低', medium: '思考：中', high: '思考：高', xhigh: '思考：很高', max: '思考：最高', ultra: '思考：极限' };
const PERMISSION_NAMES: Record<string, string> = { allow_once: '允许', allow_always: '总是允许', reject_once: '拒绝', reject_always: '总是拒绝' };
const TOOL_ICONS: Record<string, string> = { execute: '›_', read: '◫', edit: '✎', delete: '⌫', move: '⇄', search: '⌕', fetch: '⇣', think: '…', switch_mode: '⇆', other: '•' };
const STOP_NAMES: Record<string, string> = { cancelled: '已停止', max_tokens: '回答太长，停在这里了', max_turn_requests: '步数到了上限，停在这里了', refusal: '它拒绝了这个请求' };

const remembered = (key: string): string | null => {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
};
const remember = (key: string, value: string | null): void => {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {
		// Private windows may refuse storage: the panel then starts afresh each visit.
	}
};

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text) node.textContent = text;
	return node;
}

/**
 * The AI panel (the right column's AI tab): a coding agent (Claude Code, Codex) that does what it is asked by
 * itself, reading, running commands and changing files in the article's folder, shown as it goes. Its words,
 * thinking, each tool it calls (the command, its output, the change to a file), its plan and the leave it asks are
 * drawn as they come (server/agent-sessions.mjs, over the Agent Client Protocol); what it changes in the article
 * comes back as a change on disk, to look over as any other. Under the input: which AI, and its options (who
 * decides, model, effort). A conversation goes on in the article it began in; ＋ begins another.
 */
export function createAiPanel(pane: HTMLElement, host: AiPanelHost) {
	const toolbar = element('header', 'pane-toolbar ai-toolbar');
	const title = element('span', 'ai-title', '新对话');
	const where = element('span', 'ai-where');
	const actions = element('div', 'pane-actions');
	const historyButton = element('button', '', '≡');
	historyButton.type = 'button';
	historyButton.title = '对话记录';
	historyButton.setAttribute('aria-label', '对话记录');
	const newButton = element('button', '', '＋');
	newButton.type = 'button';
	newButton.title = '新对话';
	newButton.setAttribute('aria-label', '新对话');
	const modelsButton = element('button', '', '⚙');
	modelsButton.type = 'button';
	modelsButton.title = '模型和账号：Claude 账号、DeepSeek 等 API key';
	modelsButton.setAttribute('aria-label', '模型和账号');
	actions.append(modelsButton, historyButton, newButton);
	toolbar.append(title, where, actions);

	const transcript = element('div', 'ai-transcript');
	transcript.setAttribute('role', 'log');
	transcript.setAttribute('aria-live', 'polite');
	const empty = element('div', 'ai-empty');
	const emptyTitle = element('p', 'ai-empty-title', '要做点什么？');
	const emptyHint = element('p', 'ai-empty-hint', '它会自己读文件、运行命令、改文章；改了文章会像别的改动一样让你过目。');
	const suggestions = element('div', 'ai-suggestions');
	for (const text of ['总结这篇文章', '检查这篇的公式和单位有没有错', '把文章里的计算重新跑一遍，核对结果', '找出正文里引用了却没在 refs.bib 里的文献']) {
		const button = element('button', 'ai-suggestion', text);
		button.type = 'button';
		button.addEventListener('click', () => {
			input.value = text;
			grow();
			input.focus();
		});
		suggestions.append(button);
	}
	empty.append(emptyTitle, emptyHint, suggestions);
	const list = element('div', 'ai-items');
	transcript.append(empty, list);

	const composer = element('div', 'ai-composer');
	const status = element('p', 'ai-status');
	status.setAttribute('role', 'status');
	const input = element('textarea', 'ai-input');
	input.rows = 1;
	input.placeholder = '让 AI 做点什么…';
	input.setAttribute('aria-label', '对 AI 说');
	const bar = element('div', 'ai-composer-bar');
	const agentSelect = element('select', 'ai-select ai-agent');
	agentSelect.setAttribute('aria-label', '用哪个 AI');
	const optionSelects = element('div', 'ai-options');
	const usage = element('span', 'ai-usage');
	const send = element('button', 'ai-send', '↑');
	send.type = 'button';
	send.title = '发送（Enter；换行用 Shift+Enter）';
	send.setAttribute('aria-label', '发送');
	bar.append(agentSelect, optionSelects, usage, send);
	composer.append(status, input, bar);
	const sheet = createModelsSheet({
		runInTerminal: (command) => host.runInTerminal(command),
		saved(agent, name) {
			showSheet(false);
			// What was saved is for conversations begun from now on: one begun with that AI, with it.
			if (agentSelect.value === agent) {
				const unused = conversation && !items.length ? conversation : null;
				void begin();
				if (unused) void closeConversation(unused.id).catch(() => {});
			}
			host.toast(name ? `AI 面板的 ${agent === 'pi' ? 'pi' : 'Claude Code'} 改用「${name}」` : '已保存');
		},
	});
	pane.replaceChildren(toolbar, sheet.element, transcript, composer);

	/** 模型和账号 in place of the conversation, or the conversation again. */
	function showSheet(open: boolean): void {
		pane.classList.toggle('is-settings', open);
		if (open) void sheet.show();
		else sheet.hide();
	}

	let agents: Array<{ id: string; name: string }> = [];
	let conversation: Conversation | null = null;
	let items: ConversationItem[] = [];
	const drawn = new Map<string, HTMLElement>();
	let unfollow: (() => void) | null = null;
	let starting: Promise<Conversation | null> | null = null;
	let loaded = false;
	let article: { slug: string; title: string } | null = null;

	// ——— The conversation ———

	async function load(): Promise<void> {
		if (loaded) return;
		loaded = true;
		try {
			const known = await listConversations();
			agents = known.agents;
			const chosen = remembered(AGENT_KEY);
			agentSelect.replaceChildren(...agents.map((agent) => new Option(agent.name, agent.id)));
			agentSelect.value = agents.some((agent) => agent.id === chosen) ? chosen! : agents.some((agent) => agent.id === known.default) ? known.default : agents[0]?.id ?? '';
			if (!agents.length) {
				say('没有能在面板里用的 AI：在「AI 助手」设置里给 Claude 或 Codex 配上 ACP 命令');
				return;
			}
			const kept = known.conversations.find((entry) => entry.id === remembered(CONVERSATION_KEY) && entry.state !== 'closed' && entry.state !== 'failed');
			if (kept) follow(kept);
			else void begin();
		} catch (error) {
			loaded = false;
			say(error instanceof Error ? error.message : '读不到 AI 列表');
		}
	}

	/** A new conversation with the AI chosen, in the article open; the one before goes on in the list. */
	function begin(): Promise<Conversation | null> {
		const agent = agentSelect.value;
		const slug = host.article()?.slug ?? null;
		follow(null);
		say(`正在启动 ${agents.find((entry) => entry.id === agent)?.name ?? 'AI'}…`);
		const started = startConversation(agent, slug).then(chosenAgain).then(
			(made) => {
				if (starting === started) {
					starting = null;
					follow(made);
				}
				return made;
			},
			(error: unknown) => {
				if (starting === started) starting = null;
				say(error instanceof Error ? error.message : '没能启动', true);
				return null;
			},
		);
		starting = started;
		return started;
	}

	/** A conversation just begun, given the options the author chose last time for its AI (those it still has). */
	async function chosenAgain(made: Conversation): Promise<Conversation> {
		let chosen: Record<string, string> = {};
		try {
			chosen = JSON.parse(remembered(OPTIONS_KEY(made.agent.id)) ?? '{}') as Record<string, string>;
		} catch {
			// Kept wrong: as the AI offers them.
		}
		let now = made;
		for (const option of made.configOptions) {
			const value = chosen[option.id];
			if (typeof value !== 'string' || value === option.currentValue || !SHOWN_OPTIONS.includes(option.category ?? option.id)) continue;
			const choices = (option.options ?? []).flatMap((entry) => ('options' in entry ? entry.options : [entry]));
			if (!choices.some((choice) => choice.value === value)) continue;
			now = await setConversationOption(made.id, option.id, value).catch(() => now);
		}
		return now;
	}

	/** Shows `next` (or nothing yet), following it. */
	function follow(next: Conversation | null): void {
		unfollow?.();
		unfollow = null;
		conversation = next;
		items = [];
		drawn.clear();
		list.replaceChildren();
		remember(CONVERSATION_KEY, next?.id ?? null);
		showSession();
		if (next) unfollow = followConversation(next.id, receive);
	}

	function receive(event: ConversationEvent): void {
		switch (event.type) {
			case 'all':
				conversation = event.session;
				items = [...event.items];
				drawn.clear();
				list.replaceChildren(...items.map((item) => draw(item)));
				break;
			case 'item': {
				const at = items.findIndex((entry) => entry.id === event.item.id);
				if (at >= 0) items[at] = event.item;
				else items.push(event.item);
				const old = drawn.get(event.item.id);
				const next = draw(event.item, old);
				if (!old) list.append(next);
				else if (old !== next) old.replaceWith(next);
				break;
			}
			case 'append': {
				const item = items.find((entry) => entry.id === event.id);
				if (item && 'text' in item) {
					item.text += event.text;
					later(item);
				}
				break;
			}
			case 'session':
				conversation = event.session;
				break;
		}
		showSession();
		keepAtBottom();
	}

	/** Words streaming in are drawn again once a frame, not once a piece. */
	const waiting = new Set<ConversationItem>();
	function later(item: ConversationItem): void {
		if (!waiting.size) {
			requestAnimationFrame(() => {
				for (const entry of waiting) {
					const old = drawn.get(entry.id);
					if (old) old.replaceWith(draw(entry, old));
				}
				waiting.clear();
				keepAtBottom();
			});
		}
		waiting.add(item);
	}

	async function submit(): Promise<void> {
		const text = input.value.trim();
		if (!text) return;
		if (conversation?.state === 'running') return;
		let target = conversation;
		if (!target || target.state === 'closed' || target.state === 'failed') target = await (starting ?? begin());
		else if (starting) target = await starting;
		if (!target) return;
		input.value = '';
		grow();
		try {
			await tellConversation(target.id, text);
		} catch (error) {
			input.value = text;
			grow();
			say(error instanceof Error ? error.message : '没发出去', true);
		}
	}

	// ——— What is shown around the transcript ———

	function say(text: string, isError = false): void {
		status.textContent = text;
		status.classList.toggle('is-error', isError);
		// What fails is most often a login or a key: where to set them, right there.
		if (isError) {
			const fix = element('button', 'ai-status-fix', '模型和账号');
			fix.type = 'button';
			fix.addEventListener('click', () => showSheet(true));
			status.append(' ', fix);
		}
	}

	function showSession(): void {
		const running = conversation?.state === 'running';
		title.textContent = conversation?.title || '新对话';
		title.title = title.textContent;
		const place = conversation?.slug ? (conversation.slug === article?.slug ? '在这篇文章里' : `在 ${conversation.slug} 里`) : conversation ? '在仓库里' : '';
		where.textContent = conversation?.service ? `${place} · ${conversation.service}` : place;
		empty.hidden = items.length > 0;
		send.textContent = running ? '■' : '↑';
		send.title = running ? '停下' : '发送（Enter；换行用 Shift+Enter）';
		send.setAttribute('aria-label', running ? '停下' : '发送');
		send.classList.toggle('is-stop', running);
		if (conversation?.state === 'starting' || (!conversation && starting)) {
			// Said by begin().
		} else if (conversation?.state === 'failed') say(conversation.error || '它停了', true);
		else if (conversation?.state === 'closed') say('这个对话已经结束了；再说话会开始新的对话');
		else if (running) say('正在做…');
		else say('');
		const used = conversation?.usage;
		usage.textContent = used ? `${Math.round(used.used / 1000)}k / ${used.size >= 1_000_000 ? `${used.size / 1_000_000}M` : `${Math.round(used.size / 1000)}k`}${used.cost ? ` · $${used.cost.amount.toFixed(2)}` : ''}` : '';
		usage.title = used ? '用掉的上下文 / 上下文上限（· 这次对话花费）' : '';
		showOptions();
	}

	function showOptions(): void {
		const shown = (conversation?.configOptions ?? []).filter((option) => option.type === 'select' && SHOWN_OPTIONS.includes(option.category ?? option.id));
		const key = JSON.stringify(shown.map((option) => [option.id, option.currentValue]));
		if (optionSelects.dataset.key === key) return;
		optionSelects.dataset.key = key;
		optionSelects.replaceChildren(...shown.map((option) => optionSelect(option)));
	}

	function optionSelect(option: ConversationOption): HTMLSelectElement {
		const select = element('select', 'ai-select');
		select.setAttribute('aria-label', option.name);
		select.title = option.description ?? option.name;
		const choices = (option.options ?? []).flatMap((entry) => ('options' in entry ? entry.options : [entry]));
		const named = (value: string, name: string) => (option.category === 'thought_level' ? EFFORT_NAMES[value] ?? `思考：${name}` : option.category === 'mode' ? OPTION_NAMES[value] ?? name : name);
		select.replaceChildren(...choices.map((choice) => new Option(named(choice.value, choice.name), choice.value)));
		select.value = String(option.currentValue);
		select.addEventListener('change', () => {
			if (!conversation) return;
			const agent = conversation.agent.id;
			setConversationOption(conversation.id, option.id, select.value).then(
				(changed) => {
					conversation = changed;
					showSession();
					// Given again to the next conversation with this AI.
					let chosen: Record<string, string> = {};
					try {
						chosen = JSON.parse(remembered(OPTIONS_KEY(agent)) ?? '{}') as Record<string, string>;
					} catch {
						// Kept wrong: started afresh.
					}
					remember(OPTIONS_KEY(agent), JSON.stringify({ ...chosen, [option.id]: select.value }));
				},
				(error: unknown) => {
					select.value = String(option.currentValue);
					host.toast(error instanceof Error ? error.message : '没能改');
				},
			);
		});
		return select;
	}

	function keepAtBottom(): void {
		if (transcript.dataset.away === 'true') return;
		transcript.scrollTop = transcript.scrollHeight;
	}

	transcript.addEventListener('scroll', () => {
		transcript.dataset.away = String(transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight > 40);
	});

	// ——— Each item ———

	/** `item` drawn; `old`, its drawing so far, changed in place where that keeps what the author opened. */
	function draw(item: ConversationItem, old?: HTMLElement): HTMLElement {
		let node: HTMLElement;
		switch (item.kind) {
			case 'user':
				node = element('div', 'ai-user');
				node.append(element('div', 'ai-bubble', item.text));
				break;
			case 'message':
				node = element('div', 'ai-message');
				node.append(renderAiMarkdown(item.text));
				break;
			case 'thought':
				node = drawThought(item, old);
				break;
			case 'tool':
				node = drawTool(item, old);
				break;
			case 'plan':
				node = drawPlan(item);
				break;
			case 'permission':
				node = drawPermission(item);
				break;
			case 'notice':
				node = element('div', `ai-notice is-${item.severity}`);
				node.append(element('strong', '', item.title), element('span', '', item.description ? ` ${item.description}` : ''));
				break;
			case 'stop':
				node = element('div', 'ai-stop', STOP_NAMES[item.reason] ?? `停了（${item.reason}）`);
				break;
			case 'error': {
				node = element('div', 'ai-error', item.message);
				const fix = element('button', 'ai-status-fix', '模型和账号');
				fix.type = 'button';
				fix.addEventListener('click', () => showSheet(true));
				node.append(' ', fix);
				break;
			}
		}
		node.dataset.item = item.id;
		drawn.set(item.id, node);
		return node;
	}

	function drawThought(item: Extract<ConversationItem, { kind: 'thought' }>, old?: HTMLElement): HTMLElement {
		const details = element('details', 'ai-thought');
		const thinking = items.at(-1) === item && conversation?.state === 'running';
		details.open = old instanceof HTMLDetailsElement ? old.open : false;
		details.classList.toggle('is-going', thinking);
		details.append(element('summary', '', thinking ? '思考中…' : '思考过程'), element('div', 'ai-thought-text', item.text));
		return details;
	}

	function drawTool(item: ToolItem, old?: HTMLElement): HTMLElement {
		const node = element('div', 'ai-tool');
		node.dataset.status = item.status;
		node.dataset.kind = item.toolKind;
		const row = element('button', 'ai-tool-row');
		row.type = 'button';
		const command = commandOf(item);
		const label = element('span', `ai-tool-title${command ? ' is-command' : ''}`, command ?? item.title ?? '');
		label.title = label.textContent ?? '';
		const state = element('span', 'ai-tool-state', item.status === 'completed' ? '✓' : item.status === 'failed' ? '✗' : item.status === 'pending' ? '等待' : '');
		state.setAttribute('aria-label', { pending: '等待', in_progress: '进行中', completed: '完成', failed: '失败' }[item.status]);
		row.append(element('span', 'ai-tool-icon', TOOL_ICONS[item.toolKind] ?? TOOL_ICONS.other), label, state);
		const detail = element('div', 'ai-tool-detail');
		const open = old?.classList.contains('is-open') ?? false;
		node.classList.toggle('is-open', open);
		row.setAttribute('aria-expanded', String(open));
		row.addEventListener('click', () => {
			const now = !node.classList.contains('is-open');
			node.classList.toggle('is-open', now);
			row.setAttribute('aria-expanded', String(now));
		});
		const paths = item.locations.map((location) => relative(location.path) + (location.line ? `:${location.line}` : ''));
		if (paths.length && item.toolKind !== 'edit') detail.append(element('p', 'ai-tool-paths', paths.join('  ')));
		for (const content of item.content) {
			if (content.type === 'diff') detail.append(drawDiff(content.path, content.oldText ?? '', content.newText));
			else if (content.type === 'content' && content.content.type === 'text' && content.content.text && content.content.text !== command) {
				const words = element('div', 'ai-tool-text');
				words.append(renderAiMarkdown(content.content.text));
				detail.append(words);
			}
		}
		if (item.output) detail.append(element('pre', 'ai-tool-output', item.output.length > 20_000 ? `…${item.output.slice(-20_000)}` : item.output));
		if (item.exitCode !== null && item.exitCode !== 0) detail.append(element('p', 'ai-tool-exit', `退出码 ${item.exitCode}`));
		node.classList.toggle('has-detail', detail.childElementCount > 0);
		node.append(row, detail);
		return node;
	}

	/** The command a tool call runs, if it runs one. */
	function commandOf(item: ToolItem): string | null {
		const input = item.rawInput as { command?: unknown } | null;
		if (item.toolKind !== 'execute') return null;
		if (typeof input?.command === 'string') return input.command;
		if (Array.isArray(input?.command)) return input.command.join(' ');
		return item.title || null;
	}

	function relative(path: string): string {
		const base = conversation?.cwd ? `${conversation.cwd.replace(/\/$/u, '')}/` : '';
		return base && path.startsWith(base) ? path.slice(base.length) : path;
	}

	/** A change to a file: its lines taken away and put in, those kept in common at either end left out. */
	function drawDiff(path: string, before: string, after: string): HTMLElement {
		const node = element('div', 'ai-diff');
		node.append(element('p', 'ai-diff-path', relative(path)));
		const old = before ? before.split('\n') : [];
		const next = after.split('\n');
		let head = 0;
		while (head < old.length && head < next.length && old[head] === next[head]) head += 1;
		let tail = 0;
		while (tail < old.length - head && tail < next.length - head && old[old.length - 1 - tail] === next[next.length - 1 - tail]) tail += 1;
		const lines = element('pre', 'ai-diff-lines');
		for (const line of old.slice(head, old.length - tail)) lines.append(element('span', 'is-removed', `- ${line}\n`));
		for (const line of next.slice(head, next.length - tail)) lines.append(element('span', 'is-added', `+ ${line}\n`));
		if (!lines.childElementCount) lines.append(element('span', '', '（没有改动）'));
		node.append(lines);
		return node;
	}

	function drawPlan(item: Extract<ConversationItem, { kind: 'plan' }>): HTMLElement {
		const node = element('div', 'ai-plan');
		node.append(element('p', 'ai-plan-title', '计划'));
		const entries = element('ul');
		for (const entry of item.entries) {
			const line = element('li', `is-${entry.status}`);
			line.append(element('span', 'ai-plan-mark', entry.status === 'completed' ? '✓' : entry.status === 'in_progress' ? '◐' : '○'), element('span', '', entry.content));
			entries.append(line);
		}
		node.append(entries);
		return node;
	}

	function drawPermission(item: PermissionItem): HTMLElement {
		const node = element('div', 'ai-permission');
		const tool = items.find((entry): entry is ToolItem => entry.kind === 'tool' && entry.id === item.toolCallId);
		const what = (tool && commandOf(tool)) || item.title || '这一步';
		node.append(element('p', 'ai-permission-ask', '要允许它这么做吗？'), element('code', 'ai-permission-what', what));
		if (item.chosen) {
			const option = item.options.find((entry) => entry.optionId === item.chosen);
			const answer = option ? `已${PERMISSION_NAMES[option.kind] ?? option.name}` : '没有回答（已停止）';
			node.classList.add('is-answered');
			node.append(element('p', 'ai-permission-answer', answer));
			return node;
		}
		const choices = element('div', 'ai-permission-choices');
		for (const option of item.options) {
			const button = element('button', option.kind.startsWith('allow') ? 'is-allow' : 'is-reject', PERMISSION_NAMES[option.kind] ?? option.name);
			button.type = 'button';
			button.title = option.name;
			button.addEventListener('click', () => {
				if (!conversation) return;
				for (const other of choices.querySelectorAll('button')) other.disabled = true;
				answerConversation(conversation.id, item.id, option.optionId).catch((error: unknown) => host.toast(error instanceof Error ? error.message : '没能回答'));
			});
			choices.append(button);
		}
		node.append(choices);
		return node;
	}

	// ——— The input ———

	function grow(): void {
		input.style.height = 'auto';
		input.style.height = `${Math.min(input.scrollHeight, 200)}px`;
	}

	input.addEventListener('input', grow);
	input.addEventListener('keydown', (event) => {
		// Enter sends; not while a Chinese input method is still choosing words.
		if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
		event.preventDefault();
		void submit();
	});
	send.addEventListener('click', () => {
		if (conversation?.state === 'running') void stopConversation(conversation.id).catch((error: unknown) => host.toast(error instanceof Error ? error.message : '没能停下'));
		else void submit();
	});
	agentSelect.addEventListener('change', () => {
		remember(AGENT_KEY, agentSelect.value);
		// Another AI is another conversation; one begun and not yet spoken to is let go.
		const unused = conversation && !items.length ? conversation : null;
		void begin();
		if (unused) void closeConversation(unused.id).catch(() => {});
	});
	newButton.addEventListener('click', () => {
		const unused = conversation && !items.length ? conversation : null;
		void begin().then(() => input.focus());
		if (unused) void closeConversation(unused.id).catch(() => {});
	});
	modelsButton.addEventListener('click', () => showSheet(!sheet.open));
	historyButton.addEventListener('click', () => {
		void listConversations().then((known) => {
			const entries = known.conversations.filter((entry) => entry.id !== conversation?.id);
			const menu: MenuItem[] = entries.length
				? entries.map((entry) => ({
						label: `${entry.title || '（还没说话）'}`,
						hint: `${entry.agent.name}${entry.slug ? ` · ${entry.slug}` : ''}${entry.state === 'running' ? ' · 进行中' : entry.state === 'failed' || entry.state === 'closed' ? ' · 已结束' : ''}`,
						action: () => follow(entry),
					}))
				: [{ label: '还没有别的对话', action: () => {} }];
			showContextMenu(menu, historyButton);
		});
	});

	return {
		/** The tab is on screen: the AIs read, and a conversation begun if none goes on (once). */
		shown(): void {
			void load();
		},
		/** The article open changed (null: none); a conversation begun later goes on in it. */
		showArticle(next: { slug: string; title: string } | null): void {
			article = next;
			showSession();
		},
		/** Puts `text` in the input, for the author to finish and send. */
		ask(text: string): void {
			input.value = text;
			grow();
			input.focus();
		},
	};
}
