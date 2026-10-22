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
:root {
	--ink: #37352f; --muted: #787774; --line: #e9e9e7; --soft: #f7f7f5; --surface: #ffffff;
	color-scheme: light;
}
:root[data-theme='dark'] {
	--ink: #d4d4d4; --muted: #9b9b9b; --line: #2f2f2f; --soft: #202020; --surface: #191919;
	color-scheme: dark;
}
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

// Runs in the frame: tells the page its height, takes the theme from it.
const BRIDGE = `
(() => {
	const KIND = ${JSON.stringify(WIDGET_MESSAGE)};
	const root = document.documentElement;
	const listeners = [];
	const note = {
		theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
		onTheme(listener) { listeners.push(listener); },
		color(name) { return getComputedStyle(root).getPropertyValue('--' + name).trim(); },
	};
	root.dataset.theme = note.theme;
	window.note = note;
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
		if (data.type === 'file') {
			const answer = answers.get(data.id);
			answers.delete(data.id);
			if (answer) typeof data.text === 'string' ? answer.resolve(data.text) : answer.reject(new Error(data.error));
			return;
		}
		if (data.type !== 'theme') return;
		// The page may have come after what was said: say the height again, ask for the files again.
		sent = 0;
		for (const [id, { path }] of answers) ask(id, path);
		if (data.theme !== note.theme) {
			note.theme = root.dataset.theme = data.theme;
			for (const listener of listeners) listener(note.theme);
		}
		tell();
	});
	new ResizeObserver(tell).observe(root);
	addEventListener('load', tell);
	parent.postMessage({ kind: KIND, type: 'ready' }, '*');
})();
`;

/** The page a widget's frame shows: its source, with the tokens and the bridge put in its head. */
export function widgetDocument(source) {
	const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${STYLE}</style><script>${BRIDGE}</script>`;
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
