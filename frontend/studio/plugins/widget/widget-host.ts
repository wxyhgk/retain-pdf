import { t } from '@blog/i18n/index.mjs';
import { WIDGET_MESSAGE, publicArticlePath, widgetDocument, widgetOptions } from './widgets.mjs';

/**
 * The page's side of the widgets (widgets.mjs): each frame says how tall it
 * is and is told the theme, now and whenever it changes; a frame that asks
 * for a file of the article (`note.file()`) is sent its text. The blog and
 * the Studio both use it; the Studio also makes its frames here, and tells
 * it when the article's files change, so the widgets that use them start over.
 */

const FRAMES = 'iframe.note-widget-frame';

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
	if (!fileUrl) throw new Error(t('还没有打开文章'));
	const response = await fetch(fileUrl(path), { cache: 'no-store' });
	if (!response.ok) throw new Error(t('找不到 ./{path}', { path }));
	return response.text();
}

async function answerFile(frame: HTMLIFrameElement, id: unknown, written: unknown): Promise<void> {
	const path = publicArticlePath(String(written ?? ''));
	if (!path) {
		post(frame, { type: 'file', id, error: t('{path} 不在文章的 img/ 或 assets/ 里', { path: String(written) }) });
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

let connected = false;

/** Listens to the page's widgets: once is enough, wherever they are or come later. */
export function connectWidgets(): void {
	if (connected) return;
	connected = true;
	window.addEventListener('message', (event) => {
		const data = event.data as { kind?: unknown; type?: unknown; height?: unknown; id?: unknown; path?: unknown } | null;
		if (!data || data.kind !== WIDGET_MESSAGE) return;
		const frame = [...document.querySelectorAll<HTMLIFrameElement>(FRAMES)].find((candidate) => candidate.contentWindow === event.source);
		if (!frame) return;
		if (data.type === 'ready') tellTheme(frame);
		else if (data.type === 'height' && typeof data.height === 'number' && Number.isFinite(data.height)) {
			frame.style.height = `${Math.max(24, Math.min(4000, Math.ceil(data.height)))}px`;
		} else if (data.type === 'file') void answerFile(frame, data.id, data.path);
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

/** Shows a widget that is a file of the article, as it is now. */
async function loadFile(frame: HTMLIFrameElement, path: string): Promise<void> {
	try {
		frame.srcdoc = widgetDocument(await fetchText(path), colors());
	} catch (error) {
		const message = (error instanceof Error ? error.message : String(error)).replace(/[<&]/gu, '');
		frame.srcdoc = widgetDocument(`<p style="color: var(--muted)">${message}</p>`, colors());
	}
}

/**
 * The article's files changed (`assets/opt.log`, …): the widgets that are
 * one of them, or read one, start over with them as they are now.
 */
export function widgetFilesChanged(paths: string[]): void {
	const changed = new Set(paths);
	for (const frame of document.querySelectorAll<HTMLIFrameElement>(FRAMES)) {
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

/**
 * A widget drawn as the blog draws it, from its source (or the file of the
 * article it is) and its fence's `title=`/`height=`.
 */
export function createWidget(widget: { source: string } | { file: string }, meta = ''): HTMLElement {
	const { title, height } = widgetOptions(meta);
	const figure = document.createElement('figure');
	figure.className = 'note-widget';
	const frame = document.createElement('iframe');
	frame.className = 'note-widget-frame';
	frame.setAttribute('sandbox', 'allow-scripts');
	frame.title = title || t('交互模块');
	frame.style.height = `${height}px`;
	if ('file' in widget) {
		frame.dataset.widgetFile = widget.file;
		void loadFile(frame, widget.file);
	} else frame.srcdoc = widgetDocument(widget.source, colors());
	figure.append(frame);
	if (title) {
		const caption = document.createElement('figcaption');
		caption.textContent = title;
		figure.append(caption);
	}
	connectWidgets();
	return figure;
}
