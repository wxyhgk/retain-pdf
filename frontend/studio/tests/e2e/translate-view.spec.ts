import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openSettings, openStudio, removeArticle, resetFixture, savedMarkdown, saveStatus, writeArticle } from './studio.ts';

// 翻译 (the left column): RetainPDF's own pages in the middle, at the address in 设置 › RetainPDF. Here a stand-in for
// RetainPDF answers on a port of its own: every page of it is 图书馆, speaking studio-bridge.v1 as RetainPDF's does
// (hello → ready; theme, navigate shown on the page; 摘 sends a quote; 读 and 离开 say what is read, or that nothing is;
// AI asks the Studio's AI, as its reader's AI does in the Studio). It says which book and page its address opened it at
// (a book beside a note is opened straight at its reader).
// Its API answers too, as far as the settings' 测试连接 and 书's ＋ ask it, with the key STAND_IN_KEY: one book. Its pages
// tell that key (runtime-config.local.js, as RetainPDF's development stack does) only when `tellsKey`.

const settingsFile = () => join(process.env.STUDIO_BLOG_DIR!, '.studio-settings.json');
const savedUrl = () => {
	try {
		return JSON.parse(readFileSync(settingsFile(), 'utf8')).retainpdfUrl;
	} catch {
		return undefined;
	}
};

const STAND_IN = `<!doctype html><meta charset="utf-8"><title>RetainPDF</title>
<h1 id="library">图书馆</h1>
<p>opened <span id="opened"></span> · embed <span id="embed"></span> · theme <span id="theme"></span> · studio <span id="studio"></span> · navigated <span id="navigated"></span> · notes <span id="notes-state"></span> · quoted <span id="quoted"></span></p>
<button id="quote" type="button">摘</button>
<button id="notes" type="button">笔记</button>
<button id="read" type="button">读</button>
<button id="leave" type="button">离开</button>
<button id="ask" type="button">AI</button>
<button id="open-book" type="button">读 Statistical Mechanics</button>
<button id="press-cmd-k" type="button">⌘K</button>
<script>
const head = { protocol: 'retainpdf-studio-bridge', v: 1 };
let host = '';
document.querySelector('#embed').textContent = new URLSearchParams(location.search).get('embed') || '';
document.querySelector('#opened').textContent = [...new URLSearchParams(location.search)].filter(([key]) => key !== 'embed').map(([key, value]) => key + '=' + value).join('&');
addEventListener('message', (event) => {
	const message = event.data;
	if (event.source !== parent || !message || message.protocol !== head.protocol || message.v !== 1) return;
	if (message.type === 'hello') {
		host = event.origin;
		document.querySelector('#theme').textContent = message.theme;
		document.querySelector('#studio').textContent = (message.features || []).join(',');
		parent.postMessage({ ...head, type: 'ready', features: ['theme', 'navigate', 'quote', 'notes', 'reading', 'quoted'] }, host);
	} else if (message.type === 'theme') {
		document.querySelector('#theme').textContent = message.theme;
	} else if (message.type === 'navigate') {
		const { protocol, v, type, ...target } = message;
		document.querySelector('#navigated').textContent = JSON.stringify(target);
	} else if (message.type === 'notes') {
		document.querySelector('#notes-state').textContent = message.open ? 'open:' + message.title : 'closed';
	} else if (message.type === 'quoted') {
		document.querySelector('#quoted').textContent = message.job_id + ':' + message.item_ids.join(',');
	}
});
document.querySelector('#notes').addEventListener('click', () => parent.postMessage(
	document.querySelector('#notes-state').textContent.startsWith('open')
		? { ...head, type: 'close-notes' }
		: { ...head, type: 'open-notes', job_id: 'job-1', document_id: 'doc-1', title: 'Quantum Chemistry' },
	host,
));
// What is read: the book its address opened (a book beside a note), else the one of 图书馆's.
const ownJob = new URLSearchParams(location.search).get('job_id') || 'job-1';
const books = { 'job-1': ['doc-1', 'Quantum Chemistry'], 'job-2': ['doc-2', 'Statistical Mechanics'], 'job-3': ['doc-3', 'Organic Chemistry'] };
document.querySelector('#read').addEventListener('click', () => parent.postMessage(
	{ ...head, type: 'reading', job_id: ownJob, document_id: books[ownJob][0], title: books[ownJob][1], page_idx: 11, page_count: 300 },
	host,
));
document.querySelector('#leave').addEventListener('click', () => parent.postMessage(
	{ ...head, type: 'reading', job_id: null, document_id: null, title: null, page_idx: null, page_count: null },
	host,
));
document.querySelector('#ask').addEventListener('click', () => parent.postMessage({ ...head, type: 'ask-ai' }, host));
// ⌘K pressed while the page has the keys: given to the Studio when it takes it (shortcut), as RetainPDF's pages do.
document.querySelector('#press-cmd-k').addEventListener('click', () => {
	if (document.querySelector('#studio').textContent.split(',').includes('shortcut')) {
		parent.postMessage({ ...head, type: 'shortcut', key: 'k', meta: true, ctrl: false, shift: false, alt: false }, host);
	}
});
// A book clicked to read in 图书馆: given to the Studio when it takes it (open-book), as RetainPDF's library does.
document.querySelector('#open-book').addEventListener('click', () => {
	if (document.querySelector('#studio').textContent.split(',').includes('open-book')) {
		parent.postMessage({ ...head, type: 'open-book', job_id: 'job-2', document_id: 'doc-2', title: 'Statistical Mechanics', page_idx: 7 }, host);
	} else {
		document.querySelector('#opened').textContent = 'reader:job-2';
	}
});
document.querySelector('#quote').addEventListener('click', () => parent.postMessage({
	...head, type: 'quote', job_id: 'job-1', document_id: 'doc-1', title: 'Quantum Chemistry', item_id: 'p012-b0003', page_idx: 11,
	source_text: 'The variation principle $x^2$.', translated_text: '变分原理：\\n\\n$$E = mc^2$$',
}, host));
</script>`;

const STAND_IN_KEY = 'stand-in-key';
let tellsKey = false;
let retainpdf: Server;
let retainpdfUrl = '';

test.beforeAll(async () => {
	retainpdf = createServer((request, response) => {
		if (request.url?.startsWith('/api/v1/')) {
			const known = request.headers['x-api-key'] === STAND_IN_KEY;
			response.writeHead(known ? 200 : 401, { 'Content-Type': 'application/json' });
			const documents = [{ document_id: 'doc-3', title: 'Organic Chemistry', page_count: 120, active_job_id: 'job-3' }];
			// Its words found (⌘K): one passage, on page 12 of the book.
			const hits = [{ document_id: 'doc-3', job_id: 'job-3', page_idx: 11, block_id: 'p012-b0003', source_snippet: 'The variation principle', translated_snippet: '变分原理告诉我们，能量有下界' }];
			const data = request.url.startsWith('/api/v1/search') ? { hits, has_more: false } : request.url.startsWith('/api/v1/documents/doc-3') ? documents[0] : { documents, total: 1, has_more: false };
			response.end(JSON.stringify(known ? { code: 0, message: 'ok', data } : { code: 40100, message: 'unauthorized', error: { code: 'UNAUTHORIZED', http_status: 401, details: {} } }));
			return;
		}
		// Its API on the same port as its pages, as its desktop app has it, said in its runtime config.
		if (request.url === '/runtime-config.js') {
			response.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
			response.end(`window.__FRONT_RUNTIME_CONFIG__ = { apiBase: ${JSON.stringify(retainpdfUrl)}, xApiKey: "" };\n`);
			return;
		}
		if (request.url === '/runtime-config.local.js') {
			response.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
			response.end(tellsKey ? `(function () {\n  var c = window.__FRONT_RUNTIME_CONFIG__ = window.__FRONT_RUNTIME_CONFIG__ || {};\n  if (!c.xApiKey) c.xApiKey = ${JSON.stringify(STAND_IN_KEY)};\n})();\n` : '');
			return;
		}
		response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
		response.end(STAND_IN);
	});
	await new Promise<void>((resolve) => retainpdf.listen(0, '127.0.0.1', resolve));
	retainpdfUrl = `http://127.0.0.1:${(retainpdf.address() as AddressInfo).port}/`;
});
test.afterAll(() => new Promise<void>((resolve) => retainpdf.close(() => resolve())));
// The settings outlive a test: each starts at the default address.
test.beforeEach(() => {
	tellsKey = false;
	resetFixture();
	removeArticle('second-note');
	// The 读书笔记 pages a test made (they say `retainpdf:`): each test starts without them.
	const blog = process.env.STUDIO_BLOG_DIR!;
	for (const folder of readdirSync(blog)) {
		const page = join(blog, folder, 'index.md');
		if (existsSync(page) && /^retainpdf: /mu.test(readFileSync(page, 'utf8'))) removeArticle(folder);
	}
	let settings: Record<string, unknown>;
	try {
		settings = JSON.parse(readFileSync(settingsFile(), 'utf8'));
	} catch {
		return;
	}
	delete settings.retainpdfUrl;
	delete settings.retainpdfApiUrl;
	delete settings.retainpdfApiKey;
	writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
});

async function setAddress(page: Page, url: string): Promise<void> {
	const status = await page.evaluate(
		async (address) => (await fetch('/api/studio/settings/retainpdf', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: address }) })).status,
		url,
	);
	expect(status).toBe(200);
}

const inFrame = (page: Page) => page.frameLocator('#retainpdf-frame');

test('翻译 shows RetainPDF in the middle, kept as it was while another view is shown, and again from the address', async ({ page }) => {
	await openStudio(page);
	await setAddress(page, retainpdfUrl);
	const frame = page.locator('#retainpdf-frame');
	// Nothing loaded before it is first shown.
	await expect(frame).toHaveCount(1);
	expect(await frame.getAttribute('src')).toBeNull();

	await page.locator('#open-translate').click();
	await expect(page.locator('#open-translate')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('#translate-view')).toBeVisible();
	await expect(page.locator('.editor-panel')).toBeHidden();
	// Told it is in the Studio, and how it looks.
	await expect(frame).toHaveAttribute('src', `${retainpdfUrl}?embed=studio`);
	await expect(inFrame(page).locator('#library')).toHaveText('图书馆');
	await expect(inFrame(page).locator('#embed')).toHaveText('studio');
	await expect(inFrame(page).locator('#theme')).toHaveText(/^(light|dark)$/u);
	await expect(inFrame(page).locator('#studio')).toHaveText('quote,open-notes,ask-ai,open-book,shortcut');
	await expect(inFrame(page).locator('#notes-state')).toHaveText('closed');
	expect(new URL(page.url()).searchParams.has('translate')).toBe(true);

	// Pressed again: the article, the frame left loaded behind it.
	await page.locator('#open-translate').click();
	await expect(page.locator('#translate-view')).toBeHidden();
	await expect(page.locator('.editor-panel')).toBeVisible();
	expect(new URL(page.url()).searchParams.has('translate')).toBe(false);
	await expect(frame).toHaveAttribute('src', `${retainpdfUrl}?embed=studio`);

	// The address with ?translate opens it.
	await page.goto(`${new URL(page.url()).pathname}?translate`);
	await expect(page.locator('#translate-view')).toBeVisible();
	await expect(inFrame(page).locator('#library')).toHaveText('图书馆');
});

/** The pages made for RetainPDF (they say `retainpdf:`): none, notes being the note written, not a page per book. */
async function retainpdfPages(page: Page): Promise<number> {
	const all = await page.evaluate(async () => ((await (await fetch('/api/studio/articles')).json()) as { articles: Array<{ retainpdf?: unknown }> }).articles);
	return all.filter((entry) => entry.retainpdf).length;
}

test('摘到笔记 in RetainPDF puts the passage in the note being written, staying in the book; 摘录 lists it, a line written after it, it shown in the book; the note opened, it is its own text', async ({ page }) => {
	await openStudio(page);
	await setAddress(page, retainpdfUrl);
	await page.locator('#open-translate').click();
	await expect(inFrame(page).locator('#theme')).toHaveText(/^(light|dark)$/u);

	// The Studio's light or dark followed.
	const other = (await inFrame(page).locator('#theme').textContent()) === 'dark' ? 'light' : 'dark';
	await page.evaluate((theme) => {
		document.documentElement.dataset.theme = theme;
		window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
	}, other);
	await expect(inFrame(page).locator('#theme')).toHaveText(other);

	await inFrame(page).locator('#quote').click();
	await expect(page.locator('.studio-toast')).toContainText('已摘到「Studio 测试夹具」');
	// Still in the book (the note not put beside it, the keys not taken); 摘录 out in the right column, RetainPDF told
	// which note, and which of its passages are quoted.
	await expect(page.locator('#translate-view')).toBeVisible();
	await expect(page.locator('.editor-panel')).toBeHidden();
	expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('IFRAME');
	await expect(page.locator('#side-tab-own-quotes')).toHaveAttribute('aria-selected', 'true');
	const quotes = page.locator('#side-own-quotes');
	await expect(quotes.locator('.quotes-note')).toHaveText('《Studio 测试夹具》');
	await expect(quotes.locator('.quotes-passage')).toHaveCount(1);
	await expect(quotes.locator('.quotes-passage .quotes-text')).toHaveText('变分原理：');
	await expect(quotes.locator('.quotes-passage .quotes-page')).toHaveText('第 12 页');
	await expect(inFrame(page).locator('#notes-state')).toHaveText('open:Studio 测试夹具');
	await expect(inFrame(page).locator('#quoted')).toHaveText('job-1:p012-b0003');

	// Another: after the first (its passage and formula), not at the note's end.
	await inFrame(page).locator('#quote').click();
	await expect(quotes.locator('.quotes-passage')).toHaveCount(2);
	// A line of the author's after the first.
	await quotes.locator('.quotes-passage').first().hover();
	await quotes.locator('.quotes-passage').first().locator('.quotes-add').click();
	await quotes.locator('.quotes-line').fill('要记住');
	await quotes.locator('.quotes-line').press('Enter');
	await expect(quotes.locator('.quotes-line')).toHaveCount(0);
	// A passage clicked: shown in the book.
	await quotes.locator('.quotes-show').first().click();
	await expect(inFrame(page).locator('#navigated')).toHaveText(JSON.stringify({ job_id: 'job-1', block_id: 'p012-b0003', page_idx: 11 }));

	// 打开笔记: the note, the book beside it; the passages its own text (the translation, its formula drawn), RetainPDF's
	// mark in the corner of each first paragraph.
	await quotes.locator('.quotes-open').click();
	await expect(page.locator('#translate-view')).toBeHidden();
	await expect(page.locator('#side-tab-own-quotes')).toHaveCount(0);
	await expect(page.locator('#books-view')).toBeVisible();
	await expect(page.locator('.book-tab-name')).toHaveText(['Quantum Chemistry']);
	const notesPanel = page.locator('.editor-panel');
	const mark = notesPanel.locator('.retainpdf-source');
	await expect(mark).toHaveCount(2);
	const quotedText = notesPanel.locator('.ProseMirror p:has(> .retainpdf-source)');
	await expect(quotedText.first()).toHaveText('变分原理：');
	await expect(mark.first().locator('svg')).toBeVisible();
	await expect(mark.first()).toHaveAttribute('title', 'Quantum Chemistry · 第 12 页 · 在 RetainPDF 中打开');
	const corner = () =>
		quotedText.first().evaluate((element) => {
			const text = element.getBoundingClientRect();
			const shown = element.querySelector('.retainpdf-source')!.getBoundingClientRect();
			return Math.abs(text.right - shown.right) < 4 && shown.top - text.top < 12;
		});
	await expect.poll(corner).toBe(true);
	// The book and page said by it (not text of the paragraph), the text going round it.
	await expect(mark.first()).toHaveAttribute('data-shown', 'Quantum Ch… · 12');
	expect(await mark.first().evaluate((element) => getComputedStyle(element).float)).toBe('right');
	await expect(notesPanel).not.toContainText('The variation principle');
	await expect(editor(page).locator('.milkdown-code-block')).toHaveCount(0);

	// Saved as an article is: the two passages, the line after the first (its formula and all), not a ```retainpdf.
	await page.locator('#breadcrumb-title').click();
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	const link = '[Quantum Chemistry · 第 12 页](retainpdf:job-1/p012-b0003?page=12&document=doc-1) 变分原理：';
	const saved = savedMarkdown();
	expect(saved.split(link).length - 1).toBe(2);
	expect(saved).toMatch(/变分原理：\n\n\$\$\nE = mc\^2\n\$\$\n\n要记住\n\n\[Quantum Chemistry/u);
	expect(saved).not.toContain('```retainpdf');
	// No page of notes made for the book.
	expect(await retainpdfPages(page)).toBe(0);
});

test('摘录 in 书库: put out by RetainPDF\'s 笔记 and away; into another note, picked there; the book\'s passages in other notes; gone as 书库 is left', async ({ page }) => {
	writeArticle('second-note', '---\ntitle: 第二篇笔记\n---\n\n另一篇。\n');
	writeArticle('earlier-note', '---\ntitle: 早先的笔记\n---\n\n[Quantum Chemistry · 第 3 页](retainpdf:job-1/p003-b0001?page=3&document=doc-1) 早先摘的一段。\n');
	await openStudio(page);
	await setAddress(page, retainpdfUrl);
	await page.locator('#open-translate').click();
	await expect(inFrame(page).locator('#notes-state')).toHaveText('closed');
	await expect(page.locator('#side-tab-own-quotes')).toHaveCount(0);

	// RetainPDF's 笔记: 摘录, the right column not folded away (the AI and the rest beside it).
	const shell = page.locator('.studio-shell');
	await inFrame(page).locator('#notes').click();
	await expect(inFrame(page).locator('#notes-state')).toHaveText('open:Studio 测试夹具');
	await expect(page.locator('#side-tab-own-quotes')).toHaveAttribute('aria-selected', 'true');
	await expect(shell).not.toHaveClass(/panel-collapsed/u);
	await expect(page.locator('#translate-view')).toBeVisible();
	await expect(page.locator('.editor-panel')).toBeHidden();
	const quotes = page.locator('#side-own-quotes');

	// Into another note: picked in 摘录, 书库 not left; RetainPDF told; what is quoted then goes there.
	await quotes.locator('.quotes-note').click();
	await quotes.locator('.quotes-picker input').fill('第二');
	await quotes.locator('.quotes-picker button', { hasText: '第二篇笔记' }).click();
	await expect(quotes.locator('.quotes-note')).toHaveText('《第二篇笔记》');
	await expect(inFrame(page).locator('#notes-state')).toHaveText('open:第二篇笔记');
	await expect(page.locator('#translate-view')).toBeVisible();
	await inFrame(page).locator('#quote').click();
	await expect(page.locator('.studio-toast').last()).toContainText('已摘到「第二篇笔记」');
	await expect(quotes.locator('.quotes-passage')).toHaveCount(1);

	// The book's passages in other notes: the earlier one's; clicked, that note opened at it.
	await quotes.locator('.quotes-others summary').click();
	await expect(quotes.locator('.quotes-other-title')).toHaveText(['早先的笔记']);
	await quotes.locator('.quotes-other .quotes-show').click();
	await expect(page.locator('#breadcrumb-title')).toHaveText('早先的笔记');
	await expect(page.locator('#translate-view')).toBeHidden();
	// 书库 left: 摘录 gone, RetainPDF told.
	await expect(page.locator('#side-tab-own-quotes')).toHaveCount(0);
	await expect(inFrame(page).locator('#notes-state')).toHaveText('closed');

	// Back: put out and away by RetainPDF's 笔记.
	await page.locator('#open-translate').click();
	await inFrame(page).locator('#notes').click();
	await expect(page.locator('#side-tab-own-quotes')).toHaveCount(1);
	await inFrame(page).locator('#notes').click();
	await expect(page.locator('#side-tab-own-quotes')).toHaveCount(0);
	expect(await retainpdfPages(page)).toBe(0);
	removeArticle('second-note');
	removeArticle('earlier-note');
});

test('a quote not from RetainPDF\'s frame is not taken', async ({ page }) => {
	await openStudio(page);
	await setAddress(page, retainpdfUrl);
	await page.locator('#open-translate').click();
	await expect(inFrame(page).locator('#theme')).toHaveText(/^(light|dark)$/u);
	// The Studio's own page saying it, as any page of it could.
	await page.evaluate(() =>
		window.postMessage({ protocol: 'retainpdf-studio-bridge', v: 1, type: 'quote', job_id: 'j', document_id: null, title: 'x', item_id: 'p001-b0000', page_idx: 0, source_text: 'forged', translated_text: null }, '*'),
	);
	await page.waitForTimeout(300);
	await expect(page.locator('.studio-toast')).toHaveCount(0);
	await page.locator('#open-translate').click();
	await expect(editor(page).locator('.retainpdf-source')).toHaveCount(0);
});

test('RetainPDF not answering: why, a way to try again, and to its address in the settings', async ({ page }) => {
	await openStudio(page);
	// A port nothing listens on: a server's, closed.
	const closed = createServer();
	await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));
	const nowhere = `http://127.0.0.1:${(closed.address() as AddressInfo).port}/`;
	await new Promise<void>((resolve) => closed.close(() => resolve()));
	await setAddress(page, nowhere);

	await page.locator('#open-translate').click();
	const why = page.locator('#retainpdf-unreachable');
	await expect(why).toBeVisible();
	await expect(why).toContainText('连不上 RetainPDF');
	await expect(why.locator('code')).toHaveText(nowhere);
	await expect(page.locator('#retainpdf-frame')).toBeHidden();

	// Set right in the settings, then 重试: the pages.
	await why.getByRole('button', { name: '改地址' }).click();
	const section = page.locator('#settings-retainpdf');
	await expect(section).toBeVisible();
	await expect(section.locator('#retainpdf-url')).toHaveValue(nowhere);
	await section.locator('#retainpdf-url').fill(retainpdfUrl);
	await section.getByRole('button', { name: '保存' }).click();
	await expect(section.locator('#retainpdf-status')).toContainText('已保存');
	expect(savedUrl()).toBe(retainpdfUrl);
	await page.keyboard.press('Escape');
	await why.getByRole('button', { name: '重试' }).click();
	await expect(why).toBeHidden();
	await expect(inFrame(page).locator('#library')).toHaveText('图书馆');
});

test('设置 › RetainPDF: empty is the default address, and nothing other than http(s) is taken', async ({ page }) => {
	await openStudio(page);
	const section = await openSettings(page, 'retainpdf');
	await expect(section.locator('#retainpdf-url')).toHaveValue('');
	await expect(section.locator('#retainpdf-url')).toHaveAttribute('placeholder', 'http://127.0.0.1:40001/');
	await section.locator('#retainpdf-url').fill('file:///Applications/RetainPDF.app');
	await section.getByRole('button', { name: '保存' }).click();
	await expect(section.locator('#retainpdf-status')).toContainText('http:// 或 https://');
	expect(savedUrl()).toBeUndefined();
});

/** What the Studio's server holds of what is read in 翻译 (told the AIs). */
const reading = (page: Page) => page.evaluate(async () => ((await (await fetch('/api/studio/retainpdf/reading')).json()) as { reading: Record<string, unknown> | null }).reading);

test('what RetainPDF says is read (the book, the page) is kept for the AIs while 翻译 shows it, with the note beside it; nothing elsewhere', async ({ page }) => {
	await openStudio(page);
	await setAddress(page, retainpdfUrl);
	await page.locator('#open-translate').click();
	await expect(inFrame(page).locator('#library')).toHaveText('图书馆');
	await expect.poll(() => reading(page)).toBeNull();

	await inFrame(page).locator('#read').click();
	await expect.poll(() => reading(page)).toMatchObject({ job_id: 'job-1', document_id: 'doc-1', title: 'Quantum Chemistry', page: 12, pages: 300, notes: null });

	// 摘录 out: which note passages go into, too.
	await inFrame(page).locator('#notes').click();
	await expect(inFrame(page).locator('#notes-state')).toHaveText('open:Studio 测试夹具');
	await expect.poll(async () => (await reading(page))?.notes).toMatchObject({ title: 'Studio 测试夹具' });

	// Another view: nothing read; back: the book again.
	await page.locator('#open-translate').click();
	await expect.poll(() => reading(page)).toBeNull();
	await page.locator('#open-translate').click();
	await expect.poll(async () => (await reading(page))?.page).toBe(12);

	// The reader left (RetainPDF's 主页): nothing, though its notes are open (a book's notes, not a page of it, then).
	await inFrame(page).locator('#leave').click();
	await expect.poll(async () => (await reading(page))?.page ?? null).toBeNull();
});

test('设置 › RetainPDF: its API\'s address and key, tried at once; the key kept by the server and never shown back', async ({ page }) => {
	await openStudio(page);
	await setAddress(page, retainpdfUrl);
	const section = await openSettings(page, 'retainpdf');
	await expect(section.locator('#retainpdf-api-url')).toHaveAttribute('placeholder', retainpdfUrl);
	// No key yet: RetainPDF says no, and the settings say what to do.
	await section.locator('#retainpdf-check').click();
	await expect(section.locator('#retainpdf-status')).toContainText('不认这个 API 密钥');

	await section.locator('#retainpdf-api-key').fill(STAND_IN_KEY);
	await section.locator('#retainpdf-check').click();
	await expect(section.locator('#retainpdf-status')).toHaveText('连上了：书库里有 1 本书，AI 能读到');
	await expect(section.locator('#retainpdf-api-key')).toHaveValue('');
	await expect(section.locator('#retainpdf-api-key')).toHaveAttribute('placeholder', '已保存（不改就空着）');
	expect(JSON.parse(readFileSync(settingsFile(), 'utf8')).retainpdfApiKey).toBe(STAND_IN_KEY);
	const shown = await page.evaluate(async () => (await fetch('/api/studio/settings/retainpdf')).text());
	expect(shown).not.toContain(STAND_IN_KEY);

	// Saved again with the key left empty: kept. Taken away: gone.
	await section.getByRole('button', { name: '保存' }).click();
	await expect(section.locator('#retainpdf-status')).toContainText('已保存');
	expect(JSON.parse(readFileSync(settingsFile(), 'utf8')).retainpdfApiKey).toBe(STAND_IN_KEY);
	await section.locator('#retainpdf-forget-key').click();
	await expect(section.locator('#retainpdf-status')).toHaveText('已删掉密钥');
	expect(JSON.parse(readFileSync(settingsFile(), 'utf8')).retainpdfApiKey).toBeUndefined();
});

test('RetainPDF\'s AI asks the Studio\'s own: the AI opens beside, offering to ask about the page read', async ({ page }) => {
	await openStudio(page);
	await setAddress(page, retainpdfUrl);
	await page.locator('#open-translate').click();
	await expect(inFrame(page).locator('#studio')).toHaveText('quote,open-notes,ask-ai,open-book,shortcut');
	// 摘录 out in the right column: asked, the AI's tab beside it.
	await inFrame(page).locator('#notes').click();
	await expect(page.locator('#side-tab-own-quotes')).toHaveAttribute('aria-selected', 'true');
	await inFrame(page).locator('#read').click();
	await inFrame(page).locator('#ask').click();
	await expect(page.locator('.studio-shell')).not.toHaveClass(/panel-collapsed/u);
	await expect(page.locator('#side-tab-ai')).toHaveAttribute('aria-selected', 'true');
	const ai = page.locator('#side-ai');
	await expect(ai.locator('.ai-empty-hint')).toContainText('《Quantum Chemistry》（第 12 页）');
	await expect(ai.locator('.ai-suggestion').first()).toHaveText('讲讲这一页在说什么');
	// 摘录 still there, a tab away.
	await expect(page.locator('#side-tab-own-quotes')).toHaveCount(1);

	// The reader left: no book read (the note beside it is not any one book's), what it offers is the article's again.
	await inFrame(page).locator('#leave').click();
	await expect(ai.locator('.ai-suggestion').first()).toHaveText('总结这一页');
	await expect(ai.locator('.ai-empty-hint')).not.toContainText('Quantum Chemistry');
	// Read again, then another view: nothing of the book.
	await inFrame(page).locator('#read').click();
	await expect(ai.locator('.ai-empty-hint')).toContainText('《Quantum Chemistry》（第 12 页）');
	await page.locator('#open-translate').click();
	await expect(ai.locator('.ai-empty-hint')).not.toContainText('Quantum Chemistry');
});

test('the passages quoted from the page read are picked out in 摘录; 书 on the note opens the book beside it where it was left', async ({ page }) => {
	await openStudio(page);
	await setAddress(page, retainpdfUrl);
	await page.locator('#open-translate').click();
	await inFrame(page).locator('#quote').click();
	const quoted = page.locator('#side-own-quotes .quotes-passage');
	await expect(quoted).toHaveCount(1);
	const marked = page.locator('#side-own-quotes .quotes-passage[data-current]');
	await expect(marked).toHaveCount(0);
	// The reader at its page (12): picked out; left, none (no book read).
	await inFrame(page).locator('#read').click();
	await expect(marked).toHaveCount(1);
	await inFrame(page).locator('#leave').click();
	await expect(marked).toHaveCount(0);
	await inFrame(page).locator('#read').click();
	await expect(marked).toHaveCount(1);

	// The note on its own (翻译 left): 书 in the bar opens the book beside it, at the page left.
	await page.locator('#open-translate').click();
	await page.locator('#books-toggle').click();
	await expect(page.locator('#books-view')).toBeVisible();
	await expect(page.locator('#translate-view')).toBeHidden();
	await expect(page.locator('#breadcrumb-title')).toHaveText('Studio 测试夹具');
	await expect(page.locator('.book-tab-name[aria-selected="true"]')).toHaveText('Quantum Chemistry');
	await expect(bookFrame(page, 'job-1').locator('#opened')).toHaveText('job_id=job-1&page_idx=11&embed_pane=beside');
});

const bookFrame = (page: Page, job: string) => page.frameLocator(`.book-frame[data-job="${job}"] iframe`);

test('书 beside a note: the books it quotes, a tab each, kept loaded; a mark shows its passage beside the note; what is quoted goes into the note; ＋ opens another', async ({ page }) => {
	appendToFixture(
		'\n[Quantum Chemistry · 第 3 页](retainpdf:job-1/p003-b0001?page=3&document=doc-1) 第一本书。\n\n' +
			'[Statistical Mechanics · 第 8 页](retainpdf:job-2/p008-b0004?page=8&document=doc-2) 第二本书。\n',
	);
	// Nothing but RetainPDF's address set: its API's and key found from its pages.
	tellsKey = true;
	await openStudio(page);
	await setAddress(page, retainpdfUrl);

	// Out beside the note: a tab for each book it quotes, the first shown, opened straight at its reader (no 笔记 of its own).
	await page.locator('#books-toggle').click();
	await expect(page.locator('#books-toggle')).toHaveAttribute('aria-pressed', 'true');
	// The right column (the AI) stays (先不收, 2026-11-03); side by side, the books left.
	await expect(page.locator('.studio-shell')).not.toHaveClass(/panel-collapsed/u);
	const books = await page.locator('#books-view').boundingBox();
	const note = await page.locator('.editor-panel').boundingBox();
	expect(books!.x + books!.width).toBeLessThanOrEqual(note!.x + 1);
	await expect(page.locator('.book-tab-name')).toHaveText(['Quantum Chemistry', 'Statistical Mechanics']);
	await expect(page.locator('.book-tab-name[aria-selected="true"]')).toHaveText('Quantum Chemistry');
	await expect(bookFrame(page, 'job-1').locator('#opened')).toHaveText('job_id=job-1&page_idx=0&embed_pane=beside');
	await expect(bookFrame(page, 'job-1').locator('#studio')).toHaveText('quote,ask-ai,shortcut');
	await expect(page.locator('.book-frame')).toHaveCount(1);
	await expect(page.locator('#breadcrumb-title')).toHaveText('Studio 测试夹具');

	// Another tab, and back: the first one's page was kept, not loaded again.
	await page.frames().find((frame) => frame.url().includes('job_id=job-1'))!.evaluate(() => ((window as unknown as { kept: boolean }).kept = true));
	await page.locator('.book-tab-name', { hasText: 'Statistical Mechanics' }).click();
	await expect(bookFrame(page, 'job-2').locator('#opened')).toHaveText('job_id=job-2&page_idx=0&embed_pane=beside');
	await page.locator('.book-tab-name', { hasText: 'Quantum Chemistry' }).click();
	await expect(page.locator('.book-frame[data-job="job-1"]')).toHaveAttribute('data-shown', '');
	expect(await page.frames().find((frame) => frame.url().includes('job_id=job-1'))!.evaluate(() => (window as unknown as { kept?: boolean }).kept)).toBe(true);

	// A quote's mark: its book shown beside the note at that passage; the note stays.
	await editor(page).locator('p:has(> .retainpdf-source)', { hasText: '第二本书' }).locator('.retainpdf-source').click();
	await expect(page.locator('.book-tab-name[aria-selected="true"]')).toHaveText('Statistical Mechanics');
	await expect(bookFrame(page, 'job-2').locator('#navigated')).toHaveText(JSON.stringify({ job_id: 'job-2', block_id: 'p008-b0004', page_idx: 7 }));
	await expect(page.locator('#breadcrumb-title')).toHaveText('Studio 测试夹具');

	// Where a passage quoted goes, marked in the note while it has not the keys: after its last block (not written in yet).
	await bookFrame(page, 'job-2').locator('#read').click();
	await expect(editor(page).locator('.quote-spot-end')).toHaveAttribute('data-said', '摘录放这里');
	// Taking no room, faint: shown while the keys are in the book.
	const spotShown = () => editor(page).locator('.quote-spot').first().evaluate((element) => getComputedStyle(element).visibility === 'visible').catch(() => false);
	await expect.poll(spotShown).toBe(true);

	// 摘 in a book beside it: into this note (not a book's page of notes); the keys to the note after it, the mark gone.
	await bookFrame(page, 'job-2').locator('#quote').click();
	await expect(page.locator('.studio-toast')).toContainText('已摘到「Studio 测试夹具」');
	const quoted = editor(page).locator('p:has(> .retainpdf-source)', { hasText: '变分原理' });
	await expect(quoted).toHaveCount(1);
	await expect(page.locator('#breadcrumb-title')).toHaveText('Studio 测试夹具');
	await expect.poll(() => page.evaluate(() => document.activeElement?.closest('.ProseMirror') !== null)).toBe(true);
	await expect.poll(spotShown).toBe(false);
	// Another: right after the first (the caret was left there), not at the note's end.
	await bookFrame(page, 'job-2').locator('#quote').click();
	await expect(quoted).toHaveCount(2);
	// (The passage is its words and its formula: the second's words right after the first's formula.)
	expect(await quoted.first().evaluate((element) => element.nextElementSibling?.nextElementSibling?.querySelector(':scope > .retainpdf-source') !== null)).toBe(true);

	// What the AIs are told: the book shown, this note, and the other book beside it.
	await bookFrame(page, 'job-2').locator('#read').click();
	await expect
		.poll(async () => page.evaluate(async () => (await (await fetch('/api/studio/retainpdf/reading')).json()).reading?.notes?.title))
		.toBe('Studio 测试夹具');
	await expect
		.poll(async () => page.evaluate(async () => (await (await fetch('/api/studio/retainpdf/reading')).json()).reading?.others?.map((book: { job_id: string }) => book.job_id)))
		.toEqual(['job-1']);

	// ＋: a book of RetainPDF's not open, from its library (its key found, not filled in).
	await page.locator('#book-tabs-add').click();
	await page.getByRole('menuitem', { name: /Organic Chemistry/u }).click();
	await expect(page.locator('.book-tab-name[aria-selected="true"]')).toHaveText('Organic Chemistry');
	await expect(bookFrame(page, 'job-3').locator('#opened')).toHaveText('job_id=job-3&page_idx=0&embed_pane=beside');

	// A tab closed stays closed for this note, the pane out again when the Studio is opened again.
	await page.locator('.book-tab', { hasText: 'Statistical Mechanics' }).locator('.book-tab-close').click();
	await expect(page.locator('.book-tab-name')).toHaveText(['Quantum Chemistry', 'Organic Chemistry']);
	await page.reload();
	await expect(page.locator('#books-view')).toBeVisible();
	await expect(page.locator('.book-tab-name')).toHaveText(['Quantum Chemistry', 'Organic Chemistry']);

	// Put away: the note alone, the right column still there.
	await page.locator('#books-toggle').click();
	await expect(page.locator('#books-view')).toBeHidden();
	await expect(page.locator('#books-toggle')).toHaveAttribute('aria-pressed', 'false');
	await expect(page.locator('.studio-shell')).not.toHaveClass(/panel-collapsed/u);
});

test('⌘K finds words in the books too: a passage, its book and page; chosen, the book beside the note at it', async ({ page }) => {
	tellsKey = true;
	await openStudio(page);
	await setAddress(page, retainpdfUrl);
	await page.keyboard.press('ControlOrMeta+k');
	await page.locator('#quick-find-input').fill('变分');
	const hit = page.locator('#quick-find-dialog [role="option"]', { hasText: '第 12 页' });
	await expect(hit).toContainText('Organic Chemistry · 第 12 页');
	await expect(hit).toContainText('变分原理告诉我们');
	await hit.click();
	await expect(page.locator('.book-frame[data-job="job-3"]')).toHaveCount(1);
	await expect(page.locator('.book-tab-name[aria-selected="true"]')).toHaveText('Organic Chemistry');
	// At the passage: opened there, or told to go there.
	await expect
		.poll(async () => `${await bookFrame(page, 'job-3').locator('#opened').textContent()} ${await bookFrame(page, 'job-3').locator('#navigated').textContent()}`)
		.toMatch(/page_idx(=|":)11/u);
	await expect(page.locator('#breadcrumb-title')).toHaveText('Studio 测试夹具');
});

test('a book clicked to read in 书库 opens beside the note being written, a tab of it, at its page; the books beside a note do not hand theirs on', async ({ page }) => {
	tellsKey = true;
	await openStudio(page);
	await setAddress(page, retainpdfUrl);
	await page.locator('#open-translate').click();
	await expect(inFrame(page).locator('#studio')).toHaveText('quote,open-notes,ask-ai,open-book,shortcut');

	await inFrame(page).locator('#open-book').click();
	// Back on the note, the book beside it at that page (以笔记为根); 书库 left.
	await expect(page.locator('#translate-view')).toBeHidden();
	await expect(page.locator('#books-view')).toBeVisible();
	await expect(page.locator('#books-toggle')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('#breadcrumb-title')).toHaveText('Studio 测试夹具');
	await expect(page.locator('.book-tab-name[aria-selected="true"]')).toHaveText('Statistical Mechanics');
	await expect(bookFrame(page, 'job-2').locator('#opened')).toHaveText('job_id=job-2&page_idx=7&embed_pane=beside');
	// A book beside a note is not told the Studio takes open-book: it does not hand its books on.
	await expect(bookFrame(page, 'job-2').locator('#studio')).toHaveText('quote,ask-ai,shortcut');
	// What is quoted from it goes into the note.
	await bookFrame(page, 'job-2').locator('#quote').click();
	await expect(page.locator('.studio-toast')).toContainText('已摘到「Studio 测试夹具」');
});

test('⤢ 整页读: the book over the whole middle, the note put away meanwhile and still quoted into; ⤡ back beside it', async ({ page }) => {
	appendToFixture('\n[Quantum Chemistry · 第 3 页](retainpdf:job-1/p003-b0001?page=3&document=doc-1) 第一本书。\n');
	tellsKey = true;
	await openStudio(page);
	await setAddress(page, retainpdfUrl);
	await page.locator('#books-toggle').click();
	await expect(bookFrame(page, 'job-1').locator('#opened')).toHaveText('job_id=job-1&page_idx=0&embed_pane=beside');
	const wide = page.locator('#book-tabs-wide');
	await expect(wide).toHaveAttribute('aria-pressed', 'false');
	const beside = (await page.locator('#books-view').boundingBox())!.width;

	await wide.click();
	await expect(wide).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.editor-panel')).toBeHidden();
	const middle = (await page.locator('.workspace-main').boundingBox())!.width;
	await expect.poll(async () => (await page.locator('#books-view').boundingBox())!.width).toBeGreaterThan(Math.max(beside + 200, middle - 4));
	// The note is still the one quoted into, and the bar says it.
	await expect(page.locator('#breadcrumb-title')).toHaveText('Studio 测试夹具');
	await bookFrame(page, 'job-1').locator('#quote').click();
	await expect(page.locator('.studio-toast')).toContainText('已摘到「Studio 测试夹具」');

	// ⤡: beside the note again, the passage in it.
	await wide.click();
	await expect(wide).toHaveAttribute('aria-pressed', 'false');
	await expect(page.locator('.editor-panel')).toBeVisible();
	await expect(editor(page).locator('p:has(> .retainpdf-source)', { hasText: '变分原理' })).toHaveCount(1);

	// The books put away while over the whole middle: out again, beside the note.
	await wide.click();
	await page.locator('#books-toggle').click();
	await expect(page.locator('.editor-panel')).toBeVisible();
	await page.locator('#books-toggle').click();
	await expect(wide).toHaveAttribute('aria-pressed', 'false');
	await expect(page.locator('.editor-panel')).toBeVisible();
});

test('the Studio\'s keys pressed in a book (⌘K): given to the Studio, as if pressed in it', async ({ page }) => {
	appendToFixture('\n[Quantum Chemistry · 第 3 页](retainpdf:job-1/p003-b0001?page=3&document=doc-1) 第一本书。\n');
	tellsKey = true;
	await openStudio(page);
	await setAddress(page, retainpdfUrl);
	await page.locator('#books-toggle').click();
	await expect(bookFrame(page, 'job-1').locator('#studio')).toHaveText('quote,ask-ai,shortcut');
	await bookFrame(page, 'job-1').locator('#press-cmd-k').click();
	await expect(page.locator('#quick-find-input')).toBeVisible();
	await expect(page.locator('#quick-find-input')).toBeFocused();
});

test('a passage quoted before (a ```retainpdf block) opens as one quoted now: its translation, the mark in its corner; saved so', async ({ page }) => {
	appendToFixture('\n```retainpdf\nbook: Quantum Chemistry\ndocument: doc-1\njob: job-1\nblock: p004-b0002\npage: 4\n---\nThe old way.\n---\n旧的摘录。\n```\n');
	await openStudio(page, { settled: false });
	const quoted = editor(page).locator('p:has(> .retainpdf-source)');
	await expect(quoted).toHaveText('旧的摘录。');
	await expect(editor(page).locator('.milkdown-code-block')).toHaveCount(0);
	await quoted.click();
	await page.keyboard.press('End');
	await page.keyboard.type('！');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('[Quantum Chemistry · 第 4 页](retainpdf:job-1/p004-b0002?page=4&document=doc-1) 旧的摘录。！');
	expect(savedMarkdown()).not.toContain('```retainpdf');
});

test('the line between a note and its books dragged: the note wider, its width set on the grid (not on the shell, where each step had the whole note\'s style worked out again)', async ({ page }) => {
	appendToFixture('\n[Quantum Chemistry · 第 12 页](retainpdf:job-1/p012-b0003?page=12&document=doc-1) 变分原理。\n');
	await openStudio(page);
	await setAddress(page, retainpdfUrl);
	await page.locator('#books-toggle').click();
	await expect(page.locator('#books-view')).toBeVisible();
	const notesPanel = page.locator('.editor-panel');
	const before = (await notesPanel.boundingBox())!.width;
	const line = (await page.locator('#books-view .notes-divider').boundingBox())!;
	await page.mouse.move(line.x + line.width / 2, line.y + 200);
	await page.mouse.down();
	await page.mouse.move(line.x - 120, line.y + 200, { steps: 5 });
	await page.mouse.up();
	await expect.poll(async () => (await notesPanel.boundingBox())!.width).toBeGreaterThan(before + 80);
	await expect
		.poll(() => page.evaluate(() => [document.querySelector<HTMLElement>('.studio-shell')!.style.getPropertyValue('--notes-width'), document.querySelector<HTMLElement>('.workspace-main')!.style.getPropertyValue('--notes-width')]))
		.toEqual(['', expect.stringMatching(/^\d+px$/u)]);
});
