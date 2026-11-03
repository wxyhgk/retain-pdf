import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parseArticle } from '@blog/markdown/syntax.mjs';
import { t } from '@blog/i18n/index.mjs';
import { resolveInside } from '../../../articles/bundle-paths.mjs';
// The widget's own page and bridge, as the editor and the blog run it (the widget plugin's).
import { publicArticlePath, WIDGET_LANGUAGE, WIDGET_MESSAGE, widgetDocument, widgetFile, widgetOptions } from '../../../../plugins/widget/widgets.mjs';

/**
 * An article's widgets run for an AI, which cannot see them: each in a headless browser, as the article shows it
 * (its page, its bridge, the files it reads from the article), and what came of it told: what went wrong (with the
 * line), how tall it drew, what it says, whether its canvases were drawn on, and a picture of it to look at.
 */

/** How wide a widget is drawn: about the article's column. */
const WIDTH = 720;
/** How long a widget is given to draw after it loads (scripts from the web, a first frame). */
const SETTLE = 1500;
/** How long a widget is waited for at most. */
const LOAD_WAIT = 15_000;

/** The article's colors (light), as the page gives a widget its tokens. */
const COLORS = { ink: 'rgb(55, 53, 47)', muted: 'rgb(120, 119, 116)', line: 'rgb(225, 224, 221)', soft: 'rgb(247, 246, 243)', surface: '#fff', danger: 'rgb(196, 50, 28)' };

class WidgetCheckError extends Error {
	constructor(message) {
		super(message);
		this.statusCode = 400;
	}
}

/** The widgets of an article's Markdown, in order, wherever they are (in columns, in lists): line, options, source. */
export function widgetsIn(source) {
	const found = [];
	const visit = (node) => {
		if (node.type === 'code' && (node.lang ?? '').toLowerCase() === WIDGET_LANGUAGE) {
			found.push({ line: node.position?.start.line ?? 0, ...widgetOptions(node.meta), source: node.value ?? '' });
		}
		for (const child of node.children ?? []) visit(child);
	};
	visit(parseArticle(source));
	return found;
}

/** A browser to run them in: Playwright's Chromium, else the Chrome of this machine. */
async function launchBrowser() {
	let chromium;
	try {
		({ chromium } = await import('playwright-core'));
	} catch {
		throw new WidgetCheckError(t('检查交互模块要用 Playwright：在 Studio 的文件夹里运行 npm install'));
	}
	try {
		return await chromium.launch();
	} catch {
		try {
			return await chromium.launch({ channel: 'chrome' });
		} catch {
			throw new WidgetCheckError(t('找不到能用的浏览器：装 Chrome，或者在 Studio 的文件夹里运行 npx playwright install chromium'));
		}
	}
}

/** The page around a widget in the browser: its frame, and the page's half of the bridge (its files, its height, its errors). */
function hostPage(document) {
	return `<!doctype html><html><head><meta charset="utf-8"><style>body { margin: 0; background: #fff; } iframe { display: block; width: ${WIDTH}px; height: 240px; border: 0; }</style></head><body>
<iframe sandbox="allow-scripts" id="widget"></iframe>
<script>
const KIND = ${JSON.stringify(WIDGET_MESSAGE)};
const frame = document.getElementById('widget');
window.__errors = [];
addEventListener('message', async (event) => {
	const data = event.data;
	if (event.source !== frame.contentWindow || !data || data.kind !== KIND) return;
	if (data.type === 'height' && Number.isFinite(data.height)) frame.style.height = Math.max(24, Math.min(4000, Math.ceil(data.height))) + 'px';
	else if (data.type === 'error') window.__errors.push({ message: String(data.message ?? ''), line: data.line ?? null, missing: data.missing ?? null });
	else if (data.type === 'file') {
		const answer = await window.__readFile(String(data.path ?? ''));
		frame.contentWindow.postMessage({ kind: KIND, type: 'file', id: data.id, ...answer }, '*');
	}
});
frame.srcdoc = ${JSON.stringify(document).replace(/</gu, '\\u003c')};
</script></body></html>`;
}

/** What a widget shows, read inside its frame: its words, its canvases (drawn on or blank), its drawings and pictures. */
function shownInFrame() {
	const canvases = [...document.querySelectorAll('canvas')];
	const blank = canvases.filter((canvas) => {
		if (!canvas.width || !canvas.height) return true;
		try {
			const context = canvas.getContext('2d');
			if (!context) return false;
			const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
			for (let index = 3; index < data.length; index += 4) if (data[index] !== 0) return false;
			return true;
		} catch {
			// WebGL, or one drawn from elsewhere: not known.
			return false;
		}
	}).length;
	return {
		text: (document.body?.innerText ?? '').replace(/\s+/gu, ' ').trim().slice(0, 400),
		canvases: canvases.length,
		blankCanvases: blank,
		svgs: document.querySelectorAll('svg').length,
		pictures: document.querySelectorAll('img').length,
		controls: document.querySelectorAll('input, button, select, textarea').length,
	};
}

/**
 * Runs an article's widgets (or the `only`th, from 1) in a headless browser: for each, what went wrong, how it drew,
 * and its picture, kept in `shots` (the article's private ai/shots/).
 * @param {string} folder the article's folder
 * @param {string} source its Markdown
 */
export async function checkWidgets(folder, source, { only = null, shots = join(folder, 'ai', 'shots'), launch = launchBrowser, settle = SETTLE } = {}) {
	const widgets = widgetsIn(source);
	if (!widgets.length) return { widgets: [], note: t('这一页里没有交互模块') };
	if (only !== null && (only < 1 || only > widgets.length)) throw new WidgetCheckError(t('这篇只有 {count} 个交互模块', { count: widgets.length }));
	const chosen = widgets.map((widget, index) => ({ ...widget, index: index + 1 })).filter((widget) => only === null || widget.index === only);
	const readPublished = async (written) => {
		const path = publicArticlePath(written);
		if (!path) return { error: t('{path} 不在页面的 img/ 或 assets/ 里', { path: written }) };
		try {
			return { text: await readFile(resolveInside(folder, ...path.split('/')), 'utf8') };
		} catch {
			return { error: t('找不到 ./{path}', { path }) };
		}
	};
	const browser = await launch();
	try {
		await mkdir(shots, { recursive: true });
		const results = [];
		for (const widget of chosen) {
			const file = widgetFile(widget.source);
			const told = { widget: widget.index, line: widget.line, ...(widget.title ? { title: widget.title } : {}), ...(file ? { file } : {}) };
			let html = widget.source;
			if (file) {
				const read = await readPublished(file);
				if (read.error) {
					results.push({ ...told, errors: [{ message: read.error, line: null }] });
					continue;
				}
				html = read.text;
			}
			const page = await browser.newPage({ viewport: { width: WIDTH + 40, height: 900 } });
			const logged = [];
			page.on('console', (message) => {
				if (message.type() === 'error') logged.push(message.text().slice(0, 300));
			});
			await page.exposeFunction('__readFile', readPublished);
			try {
				await page.setContent(hostPage(widgetDocument(html, COLORS, { canAsk: false })), { waitUntil: 'load', timeout: LOAD_WAIT });
				const frame = page.frameLocator('#widget');
				await frame.locator('body').waitFor({ state: 'attached', timeout: LOAD_WAIT });
				await page.waitForTimeout(settle);
				const shown = await frame.locator('html').evaluate(shownInFrame);
				const errors = (await page.evaluate(() => window.__errors)).map(({ message, line, missing }) => ({ message: missing ? t('没加载到 {src}', { src: missing }) : message, line }));
				const box = await page.locator('#widget').boundingBox();
				const picture = join(shots, `widget-${widget.index}.png`);
				await page.locator('#widget').screenshot({ path: picture });
				// The page's own errors (a script not loaded) the bridge told already; the rest of the console's.
				const more = logged.filter((text) => !errors.some((error) => text.includes(error.message)));
				results.push({ ...told, errors, ...(more.length ? { console: more.slice(0, 10) } : {}), height: Math.round(box?.height ?? 0), shows: shown, picture });
			} catch (error) {
				results.push({ ...told, errors: [{ message: t('没能运行完：{error}', { error: error instanceof Error ? error.message.split('\n')[0] : String(error) }), line: null }] });
			} finally {
				await page.close().catch(() => {});
			}
		}
		return { widgets: results };
	} finally {
		await browser.close().catch(() => {});
	}
}
