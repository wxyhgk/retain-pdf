import { CircleHelp } from 'lucide-react';

import { appFetch, appRun, articleFileUrl, getTask, listArticleFiles, listMiniApps, uploadArticleFile, type MiniApp } from '../api/client';
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
type AppWindow = { app: MiniApp; root: HTMLElement; frame: HTMLIFrameElement; port: MessagePort | null; loading: boolean; loaded: boolean };

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
 * corner, as large as the Studio's window by a double-click on its bar, where it was left the next time), in a frame with no origin of its own. What an app asks of the Studio comes as
 * messages, each answered only when its app.json asked for what it needs (`permissions`).
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
		shown?.root.remove();
		open.delete(id);
	}

	/** Puts the app's own page in its frame (again, with `query`), to be given a line when it is ready. */
	function load(shown: AppWindow, query = ''): void {
		cut(shown);
		shown.loading = true;
		shown.loaded = false;
		shown.frame.src = `/studio-apps/${encodeURIComponent(shown.app.id)}/${query}`;
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
		// The frame has no origin to name: the port goes to whatever page is in it, which is the app's (just ready).
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
		bar.append(title, reload, shut);
		const frame = document.createElement('iframe');
		frame.className = 'mini-app-frame';
		frame.title = app.name;
		// Scripts, forms, its own windows and downloads; never the Studio's origin.
		frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-modals allow-downloads');
		const shown: AppWindow = { app, root, frame, port: null, loading: false, loaded: false };
		// Any page loaded after the app's own is another one: the app followed a link, or went elsewhere.
		frame.addEventListener('load', () => {
			if (shown.loaded) leave(shown);
			else if (!shown.loading) shown.loaded = true;
		});
		load(shown);
		const grips = GRIPS.map((edge) => {
			const grip = document.createElement('div');
			grip.className = 'mini-app-grip';
			grip.dataset.edge = edge;
			return grip;
		});
		root.append(bar, frame, ...grips);
		layer.append(root);
		open.set(app.id, shown);
		focus(shown);
		root.addEventListener('pointerdown', () => focus(shown));
		reload.addEventListener('click', () => load(shown, `?${Date.now()}`));
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
		const may = (permission: string) => {
			if (!app.permissions.includes(permission)) throw new Error(t('「{name}」的 app.json 里没有要「{permission}」权限', { name: app.name, permission }));
		};
		const article = () => {
			const shown = host.article();
			if (!shown) throw new Error(t('还没有打开文章'));
			return shown;
		};
		switch (method) {
			case 'article':
				may('article');
				return article();
			case 'insert':
				may('insert');
				article();
				host.insert(String(args[0] ?? ''));
				return true;
			case 'files.list':
				may('files');
				return (await listArticleFiles(article().slug)).map((entry) => ({ path: entry.path, kind: entry.kind, size: entry.size }));
			case 'files.read': {
				may('files');
				const response = await fetch(articleFileUrl(article().slug, `./${String(args[0] ?? '').replace(/^\.\//u, '')}`), { cache: 'no-store' });
				if (!response.ok) throw new Error(t('读不到 {path}', { path: String(args[0]) }));
				return response.text();
			}
			case 'files.write': {
				may('files');
				const path = String(args[0] ?? '').replace(/^\.\//u, '');
				const slash = path.lastIndexOf('/');
				const name = path.slice(slash + 1);
				if (!name) throw new Error(t('要给出文件名'));
				return (await uploadArticleFile(article().slug, slash < 0 ? '' : path.slice(0, slash), new File([String(args[1] ?? '')], name), { replace: true })).path;
			}
			case 'fetch': {
				may('net');
				const init = (args[1] ?? {}) as { method?: string; headers?: Record<string, string>; body?: string };
				return appFetch(app.id, { url: String(args[0]), method: init.method, headers: init.headers, body: init.body });
			}
			case 'run': {
				may('run');
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
			// A file of its own folder (data.json…), as text: the frame cannot load it itself (it has no origin, and the
			// dev server serves no other site's subresources), the Studio can.
			case 'appFile': {
				const path = String(args[0] ?? '').split('/').map(encodeURIComponent).join('/');
				const response = await fetch(`/studio-apps/${encodeURIComponent(app.id)}/${path}`);
				if (!response.ok) throw new Error(t('「{name}」的文件夹里没有 {path}', { name: app.name, path: String(args[0]) }));
				return response.text();
			}
			// Its own settings (a key it asks for…), kept in this browser: the frame has no storage of its own.
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

	// Only `ready` comes as a message to the window: everything else goes through the app's port.
	window.addEventListener('message', (event) => {
		const data = event.data as { kind?: unknown; type?: unknown } | null;
		if (!data || data.kind !== MESSAGE || data.type !== 'ready') return;
		const shown = [...open.values()].find((candidate) => candidate.frame.contentWindow === event.source);
		if (!shown) return;
		if (!shown.loading) return leave(shown);
		shown.loading = false;
		connect(shown);
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
