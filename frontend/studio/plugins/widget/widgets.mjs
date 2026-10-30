/**
 * Interactive widgets in an article: a ```widget fence holds a small HTML
 * page (markup, style, script) that runs in a sandboxed frame, on the blog
 * and in the Studio alike:
 *
 *     ```widget title="Morse 势能" height=320
 *     <input type="range" id="de"> <canvas id="plot"></canvas>
 *     <script> … </script>
 *     ```
 *
 * A bigger one is a file of the article, the fence naming it alone:
 *
 *     ```widget title="几何优化"
 *     @file ./assets/opt-progress.html
 *     ```
 *
 * The frame may run scripts but has no origin of its own
 * (`sandbox="allow-scripts"`), so a widget cannot reach the page around it.
 * The page tells it the theme and learns its height by messages; inside, a
 * widget has the notes' black-and-white tokens (`var(--ink)` …) and `note`:
 * `note.theme`, `note.onTheme(fn)`, `note.color('ink')`, and
 * `note.file('assets/opt.log')`, the text of a published file of the
 * article (in img/ or assets/), which the page fetches for it.
 *
 * In the Studio, as ChatGPT's and Claude's apps in a conversation, a widget
 * also speaks to the AI: `note.ask('…')` says something to it for the reader
 * (on a click: in a conversation it is said, in an article put in the AI's
 * input); `note.tell(value)` hands it what the widget is at now (the values
 * chosen), told it with what is said next; `note.state` is that value again
 * when the widget is drawn anew. `note.canAsk` (and `data-can-ask` on <html>)
 * says whether there is an AI to ask: on the blog there is none.
 */

import { articlePath } from '@blog/markdown/articles/article-references.mjs';
import { PUBLISHED_FOLDERS } from '@blog/markdown/articles/rules.mjs';

export const WIDGET_LANGUAGE = 'widget';

/** Messages between a widget and the page around it carry this. */
export const WIDGET_MESSAGE = 'note-widget';

/** How tall a widget is drawn before it says how tall it is (and without scripts). */
export const DEFAULT_WIDGET_HEIGHT = 240;

/** `title="…"` and `height=…` from the fence. */
export function widgetOptions(meta) {
	const options = { title: '', height: DEFAULT_WIDGET_HEIGHT };
	for (const match of String(meta ?? '').matchAll(/([\w-]+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g)) {
		const key = match[1].toLowerCase();
		const value = match[2] ?? match[3] ?? match[4];
		if (key === 'title') options.title = value;
		else if (key === 'height' && /^\d+$/.test(value)) options.height = Math.max(40, Math.min(2000, Number(value)));
	}
	return options;
}

const STYLE = `
html, body { margin: 0; background: transparent; }
body {
	color: var(--ink);
	font: 15px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans SC', sans-serif;
	overflow-wrap: anywhere;
}
canvas, svg, img, video { max-width: 100%; }
input, button, select, textarea { font: inherit; color: inherit; accent-color: var(--ink); }
button, select {
	padding: 2px 10px; border: 1px solid var(--line); border-radius: 6px;
	background: var(--surface); cursor: pointer;
}
button:hover { background: var(--soft); }
:focus-visible { outline: 2px solid var(--muted); outline-offset: 2px; }
`;

// Runs in the frame: tells the page its height, takes the theme from it; what is asked of the AI, and told it.
const BRIDGE = `
(() => {
	const KIND = ${JSON.stringify(WIDGET_MESSAGE)};
	const root = document.documentElement;
	const listeners = [];
	const given = window.__noteGiven || {};
	delete window.__noteGiven;
	const note = {
		theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
		onTheme(listener) { listeners.push(listener); },
		color(name) { return getComputedStyle(root).getPropertyValue('--' + name).trim(); },
		canAsk: given.canAsk === true,
		state: given.state ?? null,
	};
	root.dataset.theme = note.theme;
	if (note.canAsk) root.dataset.canAsk = '';
	window.note = note;
	// Said for the reader, on what they did (a click, a key): not by a widget on its own, nor over and over.
	let questions = 0;
	const asking = new Map();
	note.ask = (text) => new Promise((resolve) => {
		const said = String(text ?? '').trim();
		const activation = navigator.userActivation;
		if (!note.canAsk || !said || (activation && !activation.isActive)) return resolve(false);
		questions += 1;
		asking.set(questions, resolve);
		parent.postMessage({ kind: KIND, type: 'ask', id: questions, text: said }, '*');
	});
	note.tell = (value) => {
		const text = JSON.stringify(value ?? null);
		note.state = JSON.parse(text);
		parent.postMessage({ kind: KIND, type: 'state', text }, '*');
	};
	let asked = 0;
	const answers = new Map();
	const ask = (id, path) => parent.postMessage({ kind: KIND, type: 'file', id, path }, '*');
	note.file = (path) => new Promise((resolve, reject) => {
		asked += 1;
		answers.set(asked, { path: String(path), resolve, reject });
		ask(asked, String(path));
	});
	let sent = 0;
	const tell = () => {
		const height = Math.ceil(root.getBoundingClientRect().height);
		if (height === sent) return;
		sent = height;
		parent.postMessage({ kind: KIND, type: 'height', height }, '*');
	};
	addEventListener('message', (event) => {
		const data = event.data;
		if (event.source !== parent || !data || data.kind !== KIND) return;
		if (data.type === 'asked') {
			asking.get(data.id)?.(data.said === true);
			asking.delete(data.id);
			return;
		}
		if (data.type === 'file') {
			const answer = answers.get(data.id);
			answers.delete(data.id);
			if (answer) typeof data.text === 'string' ? answer.resolve(data.text) : answer.reject(new Error(data.error));
			return;
		}
		if (data.type !== 'theme') return;
		// The page's colors as they are now (its tokens, light or dark, as a plugin may have set them).
		for (const [name, value] of Object.entries(data.colors ?? {})) root.style.setProperty('--' + name, value);
		// The page may have come after what was said: say the height again, ask for the files again.
		sent = 0;
		for (const [id, { path }] of answers) ask(id, path);
		if (data.theme !== note.theme) {
			note.theme = root.dataset.theme = data.theme;
			for (const listener of listeners) listener(note.theme);
		}
		tell();
	});
	// Escape not used by the widget: the page's (a widget shown large is closed by it).
	addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && !event.defaultPrevented) parent.postMessage({ kind: KIND, type: 'escape' }, '*');
	});
	new ResizeObserver(tell).observe(root);
	addEventListener('load', tell);
	parent.postMessage({ kind: KIND, type: 'ready' }, '*');
})();
`;

/**
 * The page a widget's frame shows: its source, with the bridge and the page's colors (`colors`: --ink, --muted…, as
 * widget-host.ts reads them from the page, which the frame cannot) put in its head. `given`: whether there is an AI to
 * ask, and what the widget told of itself before (`note.canAsk`, `note.state`).
 */
export function widgetDocument(source, colors = {}, given = {}) {
	const tokens = Object.entries(colors).map(([name, value]) => `--${name}: ${value};`).join(' ');
	const told = given.canAsk || given.state !== undefined ? `<script>window.__noteGiven = ${JSON.stringify({ canAsk: given.canAsk === true, state: given.state ?? null }).replace(/</gu, '\\u003c')};</script>` : '';
	const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>:root { ${tokens} }${STYLE}</style>${told}<script>${BRIDGE}</script>`;
	const text = String(source ?? '');
	// A whole page of its own: ours goes first in its head.
	if (/<head[\s>]/i.test(text)) return text.replace(/<head(\s[^>]*)?>/i, (tag) => tag + head);
	if (/<html[\s>]/i.test(text)) return text.replace(/<html(\s[^>]*)?>/i, (tag) => `${tag}<head>${head}</head>`);
	return `<!doctype html><html><head>${head}</head><body>${text}</body></html>`;
}

/**
 * Scripts a widget loads from elsewhere without naming a version: they can
 * change, or go, under it. `…/plotly.js@2.35.2/…`, `…/3.1.0/…`, `?v=2` are versions.
 */
export function unpinnedScripts(source) {
	const urls = [];
	for (const match of String(source ?? '').matchAll(/<script\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
		const url = match[1] ?? match[2] ?? match[3];
		if (!/^(?:https?:)?\/\//i.test(url)) continue;
		if (/@v?\d+(?:\.\d+)*(?:[/?#]|$)|\/v?\d+\.\d+(?:\.\d+)*\/|[?&]v(?:er(?:sion)?)?=/i.test(url)) continue;
		urls.push(url);
	}
	return urls;
}

/** `assets/opt.log` for `./assets/opt.log` or `assets/opt.log`, when it is published with the article; null otherwise. */
export function publicArticlePath(written) {
	const path = articlePath(String(written ?? ''));
	const [root, ...rest] = path?.split('/') ?? [];
	return path && PUBLISHED_FOLDERS.includes(root) && rest.length ? path : null;
}

/** The file a widget is, when its fence holds only `@file ./assets/….html`; null for a widget written in place. */
export function widgetFile(source) {
	const match = /^\s*@file[ \t]+(\S+)\s*$/u.exec(String(source ?? ''));
	return match ? articlePath(match[1]) : null;
}

/** The files a widget's script reads by name: `note.file('assets/opt.log')`. */
export function widgetReads(source) {
	return [...String(source ?? '').matchAll(/note\.file\(\s*(['"`])([^'"`]+)\1\s*\)/gu)].map((match) => match[2]);
}
