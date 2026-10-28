import { appCheckpoints, appFetch, appRun, appServer, articleFileUrl, createApp, getTask, keepAppCheckpoint, listArticleFiles, listMiniApps, notesCode, notesImages, reportAppError, repos, restoreAppCheckpoint, revealApp, uploadArticleFile, type AppStatus, type MiniApp } from '../api/client';
import { showContextMenu } from '../common/context-menu';
import { openDialog } from '../shell/dialogs/Dialogs';
import { t } from '@blog/i18n/index.mjs';

/** What the 小程序 may reach of the Studio around them, through their bridge (server/apps/mini-apps.mjs). */
export type MiniAppsHost = {
	/** The article shown: its folder name, title and Markdown; null when none is. */
	article(): { slug: string; title: string; source: string } | null;
	/** Puts Markdown into the article where the caret is. */
	insert(markdown: string): void;
	toast(message: string): void;
	/** Opens a page, at the first block holding `find` when given. */
	openPage(slug: string, find?: string): void;
	/** Puts `prompt` in the AI panel's input (shown), for the author to send. */
	askAI(prompt: string): void;
	/** The 小程序 page shown in the middle (its list, or the app open there). */
	showApps(): void;
};

const MESSAGE = 'studio-app';

/**
 * What a block of an article gives the app's page showing it (`studio.block`): the block's state (its fence's body) and
 * options (its info string), changed by the page, and its picture kept for the blog.
 */
export type AppBlockLink = {
	state(): string;
	meta(): string;
	set(state: string): void;
	picture(data: string, type: string): Promise<string>;
};

/** A block of an article shown by an app's page, in a frame of its own. */
type BlockFrame = { app: MiniApp; root: HTMLElement; frame: HTMLIFrameElement; port: MessagePort | null; link: AppBlockLink; errors: string[] };

let makeBlockFrame: ((id: string, entry: string, height: number, link: AppBlockLink) => HTMLElement) | null = null;

/**
 * A block of an article shown by the app `id` (apps/<id>/): its page `entry`, `height` tall, with `studio` and the block
 * (`link`). A project app not running yet is started when asked to, not by itself (an article shown starts nothing).
 */
export function appBlockFrame(id: string, entry: string, height: number, link: AppBlockLink): HTMLElement {
	if (makeBlockFrame) return makeBlockFrame(id, entry, height, link);
	const waiting = document.createElement('div');
	waiting.className = 'app-block';
	return waiting;
}
// Sizes kept before the windows could be sized from their edges (opened smaller) are let go.
const PLACES = 'studio.mini-app-windows';

type Place = { left: number; top: number; width: number; height: number };
/** The smallest a window is made, opened or sized by hand; the least it opens at; the room kept around it. */
const SMALLEST = { width: 280, height: 180 };
const ROOMY = { width: 420, height: 520 };
const MARGIN = 16;
/** Where a window is sized from: its edges and corners, each moving the sides it names. */
const GRIPS = ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'] as const;
/**
 * `port`: the app's line to the Studio, handed to the page the Studio put in the frame (its first `ready`) and to
 * no other: a page the frame goes to afterwards (a link clicked in it) gets none, and the line is cut. `loading`:
 * the Studio has just set the frame's address and waits for the app's `ready`; `loaded`: the app's page loaded.
 */
type AppWindow = {
	app: MiniApp;
	root: HTMLElement;
	frame: HTMLIFrameElement;
	port: MessagePort | null;
	loading: boolean;
	loaded: boolean;
	/** What went wrong in its page, the last few (the red dot on its bar). */
	errors: string[];
	errorBadge: HTMLButtonElement;
	/** A project app: how its development server is (its bar says), what it wrote, and the watch on it. */
	state: HTMLElement | null;
	status: AppStatus | null;
	polling: number | null;
	/** What is shown over its page: its errors or its server's output. */
	sheet: HTMLElement;
	/** The page of it the window opens at (a command's), `''` for its own first one. */
	entry: string;
	/** Shown as a page in the middle (the 小程序 page), not floating over the Studio. */
	docked: boolean;
};

/** Errors kept for a window; lines of its server's output given to an AI. */
const KEPT_ERRORS = 20;
const LOG_LINES = 50;

const theme = (): 'dark' | 'light' => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

function readPlaces(): Record<string, Place> {
	try {
		return JSON.parse(localStorage.getItem(PLACES) ?? '{}') as Record<string, Place>;
	} catch {
		return {};
	}
}

function keepPlace(id: string, place: Place): void {
	try {
		localStorage.setItem(PLACES, JSON.stringify({ ...readPlaces(), [id]: place }));
	} catch {
		// Private windows may refuse storage: the window opens where it opens.
	}
}

/** `place` made to fit the Studio's window: no smaller than the least, no larger than the window, on screen. */
function fitted(place: Place): Place {
	const width = Math.min(Math.max(place.width, SMALLEST.width), innerWidth - 2 * MARGIN);
	const height = Math.min(Math.max(place.height, SMALLEST.height), innerHeight - 2 * MARGIN);
	const left = Math.min(Math.max(place.left, MARGIN), innerWidth - MARGIN - width);
	const top = Math.min(Math.max(place.top, MARGIN), innerHeight - MARGIN - height);
	return { left, top, width, height };
}

function placeOf(root: HTMLElement): Place {
	return { left: root.offsetLeft, top: root.offsetTop, width: root.offsetWidth, height: root.offsetHeight };
}

function put(root: HTMLElement, place: Place): void {
	Object.assign(root.style, { left: `${place.left}px`, top: `${place.top}px`, width: `${place.width}px`, height: `${place.height}px` });
}

/**
 * 小程序: the tools of apps/. The 小程序 page (`page`, in the middle as 全部文章 is) lists them all, to be found however
 * many there are; one opened from it fills that page (‹ back to the list), or floats over the Studio in a window to be
 * used beside an article (moved by its bar, sized from any edge or corner, as large as the Studio's window by a
 * double-click on its bar, where it was left the next time) — 弹出 / 整页 move it from one to the other where it was.
 * Each is in a frame of the Studio's own origin, not sandboxed (the author's own tools). What an app asks of the Studio
 * comes as messages, each answered: every app may do all it asks.
 */
export function createMiniApps(page: HTMLElement, layer: HTMLElement, host: MiniAppsHost) {
	const open = new Map<string, AppWindow>();
	let top = 70;
	/** The list of them, and where one opened as a page is. */
	const gallery = document.createElement('div');
	gallery.className = 'apps-gallery';
	const stage = document.createElement('div');
	stage.className = 'apps-stage';
	stage.hidden = true;
	page.append(gallery, stage);
	/** The app shown as the page, or null for the list. */
	let current: string | null = null;
	let query = '';

	/** The page shows `id` (an app open as a page), or the list (null); the address says which. */
	function present(id: string | null): void {
		current = id;
		for (const shown of open.values()) if (shown.docked) shown.root.hidden = shown.app.id !== id;
		gallery.hidden = Boolean(id);
		stage.hidden = !id;
		const url = new URL(window.location.href);
		if (id) url.searchParams.set('app', id);
		else url.searchParams.delete('app');
		history.replaceState(null, '', url);
		if (!id) void drawGallery();
	}

	/** The list of the apps: each a card, found by a search; what is open said so. */
	async function drawGallery(): Promise<void> {
		let apps: MiniApp[];
		try {
			apps = await listMiniApps();
		} catch (error) {
			const said = document.createElement('p');
			said.className = 'apps-empty';
			said.textContent = error instanceof Error ? error.message : t('读不到小程序');
			gallery.replaceChildren(said);
			return;
		}
		const head = document.createElement('div');
		head.className = 'apps-head';
		const title = document.createElement('h1');
		title.textContent = t('小程序');
		const count = document.createElement('span');
		count.className = 'apps-count';
		count.textContent = t('{count} 个', { count: apps.length });
		const search = document.createElement('input');
		search.type = 'search';
		search.id = 'apps-search';
		search.className = 'apps-search';
		search.placeholder = t('找小程序：名字、说明');
		search.value = query;
		const make = document.createElement('button');
		make.type = 'button';
		make.id = 'apps-new';
		make.className = 'apps-new';
		make.textContent = t('新建小程序');
		make.addEventListener('click', () => openDialog('newApp', { done: (asked) => asked && void makeApp(asked.name, asked.template) }));
		head.append(title, count, search, make);
		const hint = document.createElement('p');
		hint.className = 'apps-hint';
		hint.textContent = t('点开一个，整页使用；⧉ 在浮动窗口里打开，边写文章边用。');
		const grid = document.createElement('div');
		grid.className = 'apps-grid';
		const fill = () => {
			const words = query.toLowerCase().split(/\s+/u).filter(Boolean);
			const found = apps.filter((app) => words.every((word) => `${app.name} ${app.id} ${app.description}`.toLowerCase().includes(word)));
			grid.replaceChildren(...found.map(card));
			if (!found.length) {
				const none = document.createElement('p');
				none.className = 'apps-empty';
				none.textContent = apps.length ? t('没有符合的小程序') : t('还没有小程序：点「新建小程序」，说出想要什么，让 AI 造一个。');
				grid.append(none);
			}
		};
		search.addEventListener('input', () => {
			query = search.value;
			fill();
		});
		fill();
		gallery.replaceChildren(head, hint, grid);
	}

	/** One app in the list: opened as the page by a click, or in a window by ⧉. */
	function card(app: MiniApp): HTMLElement {
		const root = document.createElement('article');
		root.className = 'app-card';
		root.dataset.appCard = app.id;
		const opener = document.createElement('button');
		opener.type = 'button';
		opener.className = 'app-card-open';
		const icon = document.createElement('span');
		icon.className = 'app-card-icon';
		icon.textContent = app.icon;
		const name = document.createElement('strong');
		name.className = 'app-card-name';
		name.textContent = app.name;
		const description = document.createElement('span');
		description.className = 'app-card-description';
		description.textContent = app.problem ?? app.description;
		if (app.problem) description.classList.add('is-error');
		const tags = document.createElement('span');
		tags.className = 'app-card-tags';
		tags.textContent = [app.kind === 'project' ? t('项目') : t('一页网页'), ...app.blocks.map((block) => `\`\`\`${block.fence}`), open.has(app.id) ? t('打开着') : ''].filter(Boolean).join(' · ');
		opener.append(icon, name, description, tags);
		opener.addEventListener('click', () => (app.problem ? host.toast(`${app.name}：${app.problem}`) : show(app)));
		const windowed = document.createElement('button');
		windowed.type = 'button';
		windowed.className = 'app-card-window';
		windowed.textContent = '⧉';
		windowed.title = t('在浮动窗口里打开「{name}」', { name: app.name });
		windowed.setAttribute('aria-label', windowed.title);
		windowed.disabled = Boolean(app.problem);
		windowed.addEventListener('click', () => show(app, '', { floating: true }));
		root.append(opener, windowed);
		return root;
	}

	/** A window brought above the others. Not one shown as the page: above the page, it would cover the Studio's menus. */
	function focus(shown: AppWindow): void {
		if (shown.docked) return;
		shown.root.style.zIndex = String(++top);
	}

	function close(id: string): void {
		const shown = open.get(id);
		shown?.port?.close();
		if (shown?.polling) clearInterval(shown.polling);
		shown?.root.remove();
		open.delete(id);
		if (current === id) present(null);
	}

	/** The button that moves it: 弹出 as the page, 整页 as a window. */
	function labelSwitch(shown: AppWindow): void {
		const button = shown.root.querySelector<HTMLButtonElement>('.mini-app-switch');
		if (!button) return;
		button.textContent = shown.docked ? '⧉' : '⤢';
		button.title = shown.docked ? t('弹出：在浮动窗口里用，边写文章边用') : t('整页：放到小程序页面里用');
		button.setAttribute('aria-label', shown.docked ? t('弹出成窗口') : t('整页显示'));
	}

	/**
	 * 整页 ⇄ 弹出: the window made the page, or the page a floating window; its frame (moved, so loaded again) opened at
	 * the address it was at.
	 */
	function move(shown: AppWindow): void {
		let here = shown.frame.src;
		try {
			here = shown.frame.contentWindow?.location.href ?? here;
		} catch {
			// Not the app's own page: it starts again at its own.
		}
		shown.docked = !shown.docked;
		shown.root.classList.toggle('is-docked', shown.docked);
		labelSwitch(shown);
		if (shown.docked) {
			shown.root.removeAttribute('style');
			stage.append(shown.root);
			present(shown.app.id);
			host.showApps();
		} else {
			const width = Math.max(shown.app.width, ROOMY.width);
			const height = Math.max(shown.app.height, ROOMY.height);
			put(shown.root, fitted(readPlaces()[shown.app.id] ?? { left: innerWidth - width - 40, top: 80, width, height }));
			shown.root.hidden = false;
			layer.append(shown.root);
			focus(shown);
			if (current === shown.app.id) present(null);
		}
		cut(shown);
		shown.loading = true;
		shown.loaded = false;
		shown.frame.src = here;
	}

	const home = (app: MiniApp) => `/studio-apps/${encodeURIComponent(app.id)}/`;

	/** Puts the app's own page in its frame (again, with `query`), to be given a line when it is ready. */
	function load(shown: AppWindow, query = ''): void {
		cut(shown);
		shown.loading = true;
		shown.loaded = false;
		shown.frame.src = `${home(shown.app)}${query}`;
	}

	/** Whether the frame shows a page of the app's own (its page loaded again, by its server or by a change saved). */
	function ours(shown: AppWindow): boolean {
		try {
			return (shown.frame.contentWindow?.location.pathname ?? '').startsWith(home(shown.app));
		} catch {
			return false;
		}
	}

	/** Something went wrong in the app's page: kept, and its bar says how many. */
	function failed(shown: AppWindow, message: string): void {
		reportAppError(shown.app.id, message);
		shown.errors.push(message);
		if (shown.errors.length > KEPT_ERRORS) shown.errors.splice(0, shown.errors.length - KEPT_ERRORS);
		shown.errorBadge.hidden = false;
		shown.errorBadge.textContent = `● ${shown.errors.length}`;
		shown.errorBadge.title = t('出错了：点开看，或让 AI 修');
		if (!shown.sheet.hidden && shown.sheet.dataset.showing === 'errors') showErrors(shown);
	}

	function clearErrors(shown: AppWindow): void {
		shown.errors = [];
		shown.errorBadge.hidden = true;
	}

	/** Shows `text` over the app's page, with `actions` under it. */
	function showSheet(shown: AppWindow, showing: string, heading: string, text: string, actions: Array<[string, () => void]>): void {
		const { sheet } = shown;
		sheet.replaceChildren();
		sheet.dataset.showing = showing;
		const title = document.createElement('strong');
		title.textContent = heading;
		const body = document.createElement('pre');
		body.textContent = text;
		const row = document.createElement('div');
		row.className = 'mini-app-sheet-actions';
		for (const [label, action] of [...actions, [t('关闭'), () => (sheet.hidden = true)] as [string, () => void]]) {
			const button = document.createElement('button');
			button.type = 'button';
			button.textContent = label;
			button.addEventListener('click', action);
			row.append(button);
		}
		sheet.append(title, body, row);
		sheet.hidden = false;
		body.scrollTop = body.scrollHeight;
	}

	function showErrors(shown: AppWindow): void {
		showSheet(shown, 'errors', t('「{name}」出的错', { name: shown.app.name }), shown.errors.join('\n\n'), [
			[t('让 AI 修'), () => void askToMend(shown)],
			[t('清除'), () => {
				clearErrors(shown);
				shown.sheet.hidden = true;
			}],
		]);
	}

	function showLog(shown: AppWindow): void {
		showSheet(shown, 'log', t('「{name}」的开发服务器', { name: shown.app.name }), shown.status?.log || t('（还没有输出）'), [
			[t('重启'), () => void restart(shown)],
		]);
	}

	/** Its code as it is now kept, before the AI is asked to change it: one click brings it back (its window's ⋯). */
	function keepBeforeAI(app: MiniApp): void {
		keepAppCheckpoint(app.id, t('让 AI 改之前')).catch((error: unknown) => host.toast(error instanceof Error ? error.message : String(error)));
	}

	/** Its checkpoints, each to go back to. */
	async function showCheckpoints(shown: AppWindow): Promise<void> {
		const kept = await appCheckpoints(shown.app.id).catch(() => []);
		const { sheet } = shown;
		showSheet(shown, 'checkpoints', t('「{name}」的检查点', { name: shown.app.name }), kept.length ? '' : t('还没有检查点：让 AI 改它之前会自动存一个，也可以在 ⋯ 里手动存'), []);
		const list = sheet.querySelector('pre')!;
		list.replaceChildren(...kept.map((checkpoint) => {
			const row = document.createElement('div');
			row.className = 'mini-app-checkpoint';
			const words = document.createElement('span');
			words.textContent = `${new Date(checkpoint.when).toLocaleString('zh-CN', { hour12: false })}　${checkpoint.why}（${t('{count} 个文件', { count: checkpoint.files })}）`;
			const back = document.createElement('button');
			back.type = 'button';
			back.textContent = t('回到这里');
			back.addEventListener('click', async () => {
				back.disabled = true;
				try {
					await restoreAppCheckpoint(shown.app.id, checkpoint.stamp);
					host.toast(t('「{name}」回到了 {when} 的样子', { name: shown.app.name, when: words.textContent?.split('　')[0] ?? '' }));
					sheet.hidden = true;
					// A page app is loaded again; a project's own server sees its files change.
					if (shown.app.kind === 'page') load(shown, `?${Date.now()}`);
				} catch (error) {
					host.toast(error instanceof Error ? error.message : String(error));
					back.disabled = false;
				}
			});
			row.append(words, back);
			return row;
		}));
	}

	/** Its menu: its code, to the AI, its checkpoints. */
	function showMenu(shown: AppWindow, button: HTMLElement): void {
		const { app } = shown;
		showContextMenu([
			{ label: t('看源码（在访达里显示）'), action: () => void revealApp(app.id).then(({ path }) => host.toast(t('代码在 {path}', { path })), (error: unknown) => host.toast(error instanceof Error ? error.message : String(error))) },
			{ label: t('让 AI 改这个…'), action: () => askToChange(app, shown.errors) },
			'separator',
			{ label: t('存一个检查点'), action: () => void keepAppCheckpoint(app.id, t('手动存的')).then((kept) => host.toast(t('存好了：{count} 个文件', { count: kept.files })), (error: unknown) => host.toast(error instanceof Error ? error.message : String(error))) },
			{ label: t('回到检查点…'), action: () => void showCheckpoints(shown) },
		], button);
	}

	/**
	 * The app to be changed by the AI (its block's 「AI」, its errors): where its code is, and what went wrong, put in the
	 * AI panel's input for the author to finish.
	 */
	function askToChange(app: MiniApp, errors: string[]): void {
		keepBeforeAI(app);
		const where = app.kind === 'project'
			? `apps/${app.id}/（是一个项目：在哪个文件夹见 apps/${app.id}/app.local.json 或 app.json 的 dev.cwd，没写就是 apps/${app.id}/ 本身）` // i18n-ignore: said to the AI
			: `apps/${app.id}/`;
		const said = errors.slice(-5).map((error) => `\`\`\`\n${error}\n\`\`\``).join('\n');
		host.askAI([
			`改小程序「${app.name}」（代码在 ${where}，照技能 studio-mini-apps 来）：`, // i18n-ignore: said to the AI
			said ? `它在文章的块里出的错：\n${said}` : '', // i18n-ignore: said to the AI
		].filter(Boolean).join('\n\n'));
	}

	/** Its errors (and its server's last output) put in the AI panel's input, for the author to send. */
	async function askToMend(shown: AppWindow): Promise<void> {
		const { app } = shown;
		keepBeforeAI(app);
		let log = '';
		if (app.kind === 'project') {
			shown.status = await appServer(app.id, 'status').catch(() => shown.status);
			log = (shown.status?.log ?? '').split('\n').slice(-LOG_LINES).join('\n').trim();
		}
		const where = app.kind === 'project'
			? `apps/${app.id}/（是一个项目：在哪个文件夹见 apps/${app.id}/app.local.json 或 app.json 的 dev.cwd，没写就是 apps/${app.id}/ 本身）` // i18n-ignore: said to the AI
			: `apps/${app.id}/`;
		const errors = shown.errors.slice(-5).map((error) => `\`\`\`\n${error}\n\`\`\``).join('\n');
		host.askAI([
			`小程序「${app.name}」出错了，代码在 ${where}。`, // i18n-ignore: said to the AI
			errors ? `出的错：\n${errors}` : '', // i18n-ignore: said to the AI
			log ? `它的开发服务器最近的输出：\n\`\`\`\n${log}\n\`\`\`` : '', // i18n-ignore: said to the AI
			'请找出原因并修好，照技能 studio-mini-apps 来。修了三次还不行就停下来告诉我。', // i18n-ignore: said to the AI
		].filter(Boolean).join('\n\n'));
		shown.sheet.hidden = true;
	}

	const STATES: Record<AppStatus['state'], string> = { stopped: t('已停止'), starting: t('启动中…'), running: t('运行中'), failed: t('出错') };

	/** What a project app's bar says of its server, and whether its page can be shown. */
	function told(shown: AppWindow, status: AppStatus): void {
		const before = shown.status?.state;
		shown.status = status;
		if (shown.state) {
			shown.state.textContent = STATES[status.state];
			shown.state.dataset.state = status.state;
			shown.state.title = status.error ?? '';
		}
		if (status.state === 'running' && before !== 'running') load(shown, shown.entry);
		if ((status.state === 'failed' || status.state === 'stopped') && before !== status.state) {
			if (status.error) showSheet(shown, 'log', status.error, status.log || t('（还没有输出）'), [[t('重启'), () => void restart(shown)], [t('让 AI 修'), () => {
				failed(shown, status.error ?? '');
				void askToMend(shown);
			}]]);
		}
	}

	/** Starts a project app's server (`restart`: again), its page shown once it answers. */
	async function start(shown: AppWindow, action: 'start' | 'restart'): Promise<void> {
		shown.sheet.hidden = true;
		told(shown, { state: 'starting', port: null, error: null, log: shown.status?.log ?? '' });
		try {
			told(shown, await appServer(shown.app.id, action));
		} catch (error) {
			told(shown, { state: 'failed', port: null, error: error instanceof Error ? error.message : String(error), log: shown.status?.log ?? '' });
		}
		// Watched while its window is open: one that stops by itself says so.
		shown.polling ??= window.setInterval(() => {
			void appServer(shown.app.id, 'status').then((status) => {
				if (open.get(shown.app.id) === shown && status.state !== shown.status?.state) told(shown, status);
				else if (shown.status) shown.status.log = status.log;
			}, () => {});
		}, 3000);
	}

	function restart(shown: AppWindow): Promise<void> {
		return start(shown, 'restart');
	}

	/** The frame shows a page the Studio did not put there: it gets nothing of the Studio. */
	function leave(shown: AppWindow): void {
		if (!shown.port && !shown.loaded) return;
		cut(shown);
		shown.loaded = false;
		host.toast(t('「{name}」打开了别的网页，那个网页用不了 studio；点 ↻ 回到小程序', { name: shown.app.name }));
	}

	function cut(shown: AppWindow): void {
		shown.port?.close();
		shown.port = null;
	}

	/** The app's page is ready: its line to the Studio, through which alone it is answered. */
	function connect(shown: AppWindow): void {
		cut(shown);
		shown.port = lineTo(shown.frame, shown.app, null);
	}

	/** A line to the app's page in `frame` (just ready), through which alone it is answered; `link`: the block it shows. */
	function lineTo(frame: HTMLIFrameElement, app: MiniApp, link: AppBlockLink | null): MessagePort {
		const channel = new MessageChannel();
		channel.port1.onmessage = (event: MessageEvent) => {
			const data = event.data as { type?: unknown; id?: unknown; method?: unknown; args?: unknown } | null;
			if (!data || data.type !== 'call') return;
			const reply = (message: Record<string, unknown>) => channel.port1.postMessage({ type: 'answer', id: data.id, ...message });
			answer(app, String(data.method), Array.isArray(data.args) ? data.args : [], link).then(
				(result) => reply({ result }),
				(error: unknown) => reply({ error: error instanceof Error ? error.message : String(error) }),
			);
		};
		// The port goes to whatever page is in the frame, which is the app's (just ready).
		frame.contentWindow?.postMessage({ kind: MESSAGE, type: 'port', theme: theme() }, '*', [channel.port2]);
		return channel.port1;
	}

	/** The blocks of articles shown by apps' pages; those no longer in the page let go. */
	const blockFrames = new Set<BlockFrame>();
	function liveBlockFrames(): BlockFrame[] {
		for (const shown of blockFrames) {
			if (shown.root.isConnected) continue;
			shown.port?.close();
			blockFrames.delete(shown);
		}
		return [...blockFrames];
	}

	makeBlockFrame = (id, entry, height, link) => {
		const root = document.createElement('div');
		root.className = 'app-block';
		root.style.height = `${height}px`;
		const say = (text: string) => {
			const note = document.createElement('p');
			note.className = 'app-block-note';
			note.textContent = text;
			return note;
		};
		void listMiniApps().then(async (apps) => {
			const app = apps.find((candidate) => candidate.id === id);
			if (!app || app.problem) return root.replaceChildren(say(app?.problem ?? t('没有小程序「{id}」', { id })));
			const display = () => {
				const frame = document.createElement('iframe');
				frame.className = 'app-block-frame';
				frame.title = app.name;
				frame.setAttribute('allow', 'clipboard-read; clipboard-write; fullscreen');
				const bar = document.createElement('div');
				bar.className = 'app-block-bar';
				const by = document.createElement('span');
				by.className = 'app-block-by';
				by.textContent = t('由小程序「{name}」画', { name: app.name });
				const errors = document.createElement('button');
				errors.type = 'button';
				errors.className = 'app-block-errors';
				errors.hidden = true;
				const windowed = document.createElement('button');
				windowed.type = 'button';
				windowed.textContent = '↗';
				windowed.title = t('在窗口里打开「{name}」', { name: app.name });
				windowed.addEventListener('click', () => show(app, '', { floating: true }));
				const mend = document.createElement('button');
				mend.type = 'button';
				mend.textContent = 'AI';
				mend.title = t('让 AI 改「{name}」', { name: app.name });
				bar.append(by, errors, windowed, mend);
				const shown: BlockFrame = { app, root, frame, port: null, link, errors: [] };
				mend.addEventListener('click', () => askToChange(app, shown.errors));
				errors.addEventListener('click', () => askToChange(app, shown.errors));
				blockFrames.add(shown);
				frame.src = `${home(app)}${entry}`;
				root.replaceChildren(frame, bar);
			};
			if (app.kind !== 'project' || (await appServer(app.id, 'status')).state === 'running') return display();
			const start = document.createElement('button');
			start.type = 'button';
			start.textContent = t('启动「{name}」', { name: app.name });
			start.addEventListener('click', async () => {
				start.disabled = true;
				start.textContent = t('启动中…');
				const status = await appServer(app.id, 'start').catch((error: unknown) => ({ state: 'failed', error: error instanceof Error ? error.message : String(error) }) as const);
				if (status.state === 'running') display();
				else root.replaceChildren(say(status.error ?? t('没能启动')), start);
				start.disabled = false;
				start.textContent = t('再试一次');
			});
			root.replaceChildren(say(t('这一块由小程序「{name}」画：它还没有启动', { name: app.name })), start);
		});
		return root;
	};

	/** Opens `app` (at `entry`): as the 小程序 page, or `floating` in a window; one open already is shown where it is. */
	function show(app: MiniApp, entry = '', { floating = false }: { floating?: boolean } = {}): void {
		const already = open.get(app.id);
		if (already) {
			if (already.docked) {
				present(app.id);
				host.showApps();
			} else focus(already);
			// A command's page: gone to (its server running, for a project).
			if (entry && (app.kind === 'page' || already.status?.state === 'running')) {
				already.entry = entry;
				load(already, entry);
			}
			return;
		}
		// The size its app.json asks, but roomy enough to work in; where it was left, if it was.
		const width = Math.max(app.width, ROOMY.width);
		const height = Math.max(app.height, ROOMY.height);
		const place = fitted(readPlaces()[app.id] ?? { left: innerWidth - width - 40 - open.size * 24, top: 80 + open.size * 24, width, height });
		const root = document.createElement('section');
		root.className = 'mini-app-window';
		root.classList.toggle('is-docked', !floating);
		root.dataset.app = app.id;
		root.setAttribute('aria-label', app.name);
		if (floating) put(root, place);
		const bar = document.createElement('header');
		bar.className = 'mini-app-bar';
		bar.title = t('拖动移动；双击放大或还原');
		// As the page: back to the list of them (it stays open, as it was).
		const back = document.createElement('button');
		back.type = 'button';
		back.className = 'mini-app-back';
		back.textContent = t('‹ 小程序');
		back.title = t('回到小程序列表（它还开着）');
		back.addEventListener('click', () => present(null));
		const title = document.createElement('span');
		title.className = 'mini-app-title';
		title.textContent = `${app.icon} ${app.name}`;
		title.title = app.description;
		const reload = document.createElement('button');
		reload.type = 'button';
		reload.textContent = '↻';
		reload.title = t('重新加载（改了它的代码之后）');
		const shut = document.createElement('button');
		shut.type = 'button';
		shut.textContent = '×';
		shut.title = t('关闭');
		shut.setAttribute('aria-label', t('关闭 {name}', { name: app.name }));
		const errorBadge = document.createElement('button');
		errorBadge.type = 'button';
		errorBadge.className = 'mini-app-errors';
		errorBadge.hidden = true;
		bar.append(back, title, errorBadge);
		let state: HTMLElement | null = null;
		if (app.kind === 'project') {
			state = document.createElement('span');
			state.className = 'mini-app-state';
			const log = document.createElement('button');
			log.type = 'button';
			log.className = 'mini-app-log';
			log.textContent = '≡';
			log.title = t('开发服务器的输出');
			log.addEventListener('click', () => showLog(shown));
			bar.append(state, log);
		}
		const more = document.createElement('button');
		more.type = 'button';
		more.className = 'mini-app-more';
		more.textContent = '⋯';
		more.title = t('看源码、让 AI 改、检查点');
		const switcher = document.createElement('button');
		switcher.type = 'button';
		switcher.className = 'mini-app-switch';
		bar.append(more, switcher, reload, shut);
		const sheet = document.createElement('div');
		sheet.className = 'mini-app-sheet';
		sheet.hidden = true;
		const frame = document.createElement('iframe');
		frame.className = 'mini-app-frame';
		frame.title = app.name;
		// Not sandboxed: the author's own tool, of the Studio's origin (its files load as a page's; `studio` does the rest).
		frame.setAttribute('allow', 'clipboard-read; clipboard-write; fullscreen');
		const shown: AppWindow = { app, root, frame, port: null, loading: false, loaded: false, errors: [], errorBadge, state, status: null, polling: null, sheet, entry, docked: !floating };
		switcher.addEventListener('click', () => move(shown));
		errorBadge.addEventListener('click', () => showErrors(shown));
		more.addEventListener('click', () => showMenu(shown, more));
		// Any page loaded after the app's own that is not of the app's is another one: the app followed a link elsewhere.
		frame.addEventListener('load', () => {
			if (shown.loaded && !ours(shown)) leave(shown);
			else if (!shown.loading) shown.loaded = true;
		});
		if (app.kind === 'project') void start(shown, 'start');
		else load(shown, entry);
		const grips = GRIPS.map((edge) => {
			const grip = document.createElement('div');
			grip.className = 'mini-app-grip';
			grip.dataset.edge = edge;
			return grip;
		});
		root.append(bar, frame, sheet, ...grips);
		labelSwitch(shown);
		open.set(app.id, shown);
		if (floating) {
			layer.append(root);
			focus(shown);
		} else {
			stage.append(root);
			present(app.id);
			host.showApps();
		}
		root.addEventListener('pointerdown', () => focus(shown));
		reload.addEventListener('click', () => {
			clearErrors(shown);
			if (app.kind === 'project' && shown.status?.state !== 'running') void restart(shown);
			else load(shown, `?${Date.now()}`);
		});
		shut.addEventListener('click', () => close(app.id));
		const remember = () => keepPlace(app.id, placeOf(root));
		// Double-click on the bar: as large as the Studio's window allows, and back to where it was.
		let enlarged: Place | null = null;
		/**
		 * Follows the pointer from `handle` until it is let go, `change` given how far it went. The frame takes no
		 * pointer meanwhile, so a quick move does not lose it.
		 */
		const drag = (handle: HTMLElement, event: PointerEvent, change: (start: Place, dx: number, dy: number) => Place) => {
			event.preventDefault();
			const start = placeOf(root);
			const from = { x: event.clientX, y: event.clientY };
			handle.setPointerCapture(event.pointerId);
			frame.style.pointerEvents = 'none';
			const move = (moved: PointerEvent) => {
				put(root, change(start, moved.clientX - from.x, moved.clientY - from.y));
				enlarged = null;
			};
			const up = () => {
				handle.removeEventListener('pointermove', move);
				frame.style.pointerEvents = '';
				remember();
			};
			handle.addEventListener('pointermove', move);
			handle.addEventListener('pointerup', up, { once: true });
			handle.addEventListener('pointercancel', up, { once: true });
		};
		// Moved by its bar, kept on screen.
		bar.addEventListener('pointerdown', (event) => {
			if (shown.docked || (event.target as Element).closest('button')) return;
			drag(bar, event, (start, dx, dy) => fitted({ ...start, left: start.left + dx, top: start.top + dy }));
		});
		// Sized from any edge or corner: the opposite sides stay where they are.
		for (const grip of grips) {
			const edge = grip.dataset.edge ?? '';
			grip.addEventListener('pointerdown', (event) => !shown.docked && drag(grip, event, (start, dx, dy) => {
				const right = start.left + start.width;
				const bottom = start.top + start.height;
				let { left, top, width, height } = start;
				if (edge.includes('e')) width = Math.min(Math.max(start.width + dx, SMALLEST.width), innerWidth - left);
				if (edge.includes('s')) height = Math.min(Math.max(start.height + dy, SMALLEST.height), innerHeight - top);
				if (edge.includes('w')) {
					left = Math.min(Math.max(start.left + dx, 0), right - SMALLEST.width);
					width = right - left;
				}
				if (edge.includes('n')) {
					top = Math.min(Math.max(start.top + dy, 0), bottom - SMALLEST.height);
					height = bottom - top;
				}
				return { left, top, width, height };
			}));
		}
		bar.addEventListener('dblclick', (event) => {
			if (shown.docked || (event.target as Element).closest('button')) return;
			if (enlarged) {
				put(root, fitted(enlarged));
				enlarged = null;
			} else {
				enlarged = placeOf(root);
				put(root, { left: MARGIN, top: MARGIN, width: innerWidth - 2 * MARGIN, height: innerHeight - 2 * MARGIN });
			}
			remember();
		});
	}

	/** What an app asks, if it may: its answer, or why not. */
	async function answer(app: MiniApp, method: string, args: unknown[], link: AppBlockLink | null = null): Promise<unknown> {
		const article = () => {
			const shown = host.article();
			if (!shown) throw new Error(t('还没有打开文章'));
			return shown;
		};
		switch (method) {
			case 'article':
				return article();
			case 'insert':
				article();
				host.insert(String(args[0] ?? ''));
				return true;
			case 'files.list':
				return (await listArticleFiles(article().slug)).map((entry) => ({ path: entry.path, kind: entry.kind, size: entry.size }));
			case 'files.read': {
				const response = await fetch(articleFileUrl(article().slug, `./${String(args[0] ?? '').replace(/^\.\//u, '')}`), { cache: 'no-store' });
				if (!response.ok) throw new Error(t('读不到 {path}', { path: String(args[0]) }));
				return response.text();
			}
			case 'files.write': {
				const path = String(args[0] ?? '').replace(/^\.\//u, '');
				const slash = path.lastIndexOf('/');
				const name = path.slice(slash + 1);
				if (!name) throw new Error(t('要给出文件名'));
				return (await uploadArticleFile(article().slug, slash < 0 ? '' : path.slice(0, slash), new File([String(args[1] ?? '')], name), { replace: true })).path;
			}
			case 'fetch': {
				const init = (args[1] ?? {}) as { method?: string; headers?: Record<string, string>; body?: string };
				return appFetch(app.id, { url: String(args[0]), method: init.method, headers: init.headers, body: init.body });
			}
			case 'run': {
				const argv = Array.isArray(args[0]) ? args[0].map(String) : [];
				const options = (args[1] ?? {}) as { inArticle?: boolean };
				const id = await appRun(app.id, argv, options.inArticle ? article().slug : null);
				// Answered once it is over: what it wrote, and how it ended.
				for (;;) {
					await new Promise((resolve) => setTimeout(resolve, 400));
					const task = await getTask(id);
					if (task.state !== 'running') return { state: task.state, log: task.log, error: task.error };
				}
			}
			case 'toast':
				host.toast(String(args[0] ?? ''));
				return true;
			// A file of its own folder (data.json…), as text; it can also load it itself (`fetch('./data.json')`).
			case 'appFile': {
				const path = String(args[0] ?? '').split('/').map(encodeURIComponent).join('/');
				const response = await fetch(`/studio-apps/${encodeURIComponent(app.id)}/${path}`);
				if (!response.ok) throw new Error(t('「{name}」的文件夹里没有 {path}', { name: app.name, path: String(args[0]) }));
				return response.text();
			}
			// Its own settings (a key it asks for…), kept in this browser (its own `localStorage` is there too now).
			case 'storage.get':
				try {
					return JSON.parse(localStorage.getItem(`studio.app.${app.id}.${String(args[0])}`) ?? 'null');
				} catch {
					return null;
				}
			case 'storage.set':
				localStorage.setItem(`studio.app.${app.id}.${String(args[0])}`, JSON.stringify(args[1] ?? null));
				return true;
			case 'openPage': {
				const options = (args[1] ?? {}) as { find?: unknown };
				host.openPage(String(args[0] ?? ''), typeof options.find === 'string' ? options.find : undefined);
				return true;
			}
			// All the notes' code and pictures, gathered by the server (notes-index.mjs).
			case 'notes.code':
				return notesCode();
			case 'notes.images':
				return notesImages();
			// 代码仓库 (server repos/repositories.mjs).
			case 'repos.list':
				return repos.list();
			case 'repos.found':
				return repos.found();
			case 'repos.add':
				return repos.add(String(args[0] ?? ''));
			case 'repos.create':
				return repos.create(String(args[0] ?? ''), String(args[1] ?? ''));
			case 'repos.remove':
				return repos.remove(String(args[0] ?? ''));
			case 'repos.tree':
				return repos.tree(String(args[0] ?? ''), String(args[1] ?? ''));
			case 'repos.file':
				return repos.file(String(args[0] ?? ''), String(args[1] ?? ''));
			// In a block of an article: its state and options; changed; its picture kept for the blog.
			case 'block.get':
				return link ? { state: link.state(), meta: link.meta() } : null;
			case 'block.set':
				if (!link) throw new Error(t('它不在文章的块里'));
				link.set(String(args[0] ?? ''));
				return true;
			case 'block.picture':
				if (!link) throw new Error(t('它不在文章的块里'));
				return link.picture(String(args[0] ?? ''), String(args[1] ?? 'image/svg+xml'));
			default:
				throw new Error(t('没有 studio.{method}', { method }));
		}
	}

	// Only `ready` and what went wrong come as messages to the window: everything else goes through the app's port.
	window.addEventListener('message', (event) => {
		const data = event.data as { kind?: unknown; type?: unknown; message?: unknown } | null;
		if (!data || data.kind !== MESSAGE) return;
		const shown = [...open.values()].find((candidate) => candidate.frame.contentWindow === event.source);
		if (!shown) {
			// A block's page: given its line when ready (again, as its own page loads again); what goes wrong on its bar.
			const block = liveBlockFrames().find((candidate) => candidate.frame.contentWindow === event.source);
			if (!block) return;
			if (data.type === 'error') {
				reportAppError(block.app.id, String(data.message ?? ''));
				block.errors.push(String(data.message ?? ''));
				const badge = block.root.querySelector<HTMLButtonElement>('.app-block-errors');
				if (badge) {
					badge.hidden = false;
					badge.textContent = `● ${block.errors.length}`;
					badge.title = t('出错了：让 AI 修');
				}
			} else if (data.type === 'ready') {
				let path = '';
				try {
					path = block.frame.contentWindow?.location.pathname ?? '';
				} catch {
					// Another site's page: not the app's.
				}
				if (!path.startsWith(home(block.app))) return;
				block.port?.close();
				block.port = lineTo(block.frame, block.app, block.link);
			}
			return;
		}
		if (data.type === 'error') return failed(shown, String(data.message ?? ''));
		if (data.type !== 'ready') return;
		// Its own page loaded again (its server's reload, a change saved): a new line for it.
		if (!shown.loading && !ours(shown)) return leave(shown);
		shown.loading = false;
		connect(shown);
	});
	// A page app's files changed: its window loads it again.
	import.meta.hot?.on('studio:app-changed', (data: { id?: string }) => {
		const shown = open.get(String(data?.id ?? ''));
		if (shown && shown.app.kind === 'page') {
			clearErrors(shown);
			load(shown, `?${Date.now()}`);
		}
	});
	new MutationObserver(() => {
		for (const shown of [...open.values(), ...liveBlockFrames()]) shown.port?.postMessage({ type: 'theme', theme: theme() });
	}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

	/** 新建小程序: made from its template, opened, and the AI asked (in its panel, for the author to finish) to write it. */
	async function makeApp(name: string, template: 'page' | 'react'): Promise<void> {
		try {
			const app = await createApp(name, template);
			show(app);
			const kind = template === 'react' ? '一个 Vite + React + TypeScript 项目（Studio 用它自己的开发服务器跑，改了热更新）' : '一页网页（app.html，改了保存窗口自己重新加载）'; // i18n-ignore: said to the AI
			host.askAI(`做小程序「${app.name}」：已经从模板建好了，在 ${app.folder}/，是${kind}。照技能 studio-mini-apps 写。我想要：`); // i18n-ignore: said to the AI
		} catch (error) {
			host.toast(error instanceof Error ? error.message : String(error));
		}
	}

	/** A note or its files changed: the apps are told, once for a burst of changes. */
	let notesTimer = 0;
	function notesChanged(): void {
		window.clearTimeout(notesTimer);
		notesTimer = window.setTimeout(() => {
			for (const shown of [...open.values(), ...liveBlockFrames()]) shown.port?.postMessage({ type: 'notes-changed' });
		}, 400);
	}

	return {
		notesChanged,
		/** 新建小程序…: its name and template asked, then made. */
		create(): void {
			openDialog('newApp', { done: (asked) => asked && void makeApp(asked.name, asked.template) });
		},
		/** The 小程序 page come to: the app left open there, or their list. */
		shown(): void {
			present(current && open.get(current)?.docked ? current : null);
		},
		/** Their list, on the 小程序 page (what is open there stays open). */
		list(): void {
			present(null);
		},
		/** Opens an app by its folder name (apps/<id>), at a page of its (`entry`: a command's), as the 小程序 page. */
		async open(id: string, entry = ''): Promise<void> {
			const app = (await listMiniApps()).find((candidate) => candidate.id === id);
			if (app && !app.problem) show(app, entry);
		},
	};
}
