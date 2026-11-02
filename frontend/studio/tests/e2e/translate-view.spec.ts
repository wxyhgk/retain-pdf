import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openSettings, openStudio, removeArticle, resetFixture, savedMarkdown, saveStatus } from './studio.ts';

// 翻译 (the left column): RetainPDF's own pages in the middle, at the address in 设置 › RetainPDF. Here a stand-in for
// RetainPDF answers on a port of its own: every page of it is 图书馆, speaking studio-bridge.v1 as RetainPDF's does
// (hello → ready; theme, navigate shown on the page; 摘 sends a quote; 读 and 离开 say what is read, or that nothing is;
// AI asks the Studio's AI, as its reader's AI does in the Studio). It says which book and page its address opened it at
// (a book beside a note is opened straight at its reader).
// Its API answers too, as far as the settings' 测试连接 and 书's ＋ ask it, with the key STAND_IN_KEY: one book.

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
<p>opened <span id="opened"></span> · embed <span id="embed"></span> · theme <span id="theme"></span> · studio <span id="studio"></span> · navigated <span id="navigated"></span> · notes <span id="notes-state"></span></p>
<button id="quote" type="button">摘</button>
<button id="notes" type="button">笔记</button>
<button id="read" type="button">读</button>
<button id="leave" type="button">离开</button>
<button id="ask" type="button">AI</button>
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
		parent.postMessage({ ...head, type: 'ready', features: ['theme', 'navigate', 'quote', 'notes', 'reading'] }, host);
	} else if (message.type === 'theme') {
		document.querySelector('#theme').textContent = message.theme;
	} else if (message.type === 'navigate') {
		const { protocol, v, type, ...target } = message;
		document.querySelector('#navigated').textContent = JSON.stringify(target);
	} else if (message.type === 'notes') {
		document.querySelector('#notes-state').textContent = message.open ? 'open:' + message.title : 'closed';
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
document.querySelector('#quote').addEventListener('click', () => parent.postMessage({
	...head, type: 'quote', job_id: 'job-1', document_id: 'doc-1', title: 'Quantum Chemistry', item_id: 'p012-b0003', page_idx: 11,
	source_text: 'The variation principle $x^2$.', translated_text: '变分原理：\\n\\n$$E = mc^2$$',
}, host));
</script>`;

const STAND_IN_KEY = 'stand-in-key';
let retainpdf: Server;
let retainpdfUrl = '';

test.beforeAll(async () => {
	retainpdf = createServer((request, response) => {
		if (request.url?.startsWith('/api/v1/')) {
			const known = request.headers['x-api-key'] === STAND_IN_KEY;
			response.writeHead(known ? 200 : 401, { 'Content-Type': 'application/json' });
			const documents = [{ document_id: 'doc-3', title: 'Organic Chemistry', page_count: 120, active_job_id: 'job-3' }];
			response.end(JSON.stringify(known ? { code: 0, message: 'ok', data: { documents, total: 1, has_more: false } } : { code: 40100, message: 'unauthorized', error: { code: 'UNAUTHORIZED', http_status: 401, details: {} } }));
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
	resetFixture();
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
/** The book's page of notes (RetainPDF's doc-1) as saved. */
async function bookNoteSaved(page: Page): Promise<string> {
	const all = await page.evaluate(async () => ((await (await fetch('/api/studio/articles')).json()) as { articles: Array<{ slug: string; retainpdf?: { document?: string } }> }).articles);
	const book = all.find((entry) => entry.retainpdf?.document === 'doc-1');
	if (!book) throw new Error('no page of notes for doc-1');
	return readFileSync(join(process.env.STUDIO_BLOG_DIR!, book.slug, 'index.md'), 'utf8');
}

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
	await expect(inFrame(page).locator('#studio')).toHaveText('quote,open-notes,ask-ai');
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

test('摘到笔记 in RetainPDF puts the passage in the book\'s page of notes, opened beside it as its own text; its mark opens RetainPDF there again', async ({ page }) => {
	await openStudio(page);
	await setAddress(page, retainpdfUrl);
	// Another note open, the caret in it: not where a passage of the book goes.
	await editor(page).locator('p').last().click();
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
	await expect(page.locator('.studio-toast')).toContainText('已摘到「Quantum Chemistry」');
	// The book's notes opened beside the pages, RetainPDF told; the passage there, shown.
	const notesPanel = page.locator('.editor-panel');
	await expect(notesPanel).toBeVisible();
	await expect(inFrame(page).locator('#notes-state')).toHaveText('open:Quantum Chemistry');
	// The note's own text (the translation, its formula drawn), RetainPDF's mark in the corner of its first paragraph.
	const mark = notesPanel.locator('.retainpdf-source');
	await expect(mark).toHaveCount(1);
	const quotedText = notesPanel.locator('.ProseMirror p:has(> .retainpdf-source)');
	await expect(quotedText).toBeInViewport();
	await expect(quotedText).toHaveText('变分原理：');
	await expect(mark.locator('svg')).toBeVisible();
	await expect(mark).toHaveAttribute('title', 'Quantum Chemistry · 第 12 页 · 在 RetainPDF 中打开');
	// In the top right corner of its paragraph (once the right column has folded away).
	const corner = () =>
		quotedText.evaluate((element) => {
			const text = element.getBoundingClientRect();
			const shown = element.querySelector('.retainpdf-source')!.getBoundingClientRect();
			return Math.abs(text.right - shown.right) < 4 && shown.top - text.top < 12;
		});
	await expect.poll(corner).toBe(true);
	// Room kept for it: the text does not run under it.
	expect(await quotedText.evaluate((element) => getComputedStyle(element).paddingRight)).toBe('30px');
	await expect(editor(page).locator('.katex-display')).toHaveCount(1);
	await expect(notesPanel).not.toContainText('The variation principle');
	await expect(editor(page).locator('.milkdown-code-block')).toHaveCount(0);

	// Another: after it (the caret was not put in the note), not above.
	await inFrame(page).locator('#quote').click();
	await expect(mark).toHaveCount(2);
	// Written in as any text is.
	await quotedText.first().click();
	await page.keyboard.press('End');
	await page.keyboard.type('（要记住）');
	await expect(quotedText.first()).toHaveText('变分原理：（要记住）');
	// Saved as an article is (the bar says it): the keys to the Studio, not to RetainPDF's frame clicked last.
	await page.locator('#breadcrumb-title').click();
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	const link = '[Quantum Chemistry · 第 12 页](retainpdf:job-1/p012-b0003?page=12&document=doc-1) 变分原理：';
	const saved = await bookNoteSaved(page);
	expect(saved.split(link).length - 1).toBe(2);
	expect(saved).toContain(`${link}（要记住）`);
	expect(saved).toContain('E = mc^2');
	expect(saved).not.toContain('```retainpdf');
	// Notes, not a post: a 维基 page, no line to write over above the quotes.
	expect(saved).toContain('\nkind: wiki\n');
	expect(saved).not.toContain('从这里开始写作');
	expect(savedMarkdown()).not.toContain('retainpdf:');

	// Its mark: 翻译 again, at that passage.
	await mark.first().click();
	await expect(page.locator('#translate-view')).toBeVisible();
	await expect(inFrame(page).locator('#navigated')).toHaveText(JSON.stringify({ job_id: 'job-1', block_id: 'p012-b0003', page_idx: 11 }));
});

test('笔记 in RetainPDF opens the book\'s page of notes beside it, under 读书笔记, the same one each time', async ({ page }) => {
	await openStudio(page);
	await setAddress(page, retainpdfUrl);
	await page.locator('#open-translate').click();
	await expect(inFrame(page).locator('#notes-state')).toHaveText('closed');
	const notesPanel = page.locator('.editor-panel');
	await expect(notesPanel).toBeHidden();

	const shell = page.locator('.studio-shell');
	await expect(shell).not.toHaveClass(/panel-collapsed/u);
	await inFrame(page).locator('#notes').click();
	await expect(inFrame(page).locator('#notes-state')).toHaveText('open:Quantum Chemistry');
	await expect(page.locator('#translate-view')).toBeVisible();
	await expect(notesPanel).toBeVisible();
	await expect(page.locator('.document-header')).toContainText('Quantum Chemistry');
	// The note wants the room: the right column folded away meanwhile; the bar says the note as for an article.
	await expect(shell).toHaveClass(/panel-collapsed/u);
	await expect(page.locator('#breadcrumb-title')).toHaveText('Quantum Chemistry');
	// Narrow, the note's head is: no blog properties beside the pages.
	await expect(notesPanel.locator('.page-properties')).toBeHidden();
	// Side by side: the pages left, the note right.
	const pages = await page.locator('#translate-view').boundingBox();
	const note = await notesPanel.boundingBox();
	expect(pages!.x + pages!.width).toBeLessThanOrEqual(note!.x + 1);
	// Under 读书笔记 in the tree.
	await expect(page.locator('#article-list')).toContainText('读书笔记');

	// A passage quoted lands in it, seen at once.
	await inFrame(page).locator('#quote').click();
	await expect(notesPanel.locator('.retainpdf-source')).toHaveCount(1);

	// The line between them dragged: the note wider.
	const divider = page.locator('#translate-view .notes-divider');
	const line = await divider.boundingBox();
	await page.mouse.move(line!.x + line!.width / 2, line!.y + 200);
	await page.mouse.down();
	await page.mouse.move(line!.x - 120, line!.y + 200, { steps: 5 });
	await page.mouse.up();
	expect((await notesPanel.boundingBox())!.width).toBeGreaterThan(note!.width + 80);

	// Another page opened from the tree meanwhile: back in 翻译, the book's page beside it again; the right column
	// back while the page was shown on its own.
	await page.locator('#article-list .page-row', { hasText: 'Studio 测试夹具' }).click();
	await expect(page.locator('#translate-view')).toBeHidden();
	await expect(shell).not.toHaveClass(/panel-collapsed/u);
	await page.locator('#open-translate').click();
	await expect(notesPanel).toBeVisible();
	await expect(page.locator('.document-header')).toContainText('Quantum Chemistry');
	await expect(shell).toHaveClass(/panel-collapsed/u);

	// Put away from the Studio's side: RetainPDF told, the right column back; asked again, the same page (not another one).
	await page.locator('#notes-close').click();
	await expect(notesPanel).toBeHidden();
	await expect(shell).not.toHaveClass(/panel-collapsed/u);
	await expect(inFrame(page).locator('#notes-state')).toHaveText('closed');
	await inFrame(page).locator('#notes').click();
	await expect(notesPanel).toBeVisible();
	await expect(notesPanel.locator('.retainpdf-source')).toHaveCount(1);
	// And from RetainPDF's.
	await inFrame(page).locator('#notes').click();
	await expect(notesPanel).toBeHidden();
	const books = await page.evaluate(async () => ((await (await fetch('/api/studio/articles')).json()) as { articles: Array<{ title: string; retainpdf?: { books?: boolean; document?: string } }> }).articles);
	expect(books.filter((entry) => entry.retainpdf?.books).length).toBe(1);
	expect(books.filter((entry) => entry.retainpdf?.document === 'doc-1').length).toBe(1);
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

test('what RetainPDF says is read (the book, the page) is kept for the AIs while 翻译 shows it, with the book\'s notes; nothing elsewhere', async ({ page }) => {
	await openStudio(page);
	await setAddress(page, retainpdfUrl);
	await page.locator('#open-translate').click();
	await expect(inFrame(page).locator('#library')).toHaveText('图书馆');
	await expect.poll(() => reading(page)).toBeNull();

	await inFrame(page).locator('#read').click();
	await expect.poll(() => reading(page)).toMatchObject({ job_id: 'job-1', document_id: 'doc-1', title: 'Quantum Chemistry', page: 12, pages: 300, notes: null });

	// Its notes opened beside it: which page they are, too.
	await inFrame(page).locator('#notes').click();
	await expect(inFrame(page).locator('#notes-state')).toHaveText('open:Quantum Chemistry');
	await expect.poll(async () => (await reading(page))?.notes).toMatchObject({ title: 'Quantum Chemistry' });

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
	await expect(inFrame(page).locator('#studio')).toHaveText('quote,open-notes,ask-ai');
	// The notes open, the right column folded away for them: asked, it is there again, on the AI.
	await inFrame(page).locator('#notes').click();
	await expect(page.locator('.studio-shell')).toHaveClass(/panel-collapsed/u);
	await inFrame(page).locator('#read').click();
	await inFrame(page).locator('#ask').click();
	await expect(page.locator('.studio-shell')).not.toHaveClass(/panel-collapsed/u);
	await expect(page.locator('#side-tab-ai')).toHaveAttribute('aria-selected', 'true');
	const ai = page.locator('#side-ai');
	await expect(ai.locator('.ai-empty-hint')).toContainText('《Quantum Chemistry》（第 12 页）');
	await expect(ai.locator('.ai-suggestion').first()).toHaveText('讲讲这一页在说什么');
	// Its notes still beside the pages.
	await expect(page.locator('.editor-panel')).toBeVisible();

	// The reader left: no page to ask about (the book still, its notes open), what it offers is the article's again.
	await inFrame(page).locator('#leave').click();
	await expect(ai.locator('.ai-suggestion').first()).toHaveText('总结这篇文章');
	await expect(ai.locator('.ai-empty-hint')).toContainText('《Quantum Chemistry》，');
	// Another view: nothing of the book.
	await page.locator('#article-list .page-row', { hasText: 'Studio 测试夹具' }).click();
	await expect(ai.locator('.ai-empty-hint')).not.toContainText('Quantum Chemistry');
});

test('the passages quoted from the page read are picked out in the notes; 书 on the notes opens the book beside them where it was left', async ({ page }) => {
	await openStudio(page);
	await setAddress(page, retainpdfUrl);
	await page.locator('#open-translate').click();
	await inFrame(page).locator('#quote').click();
	const quoted = page.locator('.editor-panel .ProseMirror p:has(> .retainpdf-source)');
	await expect(quoted).toHaveCount(1);
	const marked = () => quoted.evaluate((element) => getComputedStyle(element).boxShadow);
	await expect.poll(marked).toBe('none');
	// The reader at its page (12): picked out; left, no longer.
	await inFrame(page).locator('#read').click();
	await expect.poll(marked).not.toBe('none');
	await inFrame(page).locator('#leave').click();
	await expect.poll(marked).toBe('none');
	await inFrame(page).locator('#read').click();
	await expect.poll(marked).not.toBe('none');

	// The notes opened on their own (from the tree): 书 in the bar opens the book beside them, at the page left.
	await page.locator('#article-list .page-row', { hasText: 'Quantum Chemistry' }).click();
	await expect.poll(marked).toBe('none');
	await page.locator('#books-toggle').click();
	await expect(page.locator('#books-view')).toBeVisible();
	await expect(page.locator('#translate-view')).toBeHidden();
	await expect(page.locator('#breadcrumb-title')).toHaveText('Quantum Chemistry');
	await expect(page.locator('.book-tab-name[aria-selected="true"]')).toHaveText('Quantum Chemistry');
	await expect(bookFrame(page, 'job-1').locator('#opened')).toHaveText('job_id=job-1&page_idx=11');
});

const bookFrame = (page: Page, job: string) => page.frameLocator(`.book-frame[data-job="${job}"] iframe`);

test('书 beside a note: the books it quotes, a tab each, kept loaded; a mark shows its passage beside the note; what is quoted goes into the note; ＋ opens another', async ({ page }) => {
	appendToFixture(
		'\n[Quantum Chemistry · 第 3 页](retainpdf:job-1/p003-b0001?page=3&document=doc-1) 第一本书。\n\n' +
			'[Statistical Mechanics · 第 8 页](retainpdf:job-2/p008-b0004?page=8&document=doc-2) 第二本书。\n',
	);
	await openStudio(page);
	await page.evaluate(async (url) => {
		await fetch('/api/studio/settings/retainpdf', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, apiKey: 'stand-in-key' }) });
	}, retainpdfUrl);

	// Out beside the note: a tab for each book it quotes, the first shown, opened straight at its reader (no 笔记 of its own).
	await page.locator('#books-toggle').click();
	await expect(page.locator('#books-toggle')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.book-tab-name')).toHaveText(['Quantum Chemistry', 'Statistical Mechanics']);
	await expect(page.locator('.book-tab-name[aria-selected="true"]')).toHaveText('Quantum Chemistry');
	await expect(bookFrame(page, 'job-1').locator('#opened')).toHaveText('job_id=job-1&page_idx=0');
	await expect(bookFrame(page, 'job-1').locator('#studio')).toHaveText('quote,ask-ai');
	await expect(page.locator('.book-frame')).toHaveCount(1);
	await expect(page.locator('#breadcrumb-title')).toHaveText('Studio 测试夹具');

	// Another tab, and back: the first one's page was kept, not loaded again.
	await page.frames().find((frame) => frame.url().includes('job_id=job-1'))!.evaluate(() => ((window as unknown as { kept: boolean }).kept = true));
	await page.locator('.book-tab-name', { hasText: 'Statistical Mechanics' }).click();
	await expect(bookFrame(page, 'job-2').locator('#opened')).toHaveText('job_id=job-2&page_idx=0');
	await page.locator('.book-tab-name', { hasText: 'Quantum Chemistry' }).click();
	await expect(page.locator('.book-frame[data-job="job-1"]')).toHaveAttribute('data-shown', '');
	expect(await page.frames().find((frame) => frame.url().includes('job_id=job-1'))!.evaluate(() => (window as unknown as { kept?: boolean }).kept)).toBe(true);

	// A quote's mark: its book shown beside the note at that passage; the note stays.
	await editor(page).locator('p:has(> .retainpdf-source)', { hasText: '第二本书' }).locator('.retainpdf-source').click();
	await expect(page.locator('.book-tab-name[aria-selected="true"]')).toHaveText('Statistical Mechanics');
	await expect(bookFrame(page, 'job-2').locator('#navigated')).toHaveText(JSON.stringify({ job_id: 'job-2', block_id: 'p008-b0004', page_idx: 7 }));
	await expect(page.locator('#breadcrumb-title')).toHaveText('Studio 测试夹具');

	// 摘 in a book beside it: into this note (not a book's page of notes).
	await bookFrame(page, 'job-2').locator('#quote').click();
	await expect(page.locator('.studio-toast')).toContainText('已摘到「Studio 测试夹具」');
	await expect(editor(page).locator('p:has(> .retainpdf-source)', { hasText: '变分原理' })).toHaveCount(1);
	await expect(page.locator('#breadcrumb-title')).toHaveText('Studio 测试夹具');

	// What the AIs are told: the book shown, and this note.
	await bookFrame(page, 'job-2').locator('#read').click();
	await expect
		.poll(async () => page.evaluate(async () => (await (await fetch('/api/studio/retainpdf/reading')).json()).reading?.notes?.title))
		.toBe('Studio 测试夹具');

	// ＋: a book of RetainPDF's not open, from its library.
	await page.locator('#book-tabs-add').click();
	await page.getByRole('menuitem', { name: /Organic Chemistry/u }).click();
	await expect(page.locator('.book-tab-name[aria-selected="true"]')).toHaveText('Organic Chemistry');
	await expect(bookFrame(page, 'job-3').locator('#opened')).toHaveText('job_id=job-3&page_idx=0');

	// A tab closed stays closed for this note, the pane out again when the Studio is opened again.
	await page.locator('.book-tab', { hasText: 'Statistical Mechanics' }).locator('.book-tab-close').click();
	await expect(page.locator('.book-tab-name')).toHaveText(['Quantum Chemistry', 'Organic Chemistry']);
	await page.reload();
	await expect(page.locator('#books-view')).toBeVisible();
	await expect(page.locator('.book-tab-name')).toHaveText(['Quantum Chemistry', 'Organic Chemistry']);

	// Put away: the note alone.
	await page.locator('#books-toggle').click();
	await expect(page.locator('#books-view')).toBeHidden();
	await expect(page.locator('#books-toggle')).toHaveAttribute('aria-pressed', 'false');
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
