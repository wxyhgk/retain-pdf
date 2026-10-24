import { appFetch, appRun, articleFileUrl, getTask, listArticleFiles, listMiniApps, uploadArticleFile, type MiniApp } from '../api/client';
import { showContextMenu, type MenuItem } from './context-menu';

/** What the 小程序 may reach of the Studio around them, through their bridge (server/mini-apps.mjs). */
export type MiniAppsHost = {
	/** The article shown: its folder name, title and Markdown; null when none is. */
	article(): { slug: string; title: string; source: string } | null;
	/** Puts Markdown into the article where the caret is. */
	insert(markdown: string): void;
	toast(message: string): void;
	openPage(slug: string): void;
};

const MESSAGE = 'studio-app';
const PLACES = 'studio.mini-app-places';

type Place = { left: number; top: number; width: number; height: number };
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

/**
 * 小程序: the tools of apps/, each in a floating window over the Studio (moved by its bar, sized from its corner,
 * where it was left the next time), in a frame with no origin of its own. What an app asks of the Studio comes as
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
		host.toast(`「${shown.app.name}」打开了别的网页，那个网页用不了 studio；点 ↻ 回到小程序`);
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
		const saved = readPlaces()[app.id];
		const place: Place = saved ?? { left: Math.max(16, innerWidth - app.width - 40 - open.size * 24), top: 80 + open.size * 24, width: app.width, height: app.height };
		const root = document.createElement('section');
		root.className = 'mini-app-window';
		root.dataset.app = app.id;
		root.setAttribute('aria-label', app.name);
		Object.assign(root.style, { left: `${Math.min(place.left, innerWidth - 120)}px`, top: `${Math.min(place.top, innerHeight - 60)}px`, width: `${place.width}px`, height: `${place.height}px` });
		const bar = document.createElement('header');
		bar.className = 'mini-app-bar';
		const title = document.createElement('span');
		title.className = 'mini-app-title';
		title.textContent = `${app.icon} ${app.name}`;
		title.title = app.description;
		const reload = document.createElement('button');
		reload.type = 'button';
		reload.textContent = '↻';
		reload.title = '重新加载（改了它的代码之后）';
		const shut = document.createElement('button');
		shut.type = 'button';
		shut.textContent = '×';
		shut.title = '关闭';
		shut.setAttribute('aria-label', `关闭 ${app.name}`);
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
		root.append(bar, frame);
		layer.append(root);
		open.set(app.id, shown);
		focus(shown);
		root.addEventListener('pointerdown', () => focus(shown));
		reload.addEventListener('click', () => load(shown, `?${Date.now()}`));
		shut.addEventListener('click', () => close(app.id));
		const remember = () => keepPlace(app.id, { left: root.offsetLeft, top: root.offsetTop, width: root.offsetWidth, height: root.offsetHeight });
		new ResizeObserver(remember).observe(root);
		// Moved by its bar; the frame takes no pointer meanwhile, so a quick move does not lose it.
		bar.addEventListener('pointerdown', (event) => {
			if ((event.target as Element).closest('button')) return;
			const start = { x: event.clientX, y: event.clientY, left: root.offsetLeft, top: root.offsetTop };
			bar.setPointerCapture(event.pointerId);
			frame.style.pointerEvents = 'none';
			const move = (moved: PointerEvent) => {
				root.style.left = `${Math.max(0, Math.min(innerWidth - 80, start.left + moved.clientX - start.x))}px`;
				root.style.top = `${Math.max(0, Math.min(innerHeight - 40, start.top + moved.clientY - start.y))}px`;
			};
			const up = () => {
				bar.removeEventListener('pointermove', move);
				frame.style.pointerEvents = '';
				remember();
			};
			bar.addEventListener('pointermove', move);
			bar.addEventListener('pointerup', up, { once: true });
		});
	}

	/** What an app asks, if it may: its answer, or why not. */
	async function answer(app: MiniApp, method: string, args: unknown[]): Promise<unknown> {
		const may = (permission: string) => {
			if (!app.permissions.includes(permission)) throw new Error(`「${app.name}」的 app.json 里没有要「${permission}」权限`);
		};
		const article = () => {
			const shown = host.article();
			if (!shown) throw new Error('还没有打开文章');
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
				if (!response.ok) throw new Error(`读不到 ${String(args[0])}`);
				return response.text();
			}
			case 'files.write': {
				may('files');
				const path = String(args[0] ?? '').replace(/^\.\//u, '');
				const slash = path.lastIndexOf('/');
				const name = path.slice(slash + 1);
				if (!name) throw new Error('要给出文件名');
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
				if (!response.ok) throw new Error(`「${app.name}」的文件夹里没有 ${String(args[0])}`);
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
				throw new Error(`没有 studio.${method}`);
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
					label: `${app.icon}  ${app.name}`,
					hint: app.problem ? '出错' : undefined,
					action: () => (app.problem ? host.toast(`${app.name}：${app.problem}`) : show(app)),
				}));
				if (items.length) items.push('separator');
				items.push({ label: '怎么做一个小程序…', action: () => host.toast('在终端里让 AI 做一个，比如「做一个能量单位换算的小程序」：它会照着技能 studio-mini-apps 写进 apps/。') });
				showContextMenu(items, launcher);
			},
			(error: unknown) => host.toast(error instanceof Error ? error.message : '读不到小程序'),
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
