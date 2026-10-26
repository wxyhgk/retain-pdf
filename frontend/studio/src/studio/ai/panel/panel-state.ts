import {
	answerConversation,
	closeConversation,
	deleteConversation,
	followConversation,
	listConversations,
	pageConversation,
	setConversationOption,
	startConversation,
	stopConversation,
	tellConversation,
	type Conversation,
	type ConversationEvent,
	type ConversationItem,
} from '../../api/client';
import { showContextMenu, type MenuItem } from '../../common/context-menu';
import { createStore, type Store } from '../../shell/store';
import type { ModelsSheetHost } from './ModelsSheet';

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

export type ArticleRef = { slug: string; title: string };

/** What the panel shows (AiPanel.tsx draws it). */
export type PanelState = {
	agents: Array<{ id: string; name: string }>;
	/** The AI chosen for what is begun next. */
	agent: string;
	conversation: Conversation | null;
	items: ConversationItem[];
	/** A conversation being begun (said by `status` meanwhile). */
	starting: boolean;
	status: { text: string; error: boolean };
	/** 模型和账号 in place of the conversation. */
	settings: boolean;
	/** Whole in the middle (AI 问答). */
	full: boolean;
	/** What is told with what is said: the article open (unless left out), whether something is selected in it (and not left out), the articles named with @. */
	article: ArticleRef | null;
	leftOut: string | null;
	selected: boolean;
	selectionLeftOut: boolean;
	mentions: ArticleRef[];
	/** What is typed. */
	draft: string;
	/** Asked to take the keys (focus): counted, so each ask is one. */
	focusAsked: number;
};

const CONVERSATION_KEY = 'studio.ai.conversation';
const AGENT_KEY = 'studio.ai.agent';
/** The options shown under the input, in this order: who decides, which model, how hard it thinks. */
export const SHOWN_OPTIONS = ['mode', 'model', 'thought_level'];
/** The options the author chose for an AI, given again to each conversation begun with it. */
const OPTIONS_KEY = (agent: string) => `studio.ai.options.${agent}`;

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

/** When a conversation was last spoken in: the time today, else the day (and the year, another year's). */
function when(iso: string | undefined): string {
	const date = new Date(iso ?? '');
	if (Number.isNaN(date.getTime())) return '';
	const now = new Date();
	const pad = (value: number) => String(value).padStart(2, '0');
	if (date.toDateString() === now.toDateString()) return `今天 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
	return `${date.getFullYear() === now.getFullYear() ? '' : `${date.getFullYear()}-`}${date.getMonth() + 1}-${date.getDate()}`;
}

export type PanelActions = ReturnType<typeof createPanelState>['actions'];

/**
 * The AI panel's conversation and what goes with it: which AI, the conversation followed (server/ai/agent-sessions.mjs,
 * over the Agent Client Protocol), what is typed and told with it. The panel (AiPanel.tsx) draws `store`; its buttons
 * call `actions`.
 */
export function createPanelState(pane: HTMLElement, host: AiPanelHost) {
	const store: Store<PanelState> = createStore<PanelState>({
		agents: [],
		agent: '',
		conversation: null,
		items: [],
		starting: false,
		status: { text: '', error: false },
		settings: false,
		full: false,
		article: null,
		leftOut: null,
		selected: false,
		selectionLeftOut: false,
		mentions: [],
		draft: '',
		focusAsked: 0,
	});
	const get = store.get;
	const set = store.set;

	let unfollow: (() => void) | null = null;
	let starting: Promise<Conversation | null> | null = null;
	/** The AIs and conversations read (once; again after a failure): what is said waits for it. */
	let loading: Promise<void> | null = null;
	/** The conversation chosen being found, to be followed (open): what is said waits for it. */
	let showing: Promise<void> = Promise.resolve();
	/** A conversation was asked for (open, newChat): none is begun or taken up by itself once the list is read. */
	let asked = false;

	/** What 模型和账号 tells: a service saved for `agent`, for conversations begun with it from now on. */
	const sheetHost: ModelsSheetHost = {
		runInTerminal: (command) => host.runInTerminal(command),
		saved(agent, name) {
			showSheet(false);
			// What was saved is for conversations begun from now on: one begun with that AI, with it.
			if (get().agent === agent) beginAfresh();
			host.toast(name ? `AI 面板的 ${agent === 'pi' ? 'pi' : 'Claude Code'} 改用「${name}」` : '已保存');
		},
	};

	function say(text: string, error = false): void {
		set({ status: { text, error } });
	}

	/** 模型和账号 in place of the conversation, or the conversation again. */
	function showSheet(open: boolean): void {
		pane.classList.toggle('is-settings', open);
		set({ settings: open });
	}

	function load(): Promise<void> {
		loading ??= read();
		return loading;
	}

	async function read(): Promise<void> {
		try {
			const known = await listConversations();
			const chosen = remembered(AGENT_KEY);
			const agents = known.agents;
			set({ agents, agent: agents.some((agent) => agent.id === chosen) ? chosen! : agents.some((agent) => agent.id === known.default) ? known.default : (agents[0]?.id ?? '') });
			if (!agents.length) {
				say('没有能在面板里用的 AI：在「AI 助手」设置里给 Claude 或 Codex 配上 ACP 命令');
				return;
			}
			// The one left open, kept in chats/ across restarts.
			const kept = known.conversations.find((entry) => entry.id === remembered(CONVERSATION_KEY));
			// Spoken to while the list was read, or one asked for (open, newChat): that one is the one.
			if (get().conversation || starting || asked) return;
			if (kept) follow(kept);
			else void begin();
		} catch (error) {
			loading = null;
			say(error instanceof Error ? error.message : '读不到 AI 列表');
		}
	}

	/** A new conversation with the AI chosen, in the article open; the one before goes on in the list. */
	function begin(): Promise<Conversation | null> {
		const agent = get().agent;
		follow(null);
		set({ starting: true });
		say(`正在启动 ${get().agents.find((entry) => entry.id === agent)?.name ?? 'AI'}…`);
		// Listed (AI 问答) once something is said in it, not before.
		const started = startConversation(agent).then(chosenAgain).then(
			(made) => {
				if (starting === started) {
					starting = null;
					set({ starting: false });
					follow(made);
				}
				return made;
			},
			(error: unknown) => {
				if (starting === started) {
					starting = null;
					set({ starting: false });
				}
				say(error instanceof Error ? error.message : '没能启动', true);
				return null;
			},
		);
		starting = started;
		return started;
	}

	/** Another conversation begun; the one shown, never spoken to, let go (no empty 新对话 left behind). */
	function beginAfresh(): Promise<Conversation | null> {
		const { conversation, items } = get();
		const unused = conversation && !items.length ? conversation : null;
		const made = begin();
		if (unused) void closeConversation(unused.id).catch(() => {});
		return made;
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
		set({ conversation: next, items: [] });
		remember(CONVERSATION_KEY, next?.id ?? null);
		if (next) host.followed?.(next.id);
		sessionSaid();
		if (next) unfollow = followConversation(next.id, receive);
	}

	/** Words streaming in, by item: drawn once a frame, not once a piece. */
	const pieces = new Map<string, string>();
	let frame = 0;
	function flushPieces(): void {
		frame = 0;
		if (!pieces.size) return;
		set({ items: get().items.map((item) => (pieces.has(item.id) && 'text' in item ? { ...item, text: item.text + pieces.get(item.id)! } : item)) });
		pieces.clear();
	}

	function receive(event: ConversationEvent): void {
		if (event.type !== 'append') flushPieces();
		switch (event.type) {
			case 'all':
				set({ conversation: event.session, items: [...event.items] });
				break;
			case 'item': {
				const { conversation, items } = get();
				// Something said: the conversation is listed now.
				if (event.item.kind === 'user' && conversation) host.changed?.(conversation.id);
				const at = items.findIndex((entry) => entry.id === event.item.id);
				set({ items: at >= 0 ? items.map((entry, index) => (index === at ? event.item : entry)) : [...items, event.item] });
				break;
			}
			case 'append':
				pieces.set(event.id, (pieces.get(event.id) ?? '') + event.text);
				frame ||= requestAnimationFrame(flushPieces);
				return;
			case 'session': {
				const before = get().conversation;
				set({ conversation: event.session });
				if (before?.id === event.session.id && (before.title !== event.session.title || before.updated !== event.session.updated)) host.changed?.(event.session.id);
				if (before?.state === 'running' && event.session.state !== 'running') host.turnOver?.();
				break;
			}
		}
		sessionSaid();
	}

	/** The status line, as the conversation is. */
	function sessionSaid(): void {
		const { conversation, items } = get();
		const running = conversation?.state === 'running';
		if (conversation?.state === 'starting' && items.length) say(`正在接上之前的对话（启动 ${conversation.agent.name}）…`);
		else if (conversation?.state === 'starting' || (!conversation && starting)) {
			// Said by begin().
		} else if (conversation?.state === 'failed') say(conversation.error || '它停了', true);
		else if (conversation?.state === 'closed') say('这个对话停下了；再说话会接着聊');
		else if (running) say('正在做…');
		else say('');
	}

	async function submit(): Promise<void> {
		const text = get().draft.trim();
		if (!text) return;
		const shown = get().conversation;
		if (shown?.state === 'running') {
			// While it works: to one that can take it, words it reads once its step is done (插话).
			if (shown.canSteer) await steer(shown.id, text);
			return;
		}
		// Said before the AIs were read (the tab just opened), or before the conversation chosen is followed: that first.
		await load();
		await showing;
		let target = get().conversation;
		// One over goes on (its agent started again), unless nothing was said in it.
		if (!target || ((target.state === 'closed' || target.state === 'failed') && !get().items.length)) target = await (starting ?? begin());
		else if (starting) target = await starting;
		if (!target) return;
		const { article, leftOut, selectionLeftOut, mentions: named } = get();
		const open = article && leftOut !== article.slug ? article : null;
		const selection = open && !selectionLeftOut && host.hasSelection() ? await host.selection() : null;
		set({ draft: '', mentions: [] });
		try {
			await tellConversation(target.id, text, {
				...(open ? { article: open.slug } : {}),
				...(selection ? { selection } : {}),
				...(named.length ? { mentions: named.map((entry) => entry.slug) } : {}),
			});
		} catch (error) {
			set({ draft: text, mentions: named });
			say(error instanceof Error ? error.message : '没发出去', true);
		}
	}

	async function steer(id: string, text: string): Promise<void> {
		set({ draft: '' });
		try {
			await tellConversation(id, text, {}, { steer: true });
		} catch (error) {
			set({ draft: text });
			say(error instanceof Error ? error.message : '没发出去', true);
		}
	}

	// The selection in the article, followed: a chip while there is one.
	function followSelection(): void {
		const selected = host.hasSelection();
		if (selected === get().selected) return;
		set(selected ? { selected, selectionLeftOut: false } : { selected });
	}
	document.addEventListener('selectionchange', followSelection);

	const actions = {
		say,
		showSheet,
		submit: () => void submit(),
		/** Stopped while it works, else what is typed said. */
		sendOrStop(): void {
			const shown = get().conversation;
			if (shown?.state === 'running') void stopConversation(shown.id).catch((error: unknown) => host.toast(error instanceof Error ? error.message : '没能停下'));
			else void submit();
		},
		type: (draft: string) => set({ draft }),
		/** `text` in the input, for the author to finish and send. */
		ask: (text: string) => set({ draft: text, focusAsked: get().focusAsked + 1 }),
		/** Another AI is another conversation; one begun and not yet spoken to is let go. */
		chooseAgent(agent: string): void {
			remember(AGENT_KEY, agent);
			set({ agent });
			void beginAfresh();
		},
		newConversation(): void {
			void beginAfresh().then(() => set({ focusAsked: get().focusAsked + 1 }));
		},
		/** An option of the conversation (mode, model, effort) changed; given again to the next conversation with this AI. */
		setOption(id: string, value: string): void {
			const shown = get().conversation;
			if (!shown) return;
			const agent = shown.agent.id;
			setConversationOption(shown.id, id, value).then(
				(changed) => {
					if (get().conversation?.id === changed.id) set({ conversation: changed });
					let chosen: Record<string, string> = {};
					try {
						chosen = JSON.parse(remembered(OPTIONS_KEY(agent)) ?? '{}') as Record<string, string>;
					} catch {
						// Kept wrong: started afresh.
					}
					remember(OPTIONS_KEY(agent), JSON.stringify({ ...chosen, [id]: value }));
				},
				(error: unknown) => host.toast(error instanceof Error ? error.message : '没能改'),
			);
		},
		answer(item: string, option: string): void {
			const shown = get().conversation;
			if (!shown) return;
			answerConversation(shown.id, item, option).catch((error: unknown) => host.toast(error instanceof Error ? error.message : '没能回答'));
		},
		/** Nothing said after its work: asked to say it. */
		resume(): void {
			set({ draft: '接着说：把你刚才的结论告诉我。' });
			void submit();
		},
		insert(markdown: string): void {
			host.toast(host.insert(markdown) ? '已插入到文章' : '先打开一篇文章');
		},
		copy(markdown: string): void {
			navigator.clipboard.writeText(markdown).then(() => host.toast('已复制 Markdown'), () => host.toast('没能复制'));
		},
		leaveOutArticle: () => set({ leftOut: get().article?.slug ?? null }),
		leaveOutSelection: () => set({ selectionLeftOut: true }),
		/** `entry` named with @: a chip; `draft` is what is typed with the @ and what followed it taken out. */
		mention: (entry: ArticleRef, draft: string) => set({ mentions: [...get().mentions, entry], draft }),
		unmention: (entry: ArticleRef) => set({ mentions: get().mentions.filter((other) => other !== entry) }),
		articles: () => host.articles(),
		/** ⤢: the panel whole, in the middle; the conversation listed there (in chats/) though nothing was said yet. ⤡: back. */
		toggleWhole(): void {
			if (get().full) return host.closeWhole?.();
			const shown = get().conversation;
			// Listed there once it is kept.
			void (shown ? pageConversation(shown.id).catch(() => null) : Promise.resolve(null)).then(() => host.openWhole?.());
		},
		/** 对话记录: the other conversations, to go on with; the one shown, to delete. */
		history(anchor: HTMLElement): void {
			void listConversations().then((known) => {
				const shown = get().conversation;
				const entries = known.conversations.filter((entry) => entry.id !== shown?.id);
				const menu: MenuItem[] = entries.length
					? entries.map((entry) => ({
							label: `${entry.title || '（还没说话）'}`,
							hint: `${entry.agent.name} · ${when(entry.updated)}${entry.state === 'running' ? ' · 进行中' : ''}`,
							action: () => follow(entry),
						}))
					: [{ label: '还没有别的对话', action: () => {} }];
				// The one shown, gone (its folder of chats/ too), after asking.
				if (shown && get().items.length) {
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
				showContextMenu(menu, anchor);
			});
		},
	};

	/** What the Studio around it asks of the panel. */
	const panel = {
		/** The tab is on screen: the AIs read, and a conversation begun if none goes on (once). */
		shown(): void {
			void load();
		},
		/** The article open changed (null: none); a conversation begun later goes on in it. */
		showArticle(next: ArticleRef | null): void {
			set(next?.slug !== get().article?.slug ? { article: next, leftOut: null, selectionLeftOut: false } : { article: next });
			sessionSaid();
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
			pane.classList.toggle('is-full', on);
			set({ full: on });
			if (on) void load();
		},
		/** Whether the AI is at work (a turn going on), changing files perhaps. */
		working: (): boolean => get().conversation?.state === 'running',
		/** The conversation shown (null: none yet). */
		current: (): string | null => get().conversation?.id ?? null,
		/** The conversation `id` shown, followed. */
		open(id: string): Promise<void> {
			asked = true;
			if (get().conversation?.id === id) return showing;
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
			// What is typed meanwhile is said in it, once it is there (submit waits for `starting`).
			return (await beginAfresh())?.id ?? null;
		},
		focus(): void {
			set({ focusAsked: get().focusAsked + 1 });
		},
		/** Puts `text` in the input, for the author to finish and send. */
		ask(text: string): void {
			set({ draft: text, focusAsked: get().focusAsked + 1 });
		},
	};

	return { store, actions, panel, sheetHost };
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
