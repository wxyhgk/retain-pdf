import { t } from '@blog/i18n/index.mjs';
import {
	answerConversation,
	closeConversation,
	deleteConversation,
	followConversation,
	listConversations,
	pageConversation,
	panelModels,
	piModels,
	setConversationOption,
	startConversation,
	answerQuestion,
	keepConversationPicture,
	stopConversation,
	switchConversation,
	tellConversation,
	type Conversation,
	type ConversationEvent,
	type ConversationItem,
} from '../../api/client';
import { ARTICLE_ADDRESS } from '@blog/markdown/articles/rules.mjs';
import { showContextMenu, type MenuItem } from '../../common/context-menu';
import type { ArticleSummary } from '../../types';
import { createStore, type Store } from '../../shell/store';
import type { ModelsSheetHost } from './ModelsSheet';

/** What the AI panel needs of the Studio around it. */
export type AiPanelHost = {
	/** The article open, if one is. */
	article(): { slug: string; title: string } | null;
	/** The articles, to name one with @, and to show one the conversation names. */
	articles(): PageInfo[];
	/** Opens one of the articles (from AI 问答, back in the editor). */
	openArticle(slug: string): void;
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
/** An article as the panel shows one it names: its link, and what its card says of it as the pointer rests on it. */
export type PageInfo = ArticleRef & Pick<ArticleSummary, 'icon' | 'parent' | 'description' | 'pubDate' | 'tags' | 'draft' | 'kind'>;

/** What the panel shows (AiPanel.tsx draws it). */
export type PanelState = {
	agents: Array<{ id: string; name: string; kind?: 'claude' | 'pi' | 'other' }>;
	/** The AI chosen for what is begun next. */
	agent: string;
	conversation: Conversation | null;
	items: ConversationItem[];
	/** A conversation being begun (said by `status` meanwhile). */
	starting: boolean;
	/** `retry`: what 重试 does after it (said again what failed, the last thing said, the AI started again). */
	status: { text: string; error: boolean; retry?: 'send' | 'last' | 'start' };
	/** 模型和账号 in place of the conversation. */
	settings: boolean;
	/** Whole in the middle (AI 问答). */
	full: boolean;
	/** What is told with what is said: the article open (unless left out), whether something is selected in it (and not left out); the articles named with @ are links in what is written. */
	article: ArticleRef | null;
	leftOut: string | null;
	selected: boolean;
	selectionLeftOut: boolean;
	/** What is typed. */
	draft: string;
	/** Asked to take the keys (focus): counted, so each ask is one. */
	focusAsked: number;
	/** The models starred in the model menu, first in it. */
	favorites: ModelChoice[];
	/** Gone on with by another service or AI (switchTo), until it can be spoken to. */
	switching: boolean;
	/** Pictures given with what is said next (pasted, dropped), shown small by `url`. */
	pictures: Picture[];
	/** What was quoted of the conversation (Markdown, formulas as written), said before what is said next. */
	quotes: string[];
	/** What was pasted at length (a log, an output), a chip each: said after what is said next. */
	pastes: string[];
	/** Said while it worked, to one that cannot take words then: each said in turn once it is done. */
	queued: Said[];
};

export type Picture = { id: string; blob: Blob; url: string };
/** Something to say: the words, the articles named with @, the pictures (`kept`: sent before), what was quoted and pasted. */
export type Said = { id: string; text: string; mentions: ArticleRef[]; pictures: Picture[]; quotes: string[]; pastes: string[]; kept?: string[] };

/** Pasted text this long (lines, or characters) is a chip, not words in the input. */
export const PASTE_LINES = 10;
export const PASTE_CHARACTERS = 1500;

/** How big a picture given is sent at most, on its longer side (larger, it is made smaller first). */
const PICTURE_SIDE = 2000;

/** A picture as it is sent: as it is, or made smaller (a screen's screenshot is larger than an AI reads). */
async function fitted(file: Blob): Promise<Blob> {
	if (file.type === 'image/gif') return file;
	try {
		const bitmap = await createImageBitmap(file);
		const scale = Math.min(1, PICTURE_SIDE / Math.max(bitmap.width, bitmap.height));
		if (scale === 1 && file.size < 4 * 1024 * 1024) return file;
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(bitmap.width * scale);
		canvas.height = Math.round(bitmap.height * scale);
		canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
		return await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), type, 0.9));
	} catch {
		return file;
	}
}

/**
 * A model as the model menu offers it: of which AI, run for which service (Claude Code's or pi's; null: the one the
 * conversation has), its value in the conversation's model option, its name.
 */
export type ModelChoice = { agent: string; provider: string | null; value: string; name: string };
/** The services the model menu lists for an AI: their models, whether they can be used (a key saved). */
export type MenuService = { id: string; name: string; usable: boolean; models: Array<{ value: string; name: string }> };

const CONVERSATION_KEY = 'studio.ai.conversation';
const AGENT_KEY = 'studio.ai.agent';
/** The options the author chooses (the model menu, the bars): who decides, which model, how hard it thinks. */
const SHOWN_OPTIONS = ['mode', 'model', 'thought_level'];
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

const FAVORITES_KEY = 'studio.ai.favorites';

function readFavorites(): ModelChoice[] {
	try {
		const kept = JSON.parse(remembered(FAVORITES_KEY) ?? '[]') as unknown;
		return Array.isArray(kept) ? kept.filter((entry): entry is ModelChoice => typeof entry?.agent === 'string' && typeof entry?.value === 'string' && typeof entry?.name === 'string') : [];
	} catch {
		return [];
	}
}

/**
 * The articles named in what is written (with @: a link to each, `[标题](/blog/slug/)`), each once, as the list has
 * them.
 */
export function mentionsIn(markdown: string, pages: ArticleRef[]): ArticleRef[] {
	const slugs = new Set([...markdown.matchAll(/\]\((\/(?:blog|wiki)\/[^)\s]+)\)/gu)].map((found) => ARTICLE_ADDRESS.exec(found[1]!)?.[2]).filter((slug): slug is string => Boolean(slug)));
	return pages.filter((page) => slugs.has(page.slug)).map(({ slug, title }) => ({ slug, title }));
}

export const sameChoice = (one: ModelChoice, other: ModelChoice): boolean => one.agent === other.agent && (one.provider ?? '') === (other.provider ?? '') && one.value === other.value;

/** When a conversation was last spoken in: the time today, else the day (and the year, another year's). */
function when(iso: string | undefined): string {
	const date = new Date(iso ?? '');
	if (Number.isNaN(date.getTime())) return '';
	const now = new Date();
	const pad = (value: number) => String(value).padStart(2, '0');
	if (date.toDateString() === now.toDateString()) return t('今天 {time}', { time: `${pad(date.getHours())}:${pad(date.getMinutes())}` });
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
		draft: '',
		focusAsked: 0,
		favorites: readFavorites(),
		switching: false,
		pictures: [],
		quotes: [],
		pastes: [],
		queued: [],
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
			host.toast(name ? t('AI 面板的 {agent} 改用「{name}」', { agent: agent === 'pi' ? 'pi' : 'Claude Code', name }) : t('已保存'));
		},
	};

	function say(text: string, error = false, retry?: PanelState['status']['retry']): void {
		set({ status: { text, error, ...(retry ? { retry } : {}) } });
	}

	/** Its connection to the server gone (followConversation follows it again): said until it is back. */
	let lost = false;

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
				say(t('没有能在面板里用的 AI：在「AI 助手」设置里给 Claude 或 Codex 配上 ACP 命令'));
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
			say(error instanceof Error ? error.message : t('读不到 AI 列表'));
		}
	}

	/** A new conversation with the AI chosen, in the article open; the one before goes on in the list. */
	function begin(): Promise<Conversation | null> {
		const agent = get().agent;
		follow(null);
		set({ starting: true });
		say(t('正在启动 {name}…', { name: get().agents.find((entry) => entry.id === agent)?.name ?? 'AI' }));
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
				say(error instanceof Error ? error.message : t('没能启动'), true, 'start');
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
				lost = false;
				set({ conversation: event.session, items: [...event.items] });
				break;
			case 'lost':
				lost = true;
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
				if (before?.state === 'running' && event.session.state !== 'running') {
					host.turnOver?.();
					// Its turn over: what was said meanwhile, said now.
					const [next, ...rest] = get().queued;
					if (next && event.session.state === 'idle') {
						set({ queued: rest });
						void send(next);
					}
				}
				break;
			}
		}
		sessionSaid();
	}

	/** The status line, as the conversation is. */
	function sessionSaid(): void {
		const { conversation, items } = get();
		const running = conversation?.state === 'running';
		if (lost) return say(t('和 Studio 服务器断开了，正在重新连上…'), true);
		if (conversation?.state === 'starting' && items.length) say(t('正在接上之前的对话（启动 {name}）…', { name: conversation.agent.name }));
		else if (conversation?.state === 'starting' || (!conversation && starting)) {
			// Said by begin().
		} else if (conversation?.state === 'failed') say(conversation.error || t('它停了'), true, items.some((item) => item.kind === 'user') ? 'last' : 'start');
		else if (conversation?.state === 'closed') say(t('这个对话停下了；再说话会接着聊'));
		else if (running) say(t('正在做…'));
		else say('');
	}

	async function submit(): Promise<void> {
		const { draft, pictures, quotes, pastes } = get();
		const text = draft.trim();
		if (!text && !pastes.length) return;
		const said: Said = { id: crypto.randomUUID(), text, mentions: mentionsIn(text, host.articles()), pictures, quotes, pastes };
		const shown = get().conversation;
		if (shown?.state === 'running') {
			// While it works: to one that can take it, words it reads as soon as it can (插话); else said once it is done.
			if (shown.canSteer && !pictures.length && !quotes.length && !pastes.length) await steer(shown.id, text);
			else set({ queued: [...get().queued, said], draft: '', pictures: [], quotes: [], pastes: [] });
			return;
		}
		set({ draft: '', pictures: [], quotes: [], pastes: [] });
		await send(said);
	}

	/** Back where it was typed, not said (failed, or taken back from the queue). */
	function unsay(said: Said): void {
		set({ draft: said.text, pictures: said.pictures, quotes: said.quotes, pastes: said.pastes });
	}

	async function send(said: Said): Promise<void> {
		const { text, mentions: named, quotes, pastes } = said;
		// Said before the AIs were read (the tab just opened), or before the conversation chosen is followed: that first.
		await load();
		await showing;
		let target = get().conversation;
		// One over goes on (its agent started again), unless nothing was said in it.
		if (!target || ((target.state === 'closed' || target.state === 'failed') && !get().items.length)) target = await (starting ?? begin());
		else if (starting) target = await starting;
		if (!target) return;
		const { article, leftOut, selectionLeftOut } = get();
		const open = article && leftOut !== article.slug ? article : null;
		const selection = open && !selectionLeftOut && host.hasSelection() ? await host.selection() : null;
		try {
			const pictures = [...(said.kept ?? []), ...(await Promise.all(said.pictures.map((picture) => keepConversationPicture(target.id, picture.blob))))];
			await tellConversation(
				target.id,
				text,
				{
					...(open ? { article: open.slug } : {}),
					...(selection ? { selection } : {}),
					...(named.length ? { mentions: named.map((entry) => entry.slug) } : {}),
				},
				{ pictures, quotes, pastes },
			);
			for (const picture of said.pictures) URL.revokeObjectURL(picture.url);
		} catch (error) {
			unsay(said);
			say(error instanceof Error ? error.message : t('没发出去'), true, 'send');
		}
	}

	/** The service a conversation runs for: Claude Code's Claude account, pi's own setting (`pi-own`), when it names none. */
	function currentService(shown: Conversation): string | null {
		const kind = get().agents.find((entry) => entry.id === shown.agent.id)?.kind;
		return shown.serviceId ?? (kind === 'claude' ? 'claude-account' : kind === 'pi' ? 'pi-own' : null);
	}

	/**
	 * A model chosen in the menu: one of the conversation's, set; one of another service (Claude Code's) or another
	 * AI's, the conversation gone on with by it first.
	 */
	async function switchTo(choice: ModelChoice): Promise<void> {
		const shown = get().conversation;
		if (!shown) return;
		if (shown.state === 'running') return host.toast(t('它还在做事：等它做完再换'));
		const otherAgent = choice.agent !== shown.agent.id;
		const otherService = choice.provider !== null && choice.provider !== currentService(shown);
		let now = shown;
		if (otherAgent || otherService) {
			set({ switching: true });
			say(t('正在换到 {name}…', { name: choice.name || (get().agents.find((agent) => agent.id === choice.agent)?.name ?? 'AI') }));
			try {
				now = await switchConversation(shown.id, { ...(otherAgent ? { agent: choice.agent } : {}), ...(otherService ? { provider: choice.provider! } : {}) });
			} catch (error) {
				say(error instanceof Error ? error.message : t('没能换'), true);
				return;
			} finally {
				set({ switching: false });
			}
			if (get().conversation?.id === now.id) set({ conversation: now });
			remember(AGENT_KEY, choice.agent);
			set({ agent: choice.agent });
			sessionSaid();
		}
		const model = now.configOptions.find((option) => option.category === 'model');
		if (choice.value && model && model.currentValue !== choice.value) actions.setOption(model.id, choice.value);
	}

	async function steer(id: string, text: string): Promise<void> {
		set({ draft: '' });
		try {
			await tellConversation(id, text, {}, { steer: true });
		} catch (error) {
			set({ draft: text });
			say(error instanceof Error ? error.message : t('没发出去'), true);
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
			if (shown?.state !== 'running') return void submit();
			void stopConversation(shown.id).catch((error: unknown) => {
				host.toast(error instanceof Error ? error.message : t('没能停下'));
				// Perhaps not going on any more (its server restarted): shown as it is now.
				follow(get().conversation);
			});
		},
		type: (draft: string) => set({ draft }),
		/** `text` in the input, for the author to finish and send. */
		ask: (text: string) => set({ draft: text, focusAsked: get().focusAsked + 1 }),
		/** Another AI: the conversation gone on with by it (what was said kept); one not yet spoken to, begun afresh. */
		chooseAgent(agent: string): void {
			remember(AGENT_KEY, agent);
			set({ agent });
			if (get().conversation && get().items.length) void switchTo({ agent, provider: null, value: '', name: '' });
			else void beginAfresh();
		},
		switchTo: (choice: ModelChoice) => void switchTo(choice),
		currentService,
		/** ☆: a model first in the menu, or no longer. */
		toggleFavorite(choice: ModelChoice): void {
			const { favorites } = get();
			const next = favorites.some((entry) => sameChoice(entry, choice)) ? favorites.filter((entry) => !sameChoice(entry, choice)) : [...favorites, choice];
			remember(FAVORITES_KEY, JSON.stringify(next));
			set({ favorites: next });
		},
		/** The services the model menu lists for `agent` (Claude Code's, pi's; none for another AI). */
		async services(agent: string): Promise<MenuService[]> {
			const kind = get().agents.find((entry) => entry.id === agent)?.kind;
			if (kind === 'claude') {
				const shown = await panelModels();
				return shown.providers.map((entry) => ({
					id: entry.id,
					name: entry.name,
					usable: entry.id === 'claude-account' || entry.hasKey,
					models: entry.main ? [{ value: 'default', name: entry.main }, ...(entry.fast && entry.fast !== entry.main ? [{ value: 'haiku', name: t('{fast}（快）', { fast: entry.fast }) }] : [])] : [],
				}));
			}
			if (kind === 'pi') return (await piModels()).providers.filter((entry) => entry.env).map((entry) => ({ id: entry.id, name: entry.name, usable: entry.hasKey, models: [] }));
			return [];
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
				(error: unknown) => host.toast(error instanceof Error ? error.message : t('没能改')),
			);
		},
		/** 重试 after what the status says went wrong. */
		retryStatus(): void {
			const { retry } = get().status;
			if (retry === 'send') void submit();
			else if (retry === 'last') actions.retry();
			else if (retry === 'start') void beginAfresh();
		},
		/** What was said last, said again (it failed): with what was told and given with it. */
		retry(): void {
			const last = get().items.findLast((item): item is Extract<ConversationItem, { kind: 'user' }> => item.kind === 'user' && !item.steer);
			if (!last || get().conversation?.state === 'running') return;
			const pages = host.articles();
			const mentions = (last.context?.mentionSlugs ?? []).flatMap((slug) => pages.filter((page) => page.slug === slug).map(({ slug: named, title }) => ({ slug: named, title })));
			void send({ id: crypto.randomUUID(), text: last.text, mentions, pictures: [], quotes: last.quotes ?? [], pastes: last.pastes ?? [], kept: last.pictures ?? [] });
		},
		/** Pictures given with what is said next (pasted, dropped); those not pictures left out. */
		async addPictures(files: File[]): Promise<void> {
			const shown = get().conversation;
			const pictures = files.filter((file) => /^image\/(png|jpeg|gif|webp)$/u.test(file.type));
			if (!pictures.length) return;
			if (shown && shown.seesPictures === false) return host.toast(t('{name} 不收图片', { name: shown.agent.name }));
			const added = await Promise.all(pictures.map(async (file) => {
				const blob = await fitted(file);
				return { id: crypto.randomUUID(), blob, url: URL.createObjectURL(blob) };
			}));
			set({ pictures: [...get().pictures, ...added], focusAsked: get().focusAsked + 1 });
		},
		removePicture(id: string): void {
			const picture = get().pictures.find((entry) => entry.id === id);
			if (picture) URL.revokeObjectURL(picture.url);
			set({ pictures: get().pictures.filter((entry) => entry.id !== id) });
		},
		/** What was selected of the conversation (Markdown), quoted in what is said next. */
		quote(markdown: string): void {
			if (markdown.trim()) set({ quotes: [...get().quotes, markdown.trim()], focusAsked: get().focusAsked + 1 });
		},
		unquote: (at: number) => set({ quotes: get().quotes.filter((_, index) => index !== at) }),
		paste: (text: string) => set({ pastes: [...get().pastes, text] }),
		unpaste: (at: number) => set({ pastes: get().pastes.filter((_, index) => index !== at) }),
		/** Taken back from the queue, to be changed (or left unsaid). */
		unqueue(id: string): void {
			const said = get().queued.find((entry) => entry.id === id);
			if (!said) return;
			set({ queued: get().queued.filter((entry) => entry.id !== id) });
			if (!get().draft.trim()) unsay(said);
		},
		/** Said now: what it is doing stopped, this first of the queue, said once it has stopped. */
		sayNow(id: string): void {
			const { queued, conversation } = get();
			const said = queued.find((entry) => entry.id === id);
			if (!said || !conversation) return;
			set({ queued: [said, ...queued.filter((entry) => entry !== said)] });
			void stopConversation(conversation.id).catch((error: unknown) => host.toast(error instanceof Error ? error.message : t('没能停下')));
		},
		/** A question it asked, answered. */
		answerQuestion(item: string, answer: Parameters<typeof answerQuestion>[2]): void {
			const shown = get().conversation;
			if (!shown) return;
			answerQuestion(shown.id, item, answer).catch((error: unknown) => host.toast(error instanceof Error ? error.message : t('没能回答')));
		},
		answer(item: string, option: string): void {
			const shown = get().conversation;
			if (!shown) return;
			answerConversation(shown.id, item, option).catch((error: unknown) => host.toast(error instanceof Error ? error.message : t('没能回答')));
		},
		/** Nothing said after its work: asked to say it. */
		resume(): void {
			set({ draft: '接着说：把你刚才的结论告诉我。' }); // i18n-ignore: said to the AI
			void submit();
		},
		insert(markdown: string): void {
			host.toast(host.insert(markdown) ? t('已插入到文章') : t('先打开一篇文章'));
		},
		/** `text` copied; `said`, what is said once it is. */
		copy(text: string, said = t('已复制 Markdown')): void {
			navigator.clipboard.writeText(text).then(() => host.toast(said), () => host.toast(t('没能复制')));
		},
		leaveOutArticle: () => set({ leftOut: get().article?.slug ?? null }),
		leaveOutSelection: () => set({ selectionLeftOut: true }),
		articles: () => host.articles(),
		openArticle: (slug: string) => host.openArticle(slug),
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
							label: entry.title || t('（还没说话）'),
							hint: entry.state === 'running' ? t('{agent} · {when} · 进行中', { agent: entry.agent.name, when: when(entry.updated) }) : `${entry.agent.name} · ${when(entry.updated)}`,
							action: () => follow(entry),
						}))
					: [{ label: t('还没有别的对话'), action: () => {} }];
				// The one shown, gone (its folder of chats/ too), after asking.
				if (shown && get().items.length) {
					menu.push({
						label: t('删除这个对话'),
						action: () => {
							if (!window.confirm(t('删除对话「{title}」？\n它在 chats/ 里的记录也会删掉，不能恢复。', { title: shown.title || t('新对话') }))) return;
							void deleteConversation(shown.id).then(
								() => void begin(),
								(error: unknown) => host.toast(error instanceof Error ? error.message : t('没能删除')),
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
		/** The conversation `id` named anew (in the left column): its name here too. */
		renamed(id: string, title: string): void {
			const shown = get().conversation;
			if (shown?.id === id) set({ conversation: { ...shown, title } });
		},
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
					else say(t('找不到这个对话（可能已经删了）'), true);
				} catch (error) {
					say(error instanceof Error ? error.message : t('读不到对话'), true);
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
