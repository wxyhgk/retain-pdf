import { CircleHelp } from 'lucide-react';

import { appFetch, appRun, appServer, articleFileUrl, getTask, listArticleFiles, listMiniApps, uploadArticleFile, type AppStatus, type MiniApp } from '../api/client';
import { showContextMenu, type MenuItem } from '../common/context-menu';
import { t } from '@blog/i18n/index.mjs';

/** What the 小程序 may reach of the Studio around them, through their bridge (server/apps/mini-apps.mjs). */
export type MiniAppsHost = {
	/** The article shown: its folder name, title and Markdown; null when none is. */
	article(): { slug: string; title: string; source: string } | null;
	/** Puts Markdown into the article where the caret is. */
	insert(markdown: string): void;
	toast(message: string): void;
	openPage(slug: string): void;
	/** Puts `prompt` in the AI panel's input (shown), for the author to send. */
	askAI(prompt: string): void;
};

const MESSAGE = 'studio-app';
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
 * 小程序: the tools of apps/, each in a floating window over the Studio (moved by its bar, sized from any edge or
 * corner, as large as the Studio's window by a double-click on its bar, where it was left the next time), in a frame of the
 * Studio's own origin, not sandboxed (the author's own tools). What an app asks of the Studio comes as messages, each
 * answered: every app may do all it asks.
 */
export function createMiniApps(launcher: HTMLButtonElement, layer: HTMLElement, host: MiniAppsHost) {
	const open = new Map<string, AppWindow>();
	let top = 70;

	function focus(shown: AppWindow): void {
		shown.root.style.zIndex = String(++top);
	}

	function close(id: string): void {
		const shown = open.get(id);
		shown?.port?.close();
		if (shown?.polling) clearInterval(shown.polling);
		shown?.root.remove();
		open.delete(id);
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

	/** Its errors (and its server's last output) put in the AI panel's input, for the author to send. */
	async function askToMend(shown: AppWindow): Promise<void> {
		const { app } = shown;
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
		if (status.state === 'running' && before !== 'running') load(shown);
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
		const channel = new MessageChannel();
		shown.port = channel.port1;
		channel.port1.onmessage = (event: MessageEvent) => {
			const data = event.data as { type?: unknown; id?: unknown; method?: unknown; args?: unknown } | null;
			if (!data || data.type !== 'call') return;
			const reply = (message: Record<string, unknown>) => channel.port1.postMessage({ type: 'answer', id: data.id, ...message });
			answer(shown.app, String(data.method), Array.isArray(data.args) ? data.args : []).then(
				(result) => reply({ result }),
				(error: unknown) => reply({ error: error instanceof Error ? error.message : String(error) }),
			);
		};
		// The port goes to whatever page is in the frame, which is the app's (just ready).
		shown.frame.contentWindow?.postMessage({ kind: MESSAGE, type: 'port', theme: theme() }, '*', [channel.port2]);
	}

	function show(app: MiniApp): void {
		const already = open.get(app.id);
		if (already) {
			focus(already);
			return;
		}
		// The size its app.json asks, but roomy enough to work in; where it was left, if it was.
		const width = Math.max(app.width, ROOMY.width);
		const height = Math.max(app.height, ROOMY.height);
		const place = fitted(readPlaces()[app.id] ?? { left: innerWidth - width - 40 - open.size * 24, top: 80 + open.size * 24, width, height });
		const root = document.createElement('section');
		root.className = 'mini-app-window';
		root.dataset.app = app.id;
		root.setAttribute('aria-label', app.name);
		put(root, place);
		const bar = document.createElement('header');
		bar.className = 'mini-app-bar';
		bar.title = t('拖动移动；双击放大或还原');
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
		bar.append(title, errorBadge);
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
		bar.append(reload, shut);
		const sheet = document.createElement('div');
		sheet.className = 'mini-app-sheet';
		sheet.hidden = true;
		const frame = document.createElement('iframe');
		frame.className = 'mini-app-frame';
		frame.title = app.name;
		// Not sandboxed: the author's own tool, of the Studio's origin (its files load as a page's; `studio` does the rest).
		frame.setAttribute('allow', 'clipboard-read; clipboard-write; fullscreen');
		const shown: AppWindow = { app, root, frame, port: null, loading: false, loaded: false, errors: [], errorBadge, state, status: null, polling: null, sheet };
		errorBadge.addEventListener('click', () => showErrors(shown));
		// Any page loaded after the app's own that is not of the app's is another one: the app followed a link elsewhere.
		frame.addEventListener('load', () => {
			if (shown.loaded && !ours(shown)) leave(shown);
			else if (!shown.loading) shown.loaded = true;
		});
		if (app.kind === 'project') void start(shown, 'start');
		else load(shown);
		const grips = GRIPS.map((edge) => {
			const grip = document.createElement('div');
			grip.className = 'mini-app-grip';
			grip.dataset.edge = edge;
			return grip;
		});
		root.append(bar, frame, sheet, ...grips);
		layer.append(root);
		open.set(app.id, shown);
		focus(shown);
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
			if ((event.target as Element).closest('button')) return;
			drag(bar, event, (start, dx, dy) => fitted({ ...start, left: start.left + dx, top: start.top + dy }));
		});
		// Sized from any edge or corner: the opposite sides stay where they are.
		for (const grip of grips) {
			const edge = grip.dataset.edge ?? '';
			grip.addEventListener('pointerdown', (event) => drag(grip, event, (start, dx, dy) => {
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
			if ((event.target as Element).closest('button')) return;
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
	async function answer(app: MiniApp, method: string, args: unknown[]): Promise<unknown> {
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
			case 'openPage':
				host.openPage(String(args[0] ?? ''));
				return true;
			default:
				throw new Error(t('没有 studio.{method}', { method }));
		}
	}

	// Only `ready` and what went wrong come as messages to the window: everything else goes through the app's port.
	window.addEventListener('message', (event) => {
		const data = event.data as { kind?: unknown; type?: unknown; message?: unknown } | null;
		if (!data || data.kind !== MESSAGE) return;
		const shown = [...open.values()].find((candidate) => candidate.frame.contentWindow === event.source);
		if (!shown) return;
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
		for (const shown of open.values()) shown.port?.postMessage({ type: 'theme', theme: theme() });
	}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

	launcher.addEventListener('click', () => {
		void listMiniApps().then(
			(apps) => {
				const items: MenuItem[] = apps.map((app) => ({
					label: app.name,
					icon: app.icon,
					hint: app.problem ? t('出错') : undefined,
					action: () => (app.problem ? host.toast(`${app.name}：${app.problem}`) : show(app)),
				}));
				if (items.length) items.push('separator');
				items.push({ label: t('怎么做一个小程序…'), icon: CircleHelp, action: () => host.toast(t('在终端里让 AI 做一个，比如「做一个能量单位换算的小程序」：它会照着技能 studio-mini-apps 写进 apps/。')) });
				showContextMenu(items, launcher);
			},
			(error: unknown) => host.toast(error instanceof Error ? error.message : t('读不到小程序')),
		);
	});

	return {
		/** Opens an app by its folder name (apps/<id>). */
		async open(id: string): Promise<void> {
			const app = (await listMiniApps()).find((candidate) => candidate.id === id);
			if (app && !app.problem) show(app);
		},
	};
}
