import { AppWindow, Maximize2, PanelRight, PictureInPicture2 } from 'lucide-react';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { t } from '@blog/i18n/index.mjs';
import { appServer, keepNote, listMiniApps, reportAppError } from '../api/client';
import { createAiPanel } from '../ai/ai-panel';
import { showContextMenu } from '../common/context-menu';
import { showToast } from '../common/toast';
import { ContextMenu } from '../shell/ContextMenu';
import { Dialogs } from '../shell/dialogs/Dialogs';
import { Toast } from '../shell/Toast';
import { studioLine } from './studio-line';
import { followTheme } from '../common/theme';

/**
 * A window of its own (StudioWindow.astro, 显示方式 › 新窗口): a 小程序 (`?app=<id>&at=<its page>`) or the AI (`?ai`),
 * out of the Studio's window. What only the Studio can do is asked of it (studio-line.ts); 放回 Studio puts it back.
 */
const body = document.querySelector<HTMLElement>('#window-body')!;
// Menus, messages and dialogs as the Studio draws them.
flushSync(() =>
	createRoot(document.querySelector<HTMLElement>('#ui-layer')!).render(
		createElement('div', null, createElement(Dialogs), createElement(ContextMenu), createElement(Toast)),
	),
);

/** The light or dark the Studio was put in (kept by it in localStorage), or the system's, followed here. */
followTheme();

const asked = new URLSearchParams(location.search);
const appId = asked.get('app');
if (appId) void appWindow(appId, asked.get('at') ?? '');
else if (asked.has('ai')) aiWindow();
else body.append(note(t('不知道要打开什么')));

function note(text: string): HTMLElement {
	const element = document.createElement('p');
	element.className = 'window-note';
	element.textContent = text;
	return element;
}

/**
 * This window shut (put back into the Studio). WebKit lets a page shut only a window it opened itself: in the Mac app,
 * whose window this is, the page asks Studio.app to (studio-action://close).
 */
function shutWindow(): void {
	// The Mac app's window (Tauri's): WebKit takes window.close() as done (window.closed turns true) without the window
	// shutting, so it is not asked so; Studio.app shuts it seeing this title (or, failing that, going to studio-action://close).
	if ('__TAURI_INTERNALS__' in window) {
		tell('关窗：改标题请 Studio.app 关'); // i18n-ignore: developer log
		document.title = 'studio:close';
		window.setTimeout(() => {
			tell('关窗：标题没关掉，跳到 studio-action://close'); // i18n-ignore: developer log
			location.href = 'studio-action://close';
		}, 600);
		return;
	}
	// A popup the Studio opened (in a browser): shut at once.
	window.close();
}

/** What happened in this window, kept in the blog's .studio-cache/studio-notes.log (to find out why something did not work). */
function tell(what: string): void {
	void keepNote(`[独立窗口 ${location.search}] ${what}（${navigator.userAgent}${'__TAURI_INTERNALS__' in window ? '，Tauri' : ''}）`).catch(() => {}); // i18n-ignore: developer log
}

/** 显示方式 in a window of its own: back into the Studio, shown there so (侧栏, 悬浮, 全屏); or this window, as it is. */
function layoutMenu(anchor: HTMLElement, back: (where: 'side' | 'float' | 'full') => Promise<unknown>): void {
	const go = (where: 'side' | 'float' | 'full') => {
		tell(`显示方式：选了 ${where}`); // i18n-ignore: developer log
		void back(where).then(
			() => {
				tell(`显示方式：Studio 已经放回 ${where}`); // i18n-ignore: developer log
				shutWindow();
			},
			(error: unknown) => {
				tell(`显示方式：Studio 没能放回：${error instanceof Error ? error.message : String(error)}`); // i18n-ignore: developer log
				showToast(error instanceof Error ? error.message : String(error), true);
			},
		);
	};
	showContextMenu(
		[
			{ label: t('侧栏'), icon: PanelRight, action: () => go('side') },
			{ label: t('悬浮'), icon: PictureInPicture2, action: () => go('float') },
			{ label: t('全屏'), icon: Maximize2, action: () => go('full') },
			'separator',
			{ label: t('新窗口'), icon: AppWindow, hint: '✓', action: () => {} },
		],
		anchor,
	);
}

function barButton(text: string, title: string, run: () => void): HTMLButtonElement {
	const button = document.createElement('button');
	button.type = 'button';
	button.textContent = text;
	button.title = title;
	button.addEventListener('click', run);
	return button;
}

/** A 小程序 in this window: its page in a frame, its `studio` calls asked of the Studio. */
async function appWindow(id: string, at: string): Promise<void> {
	const line = studioLine(`app:${id}`);
	const app = (await listMiniApps().catch(() => [])).find((candidate) => candidate.id === id);
	if (!app || app.problem) {
		body.append(note(app?.problem ?? t('没有小程序「{id}」', { id })));
		return;
	}
	document.title = `${app.icon} ${app.name}`;
	const home = `/studio-apps/${encodeURIComponent(app.id)}/`;
	const bar = document.createElement('header');
	bar.className = 'window-bar';
	const title = document.createElement('span');
	title.className = 'window-title';
	title.textContent = `${app.icon} ${app.name}`;
	const errors: string[] = [];
	const badge = barButton('', t('出错了'), () => showToast(errors.at(-1) ?? '', true));
	badge.className = 'window-errors';
	badge.hidden = true;
	const frame = document.createElement('iframe');
	frame.className = 'window-frame';
	frame.title = app.name;
	frame.setAttribute('allow', 'clipboard-read; clipboard-write; fullscreen');
	const reload = barButton('↻', t('重新加载（改了它的代码之后）'), () => {
		errors.length = 0;
		badge.hidden = true;
		frame.src = `${home}?${Date.now()}`;
	});
	// 显示方式, as in the Studio: back into it, shown there as chosen, at the page it is at here.
	const layout = barButton('⧉', t('显示方式：放回 Studio 的侧栏、悬浮、全屏'), () =>
		layoutMenu(layout, (where) => {
			let here = '';
			try {
				const shown = frame.contentWindow?.location;
				here = shown ? shown.pathname + shown.search + shown.hash : '';
			} catch {
				// Not the app's own page: back at its own.
			}
			return line.call('app.dock', id, where === 'full' ? 'page' : where, here);
		}),
	);
	layout.className = 'window-layout';
	layout.setAttribute('aria-label', t('显示方式'));
	bar.append(title, badge, reload, layout);
	body.append(bar, frame);

	let port: MessagePort | null = null;
	const theme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
	addEventListener('message', (event) => {
		const data = event.data as { kind?: unknown; type?: unknown; message?: unknown } | null;
		if (event.source !== frame.contentWindow || data?.kind !== 'studio-app') return;
		if (data.type === 'error') {
			const message = String(data.message ?? '');
			reportAppError(app.id, message);
			errors.push(message);
			badge.hidden = false;
			badge.textContent = `● ${errors.length}`;
			return;
		}
		if (data.type !== 'ready') return;
		// Only to the app's own page: one it went to elsewhere gets nothing of the Studio.
		let path = '';
		try {
			path = frame.contentWindow?.location.pathname ?? '';
		} catch {
			// Another site's page.
		}
		if (!path.startsWith(home)) return;
		port?.close();
		const channel = new MessageChannel();
		channel.port1.onmessage = (message: MessageEvent) => {
			const call = message.data as { type?: unknown; id?: unknown; method?: unknown; args?: unknown } | null;
			if (call?.type !== 'call') return;
			const reply = (more: Record<string, unknown>) => channel.port1.postMessage({ type: 'answer', id: call.id, ...more });
			line.call('app.call', id, String(call.method), Array.isArray(call.args) ? call.args : []).then(
				(result) => reply({ result }),
				(error: unknown) => reply({ error: error instanceof Error ? error.message : String(error) }),
			);
		};
		frame.contentWindow?.postMessage({ kind: 'studio-app', type: 'port', theme: theme() }, '*', [channel.port2]);
		port = channel.port1;
	});
	line.on((event) => {
		if (event === 'notes-changed') port?.postMessage({ type: 'notes-changed' });
	});
	new MutationObserver(() => port?.postMessage({ type: 'theme', theme: theme() })).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
	// A project app: its own development server, started if it is not.
	if (app.kind === 'project') await appServer(app.id, 'start').catch(() => null);
	frame.src = at.startsWith(home) ? at : home;
}

type AiState = { article: { slug: string; title: string } | null; hasSelection: boolean; articles: ReturnType<Parameters<typeof createAiPanel>[1]['articles']>; conversation: string | null };

/** The AI in this window: the panel as the Studio has it; what it knows of the article open, asked of the Studio. */
function aiWindow(): void {
	const line = studioLine('ai');
	document.title = t('AI · Studio');
	const pane = document.createElement('section');
	pane.className = 'ai-pane';
	body.append(pane);
	let state: AiState = { article: null, hasSelection: false, articles: [], conversation: null };
	const said = (error: unknown) => showToast(error instanceof Error ? error.message : String(error), true);
	const panel = createAiPanel(pane, {
		article: () => state.article,
		articles: () => state.articles,
		openArticle: (slug) => void line.call('ai.openArticle', slug).catch(said),
		hasSelection: () => state.hasSelection,
		selection: () => line.call('ai.selection'),
		toast: (message) => showToast(message),
		runInTerminal: (command) => void line.call('ai.runInTerminal', command).catch(said),
		insert(markdown) {
			if (!state.article) return false;
			void line.call('ai.insert', markdown).catch(said);
			return true;
		},
		// 显示方式 here: back into the Studio, as it is shown there; or this window, as it is.
		layout: (anchor) => layoutMenu(anchor, (where) => line.call('ai.dock', where, panel.current())),
		// Its turn over: what it changed in the article open, held in the Studio meanwhile, looked over there now.
		turnOver: () => void line.call('ai.working', false).catch(() => {}),
	});
	// At work: the Studio holds what it changes in the article open, as it does for the AI shown there.
	let working = false;
	window.setInterval(() => {
		if (panel.working() === working) return;
		working = panel.working();
		void line.call('ai.working', working).catch(() => {});
	}, 250);
	panel.setFloating(false);
	// On screen: the AIs read (a conversation begun if none is shown).
	panel.shown();
	/** What the Studio has open now: the article, whether something is selected in it; asked again every while. */
	const follow = async () => {
		try {
			const now = await line.call<AiState>('ai.state');
			const before = state;
			const first = before.conversation === null && now.conversation;
			state = now;
			if (now.article?.slug !== before.article?.slug || now.article?.title !== before.article?.title) panel.showArticle(now.article);
			if (now.hasSelection !== before.hasSelection) panel.articleShown();
			if (first) await panel.open(now.conversation!);
		} catch {
			// The Studio shut: what was known stays.
		}
	};
	void follow();
	window.setInterval(() => document.visibilityState === 'visible' && void follow(), 1500);
}
