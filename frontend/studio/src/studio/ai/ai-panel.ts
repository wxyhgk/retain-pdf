import {
	answerConversation,
	closeConversation,
	deleteConversation,
	followConversation,
	pageConversation,
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
import { STUDIO_MARKDOWN_DRAG_TYPE } from '../files/article-files';
import { observePluginBlocks } from '../plugins';
import { isPicture, pictureUrl, renderAiMarkdown } from './ai-markdown';
import { createModelsSheet } from './ai-models-sheet';
import { showContextMenu, type MenuItem } from '../common/context-menu';

/** What the AI panel needs of the Studio around it. */
export type AiPanelHost = {
	/** The article open, if one is. */
	article(): { slug: string; title: string } | null;
	/** The articles, to name one with @. */
	articles(): Array<{ slug: string; title: string }>;
	/** Whether something is selected in the article open. */
	hasSelection(): boolean;
	/** The lines of the article selected (the article saved first, so they are the file's); null when none. */
	selection(): Promise<{ start: number; end: number; text: string } | null>;
	toast(message: string): void;
	/** Runs a command in the 终端 tab (an account's login). */
	runInTerminal(command: string): void;
	/** Puts Markdown in the article open, where its caret is, as blocks; false when no article is open. */
	insert(markdown: string): boolean;
	/** ⤢: the panel whole, in the middle (AI 问答); ⤡: back in the side. */
	openWhole?(): void;
	closeWhole?(): void;
	/** Another conversation shown (chosen, begun): the one AI 问答 lists as shown. */
	followed?(id: string): void;
	/** The conversation shown was given a title, or spoken in (listed anew). */
	changed?(id: string): void;
	/** Its turn is over (done, stopped, failed): what it changed on disk meanwhile can be looked over now. */
	turnOver?(): void;
};

type ToolItem = Extract<ConversationItem, { kind: 'tool' }>;
type PermissionItem = Extract<ConversationItem, { kind: 'permission' }>;

const CONVERSATION_KEY = 'studio.ai.conversation';

/** When a conversation was last spoken in: the time today, else the day (and the year, another year's). */
function when(iso: string | undefined): string {
	const date = new Date(iso ?? '');
	if (Number.isNaN(date.getTime())) return '';
	const now = new Date();
	const pad = (value: number) => String(value).padStart(2, '0');
	if (date.toDateString() === now.toDateString()) return `今天 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
	return `${date.getFullYear() === now.getFullYear() ? '' : `${date.getFullYear()}-`}${date.getMonth() + 1}-${date.getDate()}`;
}
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
/** What each kind of tool call did, counted in a stretch of work: 读了 3 个文件. */
const TOOL_DONE: Record<string, (count: number) => string> = {
	read: (count) => `读了 ${count} 个文件`,
	execute: (count) => `运行了 ${count} 个命令`,
	search: (count) => `搜索 ${count} 次`,
	fetch: (count) => `查了 ${count} 个网页`,
	delete: (count) => `删了 ${count} 个文件`,
	move: (count) => `移动 ${count} 个文件`,
};
/** What a tool call going on is doing: 正在运行 echo hi. */
const TOOL_DOING: Record<string, string> = { read: '正在读', edit: '正在改', execute: '正在运行', search: '正在搜索', fetch: '正在查', delete: '正在删除', move: '正在移动' };
/** Items that are work toward an answer (thinking, tools, the plan): a stretch of them is one row, opened in a dialog. */
const WORK_KINDS = new Set(['thought', 'tool', 'plan']);
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
	/** Shown whole in the middle (AI 问答, as Notion's), not in the side: the same panel, wider (setFull). */
	let full = false;
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
	const pageButton = element('button', '', '⤢');
	pageButton.type = 'button';
	pageButton.title = '在页面中打开（AI 问答）';
	pageButton.setAttribute('aria-label', '在页面中打开');
	actions.append(pageButton, modelsButton, historyButton, newButton);
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
	input.placeholder = '让 AI 做点什么…（@ 提到别的文章）';
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
	// What is told with what is said: the article open (followed as another is opened), what is selected in it, the
	// articles named with @. Each taken off by its ×.
	const contextRow = element('div', 'ai-context');
	const mentionMenu = element('div', 'ai-mention-menu');
	mentionMenu.setAttribute('role', 'listbox');
	mentionMenu.hidden = true;
	composer.append(status, contextRow, mentionMenu, input, bar);
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
	/** The AIs and conversations read (once; again after a failure): what is said waits for it. */
	let loading: Promise<void> | null = null;
	/** The conversation chosen being found, to be followed (open): what is said waits for it. */
	let showing: Promise<void> = Promise.resolve();
	/** A conversation was asked for (open, newChat): none is begun or taken up by itself once the list is read. */
	let asked = false;
	let article: { slug: string; title: string } | null = null;
	/** The article left out of what is told (its × clicked), till another is opened. */
	let leftOut: string | null = null;
	/** The selection left out (its × clicked), till something else is selected. */
	let selectionLeftOut = false;
	let mentions: Array<{ slug: string; title: string }> = [];

	// ——— The conversation ———

	function load(): Promise<void> {
		loading ??= read();
		return loading;
	}

	async function read(): Promise<void> {
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
			// The one left open, kept in chats/ across restarts.
			const kept = known.conversations.find((entry) => entry.id === remembered(CONVERSATION_KEY));
			// Spoken to while the list was read, or one asked for (open, newChat): that one is the one.
			if (conversation || starting || asked) return;
			if (kept) follow(kept);
			else void begin();
		} catch (error) {
			loading = null;
			say(error instanceof Error ? error.message : '读不到 AI 列表');
		}
	}

	/** A new conversation with the AI chosen, in the article open; the one before goes on in the list. */
	function begin(): Promise<Conversation | null> {
		const agent = agentSelect.value;
		follow(null);
		say(`正在启动 ${agents.find((entry) => entry.id === agent)?.name ?? 'AI'}…`);
		// Listed (AI 问答) once something is said in it, not before.
		const started = startConversation(agent).then(chosenAgain).then(
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
		if (next) host.followed?.(next.id);
		showSession();
		if (next) unfollow = followConversation(next.id, receive);
	}

	function receive(event: ConversationEvent): void {
		switch (event.type) {
			case 'all':
				conversation = event.session;
				items = [...event.items];
				drawn.clear();
				workRows.clear();
				break;
			case 'item': {
				// Something said: the conversation is listed now.
				if (event.item.kind === 'user' && conversation) host.changed?.(conversation.id);
				const at = items.findIndex((entry) => entry.id === event.item.id);
				if (at >= 0) items[at] = event.item;
				else items.push(event.item);
				const old = drawn.get(event.item.id);
				const next = draw(event.item, old);
				if (old && old !== next) old.replaceWith(next);
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
			case 'session': {
				const before = conversation;
				conversation = event.session;
				if (before?.id === conversation.id && (before.title !== conversation.title || before.updated !== conversation.updated)) host.changed?.(conversation.id);
				if (before?.state === 'running' && conversation.state !== 'running') host.turnOver?.();
				break;
			}
		}
		thoughtsOver();
		if (event.type !== 'append') layout();
		showSession();
		keepAtBottom();
	}

	/** A thought drawn as going on (思考中…) once something came after it, or the turn is over: drawn again as done. */
	function thoughtsOver(): void {
		for (const item of items) {
			const node = drawn.get(item.id);
			if (item.kind !== 'thought' || !node?.classList.contains('is-going') || (items.at(-1) === item && conversation?.state === 'running')) continue;
			node.replaceWith(draw(item, node));
		}
	}

	// ——— Work (thinking, tools, the plan): one row a stretch, its detail in a dialog ———

	/** Each stretch's row, by its first item's id. */
	const workRows = new Map<string, HTMLElement>();
	// A picture in what is said or in a step, clicked: whole, over everything; a click or Esc closes it.
	const pictureDialog = element('dialog', 'ai-picture-dialog');
	pictureDialog.setAttribute('aria-label', '图片');
	const pictureWhole = element('img');
	pictureDialog.append(pictureWhole);
	document.body.append(pictureDialog);
	pictureDialog.addEventListener('click', () => pictureDialog.close());
	const showWhole = (event: MouseEvent) => {
		const picture = (event.target as Element | null)?.closest?.<HTMLImageElement>('.ai-message img, .ai-tool-picture');
		if (!picture) return;
		event.preventDefault();
		pictureWhole.src = picture.src;
		pictureWhole.alt = picture.alt;
		pictureDialog.showModal();
	};
	list.addEventListener('click', showWhole);
	// What the plugins' previews leave to be drawn (a molecule's 3D view, a widget's frame), drawn here too.
	void observePluginBlocks(list);

	/** The pictures shown small on the rows, by their paths. */
	const thumbnails = new Map<string, HTMLImageElement>();
	const workDialog = element('dialog', 'ai-pane ai-work-dialog');
	workDialog.setAttribute('aria-label', '过程');
	const workHead = element('header', 'ai-work-head');
	const workTitle = element('strong', 'ai-work-title');
	const workClose = element('button', 'ai-work-close', '×');
	workClose.type = 'button';
	workClose.setAttribute('aria-label', '关闭');
	workHead.append(workTitle, workClose);
	const workBody = element('div', 'ai-work-body');
	workBody.addEventListener('click', (event) => showWhole(event));
	void observePluginBlocks(workBody);
	workDialog.append(workHead, workBody);
	document.body.append(workDialog);
	/** The stretch shown in the dialog, by its first item's id. */
	let workShown: string | null = null;
	workClose.addEventListener('click', () => workDialog.close());
	// A click outside it (on the backdrop, which is the dialog itself) closes it.
	workDialog.addEventListener('click', (event) => {
		if (event.target === workDialog) workDialog.close();
	});
	workDialog.addEventListener('close', () => {
		workShown = null;
	});

	/** The stretches of work, each the items between what is said, asked or told. */
	function stretches(): ConversationItem[][] {
		const found: ConversationItem[][] = [];
		let run: ConversationItem[] = [];
		for (const item of items) {
			if (WORK_KINDS.has(item.kind)) run.push(item);
			else if (run.length) {
				found.push(run);
				run = [];
			}
		}
		if (run.length) found.push(run);
		return found;
	}

	/** The list as the conversation has it: what is said as it is, each stretch of work one row. */
	function layout(): void {
		const runs = new Map(stretches().map((run) => [run[0]!.id, run]));
		const nodes: HTMLElement[] = [];
		for (const item of items) {
			const run = runs.get(item.id);
			if (run) nodes.push(workRow(run));
			else if (!WORK_KINDS.has(item.kind)) nodes.push(drawn.get(item.id) ?? draw(item));
		}
		for (const key of [...workRows.keys()]) if (!runs.has(key)) workRows.delete(key);
		if (nodes.length !== list.children.length || nodes.some((node, at) => list.children[at] !== node)) list.replaceChildren(...nodes);
		if (workShown) {
			const run = runs.get(workShown);
			if (run) fillWork(run);
			else workDialog.close();
		}
	}

	/** The row of a stretch: what it did (读了 3 个文件 · 运行了 1 个命令), or what it is doing now; opened, its detail. */
	function workRow(run: ConversationItem[]): HTMLElement {
		const key = run[0]!.id;
		let row = workRows.get(key);
		if (!row) {
			const button = element('button', 'ai-work');
			button.type = 'button';
			row = button;
			row.addEventListener('click', () => {
				workShown = key;
				const now = stretches().find((entry) => entry[0]!.id === key);
				if (now) fillWork(now);
				workDialog.showModal();
			});
			workRows.set(key, row);
		}
		const { text, going, failed } = workSummary(run);
		row.classList.toggle('is-going', going);
		row.title = '点开看过程';
		// The pictures it looked at, small: what it saw, in sight without opening.
		const pictures = [...new Set(run.flatMap((item) => (item.kind === 'tool' ? picturesOf(item) : [])))].slice(0, 4).map((path) => {
			// The same one each time the row is drawn again, not asked for again.
			let picture = thumbnails.get(path);
			if (!picture) {
				picture = element('img', 'ai-work-picture');
				picture.src = pictureUrl(path);
				picture.alt = '';
				thumbnails.set(path, picture);
			}
			return picture;
		});
		row.replaceChildren(element('span', 'ai-work-icon', going ? '' : '⚙'), element('span', 'ai-work-text', text), ...(failed ? [element('span', 'ai-work-failed', `${failed} 步失败`)] : []), ...pictures, element('span', 'ai-work-more', '›'));
		return row;
	}

	function workSummary(run: ConversationItem[]): { text: string; going: boolean; failed: number } {
		const tools = run.filter((item): item is ToolItem => item.kind === 'tool');
		const failed = tools.filter((tool) => tool.status === 'failed').length;
		const last = run.at(-1)!;
		const going = conversation?.state === 'running' && items.at(-1) === last;
		if (going) {
			if (last.kind === 'tool') return { text: `${TOOL_DOING[last.toolKind] ?? '正在做'} ${commandOf(last) ?? (last.title || '…')}`, going, failed };
			return { text: last.kind === 'plan' ? '正在定计划…' : '正在思考…', going, failed };
		}
		const parts: string[] = [];
		if (run.some((item) => item.kind === 'thought')) parts.push('思考');
		const byKind = new Map<string, ToolItem[]>();
		for (const tool of tools) byKind.set(tool.toolKind, [...(byKind.get(tool.toolKind) ?? []), tool]);
		for (const [kind, those] of byKind) {
			if (kind === 'edit') {
				const files = [...new Set(those.flatMap((tool) => [...tool.locations.map((location) => location.path), ...tool.content.flatMap((content) => (content.type === 'diff' ? [content.path] : []))]).map((path) => relative(path).split('/').pop()!))];
				parts.push(files.length ? `改了 ${files.slice(0, 2).join('、')}${files.length > 2 ? ` 等 ${files.length} 个文件` : ''}` : `改了 ${those.length} 处`);
			} else {
				parts.push((TOOL_DONE[kind] ?? ((count: number) => `${count} 个其他操作`))(those.length));
			}
		}
		const plan = run.find((item): item is Extract<ConversationItem, { kind: 'plan' }> => item.kind === 'plan');
		if (plan) parts.push(`计划 ${plan.entries.filter((entry) => entry.status === 'completed').length}/${plan.entries.length}`);
		return { text: parts.join(' · ') || '过程', going, failed };
	}

	/** The dialog shows this stretch: each step as the panel draws it (thinking, a command and its output, a change). */
	function fillWork(run: ConversationItem[]): void {
		workTitle.textContent = workSummary(run).text;
		const nodes = run.map((item) => drawn.get(item.id) ?? draw(item));
		if (nodes.length !== workBody.children.length || nodes.some((node, at) => workBody.children[at] !== node)) workBody.replaceChildren(...nodes);
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
		if (conversation?.state === 'running') {
			// While it works: to one that can take it, words it reads once its step is done (插话).
			if (conversation.canSteer) await steer(conversation.id, text);
			return;
		}
		// Said before the AIs were read (the tab just opened), or before the conversation chosen is followed: that first.
		await load();
		await showing;
		let target = conversation;
		// One over goes on (its agent started again), unless nothing was said in it.
		if (!target || ((target.state === 'closed' || target.state === 'failed') && !items.length)) target = await (starting ?? begin());
		else if (starting) target = await starting;
		if (!target) return;
		const open = article && leftOut !== article.slug ? article : null;
		const selection = open && !selectionLeftOut && host.hasSelection() ? await host.selection() : null;
		const named = mentions;
		input.value = '';
		mentions = [];
		grow();
		showContext();
		try {
			await tellConversation(target.id, text, {
				...(open ? { article: open.slug } : {}),
				...(selection ? { selection } : {}),
				...(named.length ? { mentions: named.map((entry) => entry.slug) } : {}),
			});
		} catch (error) {
			input.value = text;
			mentions = named;
			grow();
			showContext();
			say(error instanceof Error ? error.message : '没发出去', true);
		}
	}

	async function steer(id: string, text: string): Promise<void> {
		input.value = '';
		grow();
		try {
			await tellConversation(id, text, {}, { steer: true });
		} catch (error) {
			input.value = text;
			grow();
			say(error instanceof Error ? error.message : '没发出去', true);
		}
	}

	// ——— What is told with what is said ———

	function chip(label: string, title: string, remove: () => void): HTMLElement {
		const node = element('span', 'ai-chip');
		node.title = title;
		const drop = element('button', 'ai-chip-remove', '×');
		drop.type = 'button';
		drop.setAttribute('aria-label', `不带上${label}`);
		drop.addEventListener('click', () => {
			remove();
			showContext();
			input.focus();
		});
		node.append(element('span', 'ai-chip-label', label), drop);
		return node;
	}

	function showContext(): void {
		const chips: HTMLElement[] = [];
		const open = article && leftOut !== article.slug ? article : null;
		if (open) chips.push(chip(`📄 ${open.title}`, '当前文章：说话时会告诉 AI 你在看这篇', () => (leftOut = open.slug)));
		if (open && !selectionLeftOut && host.hasSelection()) chips.push(chip('选中的内容', '文章里选中的那几行会一起告诉 AI', () => (selectionLeftOut = true)));
		for (const entry of mentions) chips.push(chip(`@ ${entry.title}`, '用 @ 提到的文章', () => (mentions = mentions.filter((other) => other !== entry))));
		contextRow.replaceChildren(...chips);
		contextRow.hidden = !chips.length;
	}

	/** What follows an @ before the caret, if the author is naming an article. */
	function naming(): { from: number; query: string } | null {
		const before = input.value.slice(0, input.selectionStart ?? input.value.length);
		const found = /(^|\s)@([^\s@]*)$/u.exec(before);
		return found ? { from: before.length - found[2].length - 1, query: found[2] } : null;
	}

	let mentionChoices: Array<{ slug: string; title: string }> = [];
	let mentionAt = 0;

	function showMentions(): void {
		const asked = naming();
		if (!asked) {
			mentionMenu.hidden = true;
			return;
		}
		const needle = asked.query.toLocaleLowerCase('zh-CN');
		mentionChoices = host
			.articles()
			.filter((entry) => !mentions.some((named) => named.slug === entry.slug))
			.filter((entry) => !needle || entry.title.toLocaleLowerCase('zh-CN').includes(needle) || entry.slug.includes(needle))
			.slice(0, 8);
		mentionAt = Math.min(mentionAt, Math.max(0, mentionChoices.length - 1));
		if (!mentionChoices.length) {
			mentionMenu.hidden = true;
			return;
		}
		mentionMenu.replaceChildren(
			...mentionChoices.map((entry, index) => {
				const option = element('button', `ai-mention${index === mentionAt ? ' is-current' : ''}`);
				option.type = 'button';
				option.setAttribute('role', 'option');
				option.setAttribute('aria-selected', String(index === mentionAt));
				option.append(element('span', '', entry.title), element('span', 'ai-mention-slug', entry.slug));
				// Chosen before the input loses its caret.
				option.addEventListener('mousedown', (event) => {
					event.preventDefault();
					mention(entry);
				});
				return option;
			}),
		);
		mentionMenu.hidden = false;
	}

	/** `entry` named: the @ and what was typed after it taken out of the input, the article a chip. */
	function mention(entry: { slug: string; title: string }): void {
		const asked = naming();
		if (asked) {
			const caret = input.selectionStart ?? input.value.length;
			input.value = `${input.value.slice(0, asked.from)}${input.value.slice(caret)}`;
			input.setSelectionRange(asked.from, asked.from);
		}
		mentions = [...mentions, entry];
		mentionMenu.hidden = true;
		mentionAt = 0;
		grow();
		showContext();
	}

	// The selection in the article, followed: a chip while there is one.
	let lastSelected = false;
	function followSelection(): void {
		const selected = host.hasSelection();
		if (selected === lastSelected) return;
		lastSelected = selected;
		if (selected) selectionLeftOut = false;
		showContext();
	}
	document.addEventListener('selectionchange', followSelection);

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
		where.textContent = conversation?.service ?? '';
		empty.hidden = items.length > 0;
		send.textContent = running ? '■' : '↑';
		send.title = running ? '停下' : '发送（Enter；换行用 Shift+Enter）';
		send.setAttribute('aria-label', running ? '停下' : '发送');
		send.classList.toggle('is-stop', running);
		// While it works, to one that can take it: what is typed is a word in between (Enter), taken once its step is done.
		input.placeholder = running && conversation?.canSteer ? '插话：它做完手头这一步就会看到（Enter）' : '让 AI 做点什么…（@ 提到别的文章）';
		if (conversation?.state === 'starting' && items.length) say(`正在接上之前的对话（启动 ${conversation.agent.name}）…`);
		else if (conversation?.state === 'starting' || (!conversation && starting)) {
			// Said by begin().
		} else if (conversation?.state === 'failed') say(conversation.error || '它停了', true);
		else if (conversation?.state === 'closed') say('这个对话停下了；再说话会接着聊');
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
			case 'user': {
				node = element('div', 'ai-user');
				node.append(element('div', 'ai-bubble', item.text));
				if (item.steer) node.append(element('div', 'ai-user-context', '插话'));
				const told = item.context;
				const names = [told?.article ? `📄 ${told.article}${told.selection ? ` · ${told.selection}` : ''}` : '', ...(told?.mentions ?? []).map((title) => `@ ${title}`)].filter(Boolean);
				if (names.length) {
					const row = element('div', 'ai-user-context');
					row.append(...names.map((name) => element('span', 'ai-chip-label', name)));
					node.append(row);
				}
				break;
			}
			case 'message':
				node = drawMessage(item);
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
				// Nothing said: asked to say it, while it is the last thing in the conversation.
				if (item.resume && items.at(-1)?.id === item.id) {
					const resume = element('button', 'ai-status-fix', '接着说');
					resume.type = 'button';
					resume.addEventListener('click', () => {
						input.value = '接着说：把你刚才的结论告诉我。';
						void submit();
					});
					node.append(' ', resume);
				}
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

	/**
	 * What the AI said, block by block as in an article: each with a handle at its left to drag it into the article
	 * (or click, to put it where the caret is); under it, all of it put in, or copied as Markdown.
	 */
	function drawMessage(item: Extract<ConversationItem, { kind: 'message' }>): HTMLElement {
		const node = element('div', 'ai-answer');
		const words = element('div', 'ai-message');
		words.append(renderAiMarkdown(item.text, { blocks: true }));
		node.append(words);
		for (const block of words.querySelectorAll<HTMLElement>(':scope > .ai-block[data-markdown]')) {
			const markdown = block.dataset.markdown!;
			const handle = element('button', 'ai-block-handle');
			handle.type = 'button';
			handle.draggable = true;
			handle.title = '拖到文章里；点一下插入到光标处';
			handle.setAttribute('aria-label', '插入这一块到文章');
			handle.addEventListener('dragstart', (event) => {
				if (!event.dataTransfer) return;
				event.dataTransfer.setData(STUDIO_MARKDOWN_DRAG_TYPE, markdown);
				event.dataTransfer.setData('text/plain', markdown);
				event.dataTransfer.effectAllowed = 'copy';
				event.dataTransfer.setDragImage(block, 0, 0);
				block.classList.add('is-dragged');
			});
			handle.addEventListener('dragend', () => block.classList.remove('is-dragged'));
			handle.addEventListener('click', () => insertInArticle(markdown));
			block.prepend(handle);
		}
		if (item.text.trim()) {
			const actions = element('div', 'ai-message-actions');
			const insertAll = element('button', '', '插入到文章');
			insertAll.type = 'button';
			insertAll.addEventListener('click', () => insertInArticle(item.text.trim()));
			const copy = element('button', '', '复制');
			copy.type = 'button';
			copy.addEventListener('click', () => {
				navigator.clipboard.writeText(item.text.trim()).then(() => host.toast('已复制 Markdown'), () => host.toast('没能复制'));
			});
			actions.append(insertAll, copy);
			node.append(actions);
		}
		return node;
	}

	function insertInArticle(markdown: string): void {
		host.toast(host.insert(markdown) ? '已插入到文章' : '先打开一篇文章');
	}

	function drawThought(item: Extract<ConversationItem, { kind: 'thought' }>, old?: HTMLElement): HTMLElement {
		const details = element('details', 'ai-thought');
		const thinking = items.at(-1) === item && conversation?.state === 'running';
		// In the dialog of its stretch: open, as it is opened to be read.
		details.open = old instanceof HTMLDetailsElement ? old.open : true;
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
		// A picture it looked at (read): shown, as the agent saw it.
		for (const path of picturesOf(item)) {
			const picture = element('img', 'ai-tool-picture');
			picture.src = pictureUrl(path);
			picture.alt = relative(path);
			detail.append(picture);
		}
		if (item.output) detail.append(element('pre', 'ai-tool-output', item.output.length > 20_000 ? `…${item.output.slice(-20_000)}` : item.output));
		if (item.exitCode !== null && item.exitCode !== 0) detail.append(element('p', 'ai-tool-exit', `退出码 ${item.exitCode}`));
		node.classList.toggle('has-detail', detail.childElementCount > 0);
		node.append(row, detail);
		return node;
	}

	/** The pictures a tool call read (a plot the agent drew, looked at): their paths. */
	function picturesOf(item: ToolItem): string[] {
		if (item.toolKind !== 'read') return [];
		const input = item.rawInput as { path?: unknown; file_path?: unknown } | null;
		const paths = [...item.locations.map((location) => location.path), input?.path, input?.file_path].filter((path): path is string => typeof path === 'string' && isPicture(path));
		return [...new Set(paths)];
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

	input.addEventListener('input', () => {
		grow();
		showMentions();
	});
	input.addEventListener('blur', () => {
		mentionMenu.hidden = true;
	});
	input.addEventListener('keydown', (event) => {
		// Choosing an article to name.
		if (!mentionMenu.hidden && !event.isComposing) {
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				event.preventDefault();
				mentionAt = (mentionAt + (event.key === 'ArrowDown' ? 1 : mentionChoices.length - 1)) % mentionChoices.length;
				showMentions();
				return;
			}
			if (event.key === 'Enter' || event.key === 'Tab') {
				event.preventDefault();
				const chosen = mentionChoices[mentionAt];
				if (chosen) mention(chosen);
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				mentionMenu.hidden = true;
				return;
			}
		}
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
	// ⤢: the panel whole, in the middle; the conversation listed there (in chats/) though nothing was said yet. ⤡: back.
	pageButton.addEventListener('click', () => {
		if (full) return host.closeWhole?.();
		const shown = conversation;
		// Listed there once it is kept.
		void (shown ? pageConversation(shown.id).catch(() => null) : Promise.resolve(null)).then(() => host.openWhole?.());
	});
	historyButton.addEventListener('click', () => {
		void listConversations().then((known) => {
			const entries = known.conversations.filter((entry) => entry.id !== conversation?.id);
			const menu: MenuItem[] = entries.length
				? entries.map((entry) => ({
						label: `${entry.title || '（还没说话）'}`,
						hint: `${entry.agent.name} · ${when(entry.updated)}${entry.state === 'running' ? ' · 进行中' : ''}`,
						action: () => follow(entry),
					}))
				: [{ label: '还没有别的对话', action: () => {} }];
			// The one shown, gone (its folder of chats/ too), after asking.
			const shown = conversation;
			if (shown && items.length) {
				menu.push({
					label: '删除这个对话',
					action: () => {
						if (!window.confirm(`删除对话「${shown.title || '新对话'}」？\n它在 chats/ 里的记录也会删掉，不能恢复。`)) return;
						void deleteConversation(shown.id).then(
							() => void begin(),
							(error: unknown) => host.toast(error instanceof Error ? error.message : '没能删除'),
						);
					},
				});
			}
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
			if (next?.slug !== article?.slug) {
				leftOut = null;
				selectionLeftOut = false;
			}
			article = next;
			showSession();
			showContext();
		},
		/**
		 * The editor shown another article (after showArticle, which comes first): what was selected in the last one
		 * gone, which WebKit tells no selectionchange of.
		 */
		articleShown(): void {
			followSelection();
		},
		/** Shown whole in the middle (AI 问答), or in the side: the same panel, its ⤢ then ⤡. */
		setFull(on: boolean): void {
			full = on;
			pane.classList.toggle('is-full', on);
			pageButton.textContent = on ? '⤡' : '⤢';
			pageButton.title = on ? '收回到右边' : '在页面中打开（AI 问答）';
			pageButton.setAttribute('aria-label', on ? '收回到右边' : '在页面中打开');
			if (on) void load();
		},
		/** Whether the AI is at work (a turn going on), changing files perhaps. */
		working(): boolean {
			return conversation?.state === 'running';
		},
		/** The conversation shown (null: none yet). */
		current(): string | null {
			return conversation?.id ?? null;
		},
		/** The conversation `id` shown, followed. */
		open(id: string): Promise<void> {
			asked = true;
			if (conversation?.id === id) return showing;
			follow(null);
			showing = (async () => {
				try {
					await load();
					const entry = (await listConversations()).conversations.find((candidate) => candidate.id === id);
					if (entry) follow(entry);
					else say('找不到这个对话（可能已经删了）', true);
				} catch (error) {
					say(error instanceof Error ? error.message : '读不到对话', true);
				}
			})();
			return showing;
		},
		/** A new conversation, with the AI chosen and its options (listed at once when whole); its id, once begun. */
		async newChat(): Promise<string | null> {
			asked = true;
			await load();
			// The one shown, never spoken to, let go: no empty 新对话 left behind.
			const unused = conversation && !items.length ? conversation : null;
			// What is typed meanwhile is said in it, once it is there (submit waits for `starting`).
			const made = begin();
			if (unused) void closeConversation(unused.id).catch(() => {});
			return (await made)?.id ?? null;
		},
		focus(): void {
			input.focus();
		},
		/** Puts `text` in the input, for the author to finish and send. */
		ask(text: string): void {
			input.value = text;
			grow();
			input.focus();
		},
	};
}

/** The AI chosen in the panel (the one asked by the AI in the editor too), and the options chosen for it. */
export function chosenAI(): { agent: string; options: Record<string, string> } {
	const agent = remembered(AGENT_KEY) || 'claude';
	try {
		return { agent, options: JSON.parse(remembered(OPTIONS_KEY(agent)) ?? '{}') as Record<string, string> };
	} catch {
		return { agent, options: {} };
	}
}
