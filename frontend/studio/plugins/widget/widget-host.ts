import { t } from '@blog/i18n/index.mjs';
import { WIDGET_ASK, WIDGET_START, WIDGET_STATE, type WidgetAsk, type WidgetStart, type WidgetTold } from '@blog/kernel/widget-events.ts';
import { WIDGET_MESSAGE, publicArticlePath, widgetDocument, widgetOptions } from './widgets.mjs';

/**
 * The page's side of the widgets (widgets.mjs): each frame says how tall it
 * is and is told the theme, now and whenever it changes; a frame that asks
 * for a file of the article (`note.file()`) is sent its text. The blog and
 * the Studio both use it; the Studio also makes its frames here, and tells
 * it when the article's files change, so the widgets that use them start over.
 *
 * What a widget asks of the AI (`note.ask`) and tells it (`note.tell`) is an
 * event on its figure, for what it is in to take (@blog/kernel/widget-events.ts).
 */

const FRAMES = 'iframe.note-widget-frame';

/** How long a widget waits between two things it asks. */
const ASK_GAP = 2000;
/** How much a widget may tell of itself (its JSON). */
const STATE_LENGTH = 20_000;

/** By frame: the figure it speaks for (the frame's own, or, made larger, the one it was made from). */
const speaksFor = new WeakMap<HTMLIFrameElement, HTMLElement>();
/** By frame: when it last asked. */
const lastAsked = new WeakMap<HTMLIFrameElement, number>();

const theme = (): 'dark' | 'light' => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

/** The page's colors now (global.css's tokens, light or dark, as a plugin may have set them), for a frame, which cannot read them. */
function colors(): Record<string, string> {
	const style = getComputedStyle(document.documentElement);
	const token = (name: string) => style.getPropertyValue(name).trim();
	// The grays are kept as "r, g, b" (rgb(var(--gray))).
	return { ink: `rgb(${token('--gray-dark')})`, muted: `rgb(${token('--gray')})`, line: `rgb(${token('--gray-light')})`, soft: token('--surface-soft'), surface: token('--surface'), danger: token('--danger') };
}

/** Where a published file of the article (`assets/opt.log`) is fetched from; null until an article is shown. */
let fileUrl: ((path: string) => string) | null = null;

/** The files each frame has read, to start it over when one changes. */
const reads = new WeakMap<HTMLIFrameElement, Set<string>>();

/** Sets where the article's files are fetched from, for `note.file()` and widgets that are files. */
export function setWidgetFiles(url: ((path: string) => string) | null): void {
	fileUrl = url;
}

function post(frame: HTMLIFrameElement, message: Record<string, unknown>): void {
	// The frame has no origin of its own: '*' is the only way to reach it.
	frame.contentWindow?.postMessage({ kind: WIDGET_MESSAGE, ...message }, '*');
}

function tellTheme(frame: HTMLIFrameElement): void {
	post(frame, { type: 'theme', theme: theme(), colors: colors() });
}

/** The text of a published file of the article. */
async function fetchText(path: string): Promise<string> {
	if (!fileUrl) throw new Error(t('还没有打开页面'));
	const response = await fetch(fileUrl(path), { cache: 'no-store' });
	if (!response.ok) throw new Error(t('找不到 ./{path}', { path }));
	return response.text();
}

async function answerFile(frame: HTMLIFrameElement, id: unknown, written: unknown): Promise<void> {
	const path = publicArticlePath(String(written ?? ''));
	if (!path) {
		post(frame, { type: 'file', id, error: t('{path} 不在页面的 img/ 或 assets/ 里', { path: String(written) }) });
		return;
	}
	const read = reads.get(frame) ?? new Set<string>();
	read.add(path);
	reads.set(frame, read);
	try {
		post(frame, { type: 'file', id, text: await fetchText(path) });
	} catch (error) {
		post(frame, { type: 'file', id, error: error instanceof Error ? error.message : String(error) });
	}
}

/** Whether what goes wrong in a widget is said under it (the Studio's, for the author; not the blog's readers). */
let showingErrors = false;

/** Says what goes wrong in widgets under them, or not. */
export function showWidgetErrors(shown: boolean): void {
	showingErrors = shown;
}

/** What went wrong in a widget, said under it: the first, and how many more. */
function sayError(frame: HTMLIFrameElement, message: unknown, line: unknown): void {
	const figure = figureOf(frame);
	if (!showingErrors || !figure) return;
	let said = figure.querySelector<HTMLElement>(':scope > .note-widget-error');
	if (!said) {
		said = document.createElement('p');
		said.className = 'note-widget-error';
		said.setAttribute('role', 'status');
		figure.append(said);
	}
	const count = Number(said.dataset.count ?? 0) + 1;
	said.dataset.count = String(count);
	const text = String(message ?? '').slice(0, 300) || t('不知道什么错');
	if (count === 1) said.dataset.first = typeof line === 'number' ? t('第 {line} 行：{text}', { line, text }) : text;
	said.textContent = t('交互模块出错了：{first}', { first: said.dataset.first ?? text }) + (count > 1 ? t('（还有 {more} 处）', { more: count - 1 }) : '');
}

let connected = false;

/** Listens to the page's widgets: once is enough, wherever they are or come later. */
export function connectWidgets(): void {
	if (connected) return;
	connected = true;
	window.addEventListener('message', (event) => {
		const data = event.data as { kind?: unknown; type?: unknown; height?: unknown; id?: unknown; path?: unknown; text?: unknown; message?: unknown; line?: unknown; missing?: unknown } | null;
		if (!data || data.kind !== WIDGET_MESSAGE) return;
		const frame = [...document.querySelectorAll<HTMLIFrameElement>(FRAMES)].find((candidate) => candidate.contentWindow === event.source);
		if (!frame) return;
		if (data.type === 'ready') {
			// Started (again): what went wrong before is not known of this one.
			figureOf(frame)?.querySelector(':scope > .note-widget-error')?.remove();
			tellTheme(frame);
		} else if (data.type === 'error') sayError(frame, typeof data.missing === 'string' ? t('没加载到 {src}', { src: data.missing }) : data.message, data.line);
		else if (data.type === 'height' && typeof data.height === 'number' && Number.isFinite(data.height)) {
			// Made larger, it fills its room.
			if (!frame.dataset.fills) frame.style.height = `${Math.max(24, Math.min(4000, Math.ceil(data.height)))}px`;
		} else if (data.type === 'file') void answerFile(frame, data.id, data.path);
		else if (data.type === 'ask') post(frame, { type: 'asked', id: data.id, said: asked(frame, data.text) });
		else if (data.type === 'escape') frame.closest<HTMLDialogElement>('dialog.note-widget-dialog')?.close();
		else if (data.type === 'state' && typeof data.text === 'string' && data.text.length <= STATE_LENGTH) {
			let state: unknown;
			try {
				state = JSON.parse(data.text);
			} catch {
				return;
			}
			figureOf(frame)?.dispatchEvent(new CustomEvent<WidgetTold>(WIDGET_STATE, { bubbles: true, detail: { state, title: frame.title } }));
		}
	});
	const tellAll = () => document.querySelectorAll<HTMLIFrameElement>(FRAMES).forEach(tellTheme);
	new MutationObserver(tellAll).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
	// Frames that loaded before this ran said they were ready to no one: tell them now, and any frame as it loads.
	tellAll();
	document.addEventListener(
		'load',
		(event) => {
			if (event.target instanceof HTMLIFrameElement && event.target.matches(FRAMES)) tellTheme(event.target);
		},
		true,
	);
}

function figureOf(frame: HTMLIFrameElement): HTMLElement | null {
	return speaksFor.get(frame) ?? frame.parentElement;
}

/** What a widget asks, said if what it is in takes it: not more than once in ASK_GAP. */
function asked(frame: HTMLIFrameElement, text: unknown): boolean {
	const said = typeof text === 'string' ? text.trim().slice(0, 4000) : '';
	const now = Date.now();
	if (!said || now - (lastAsked.get(frame) ?? 0) < ASK_GAP) return false;
	lastAsked.set(frame, now);
	const figure = figureOf(frame);
	return Boolean(figure && !figure.dispatchEvent(new CustomEvent<WidgetAsk>(WIDGET_ASK, { bubbles: true, cancelable: true, detail: { text: said, title: frame.title } })));
}

/** What a widget starting is given by what it is in (WIDGET_START): none, out of the page. */
function startOf(figure: HTMLElement, title: string): WidgetStart {
	const detail: WidgetStart = { title, canAsk: false };
	if (figure.isConnected) figure.dispatchEvent(new CustomEvent<WidgetStart>(WIDGET_START, { bubbles: true, detail }));
	return detail;
}

/** Shows a widget that is a file of the article, as it is now. */
async function loadFile(frame: HTMLIFrameElement, path: string, given: WidgetStart = { title: '', canAsk: false }): Promise<void> {
	try {
		frame.srcdoc = widgetDocument(await fetchText(path), colors(), given);
	} catch (error) {
		const message = (error instanceof Error ? error.message : String(error)).replace(/[<&]/gu, '');
		frame.srcdoc = widgetDocument(`<p style="color: var(--muted)">${message}</p>`, colors());
	}
}

/** By widget (its figure): what starts it, made `later`. */
const starts = new WeakMap<Element, () => void>();
/** By widget (its figure): what starts it again, as it is now (what it told of itself). */
const restarts = new WeakMap<Element, () => void>();

/**
 * The article's files changed (`assets/opt.log`, …): the widgets that are
 * one of them, or read one, start over with them as they are now.
 */
export function widgetFilesChanged(paths: string[]): void {
	const changed = new Set(paths);
	for (const frame of document.querySelectorAll<HTMLIFrameElement>(FRAMES)) {
		// Not started yet (not near the screen): it reads them as they are when it starts.
		if (frame.parentElement && starts.has(frame.parentElement)) continue;
		const file = frame.dataset.widgetFile;
		if (file && changed.has(file)) {
			reads.delete(frame);
			void loadFile(frame, file);
		} else if ([...(reads.get(frame) ?? [])].some((path) => changed.has(path))) {
			reads.delete(frame);
			// Setting it again, even as it was, loads the page again.
			frame.srcdoc = frame.srcdoc;
		}
	}
}

/** Starts a widget made `later` (its page loaded, its files read); one started already, nothing. */
export function startWidget(figure: Element): void {
	const start = starts.get(figure);
	starts.delete(figure);
	start?.();
}

/**
 * A widget drawn as the blog draws it, from its source (or the file of the
 * article it is) and its fence's `title=`/`height=`. `later`: its room only, till `startWidget` (as it comes near the
 * screen: what it fetches, not before).
 */
export function createWidget(widget: { source: string } | { file: string }, meta = '', { later = false } = {}): HTMLElement {
	const { title, height } = widgetOptions(meta);
	const figure = document.createElement('figure');
	figure.className = 'note-widget';
	const frame = document.createElement('iframe');
	frame.className = 'note-widget-frame';
	frame.setAttribute('sandbox', 'allow-scripts');
	frame.title = title || t('交互模块');
	frame.style.height = `${height}px`;
	if ('file' in widget) frame.dataset.widgetFile = widget.file;
	const start = () => {
		const given = startOf(figure, frame.title);
		if (given.expand) addExpand(figure, widget, frame.title);
		if ('file' in widget) void loadFile(frame, widget.file, given);
		else frame.srcdoc = widgetDocument(widget.source, colors(), given);
	};
	restarts.set(figure, start);
	if (later) starts.set(figure, start);
	else start();
	figure.append(frame);
	if (title) {
		const caption = document.createElement('figcaption');
		caption.textContent = title;
		figure.append(caption);
	}
	connectWidgets();
	return figure;
}

const EXPAND_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>';

/** A button over a widget that shows it large (where it is narrow: the AI panel), once. */
function addExpand(figure: HTMLElement, widget: { source: string } | { file: string }, title: string): void {
	if (figure.querySelector(':scope > .note-widget-expand')) return;
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'note-widget-expand';
	button.title = t('放大');
	button.setAttribute('aria-label', t('放大'));
	button.innerHTML = EXPAND_ICON;
	button.addEventListener('click', () => expandWidget(figure, widget, title));
	figure.append(button);
}

/**
 * A widget shown large, over everything (as ChatGPT's full screen): the same widget, started as it is now (what it
 * told of itself), speaking for the one it was made from; closed, that one starts again as the large one left it.
 */
export function expandWidget(figure: HTMLElement, widget: { source: string } | { file: string }, title: string): HTMLDialogElement {
	const dialog = document.createElement('dialog');
	dialog.className = 'note-widget-dialog';
	const bar = document.createElement('div');
	bar.className = 'note-widget-dialog-bar';
	const name = document.createElement('span');
	name.textContent = title || t('交互模块');
	const close = document.createElement('button');
	close.type = 'button';
	close.className = 'note-widget-dialog-close';
	close.textContent = '×';
	close.title = t('关闭');
	close.setAttribute('aria-label', t('关闭'));
	close.addEventListener('click', () => dialog.close());
	bar.append(name, close);
	const frame = document.createElement('iframe');
	frame.className = 'note-widget-frame';
	frame.setAttribute('sandbox', 'allow-scripts');
	frame.title = title || t('交互模块');
	frame.dataset.fills = '';
	speaksFor.set(frame, figure);
	dialog.append(bar, frame);
	document.body.append(dialog);
	const given = startOf(figure, frame.title);
	if ('file' in widget) void loadFile(frame, widget.file, given);
	else frame.srcdoc = widgetDocument(widget.source, colors(), given);
	dialog.addEventListener('close', () => {
		dialog.remove();
		restarts.get(figure)?.();
	});
	dialog.addEventListener('click', (event) => {
		if (event.target === dialog) dialog.close();
	});
	connectWidgets();
	dialog.showModal();
	return dialog;
}
