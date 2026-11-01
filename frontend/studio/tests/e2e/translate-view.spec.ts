import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { editor, openSettings, openStudio, removeArticle, resetFixture, savedMarkdown, saveStatus } from './studio.ts';

// 翻译 (the left column): RetainPDF's own pages in the middle, at the address in 设置 › RetainPDF. Here a stand-in for
// RetainPDF answers on a port of its own: every page of it is 图书馆, speaking studio-bridge.v1 as RetainPDF's does
// (hello → ready; theme, navigate shown on the page; 摘 sends a quote).

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
<p>embed <span id="embed"></span> · theme <span id="theme"></span> · studio <span id="studio"></span> · navigated <span id="navigated"></span> · notes <span id="notes-state"></span></p>
<button id="quote" type="button">摘</button>
<button id="notes" type="button">笔记</button>
<script>
const head = { protocol: 'retainpdf-studio-bridge', v: 1 };
let host = '';
document.querySelector('#embed').textContent = new URLSearchParams(location.search).get('embed') || '';
addEventListener('message', (event) => {
	const message = event.data;
	if (event.source !== parent || !message || message.protocol !== head.protocol || message.v !== 1) return;
	if (message.type === 'hello') {
		host = event.origin;
		document.querySelector('#theme').textContent = message.theme;
		document.querySelector('#studio').textContent = (message.features || []).join(',');
		parent.postMessage({ ...head, type: 'ready', features: ['theme', 'navigate', 'quote', 'notes'] }, host);
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
document.querySelector('#quote').addEventListener('click', () => parent.postMessage({
	...head, type: 'quote', job_id: 'job-1', document_id: 'doc-1', title: 'Quantum Chemistry', item_id: 'p012-b0003', page_idx: 11,
	source_text: 'The variation principle $x^2$.', translated_text: '变分原理：\\n\\n$$E = mc^2$$',
}, host));
</script>`;

let retainpdf: Server;
let retainpdfUrl = '';

test.beforeAll(async () => {
	retainpdf = createServer((_request, response) => {
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
	await expect(inFrame(page).locator('#studio')).toHaveText('quote,open-notes');
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

test('摘到笔记 in RetainPDF puts the passage in the book\'s page of notes, opened beside it; its card opens RetainPDF there again', async ({ page }) => {
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
	const card = notesPanel.locator('.retainpdf-quote');
	await expect(card).toHaveCount(1);
	await expect(card).toBeInViewport();
	await expect(card.locator('.retainpdf-quote-where')).toHaveText('Quantum Chemistry · 第 12 页');
	// A block of its own: no code block's language or tools; RetainPDF's mark in its corner.
	await expect(editor(page).locator('.milkdown-code-block:has(.retainpdf-quote) .tools')).toBeHidden();
	await expect(card.locator('.retainpdf-quote-logo svg')).toBeVisible();
	// The text as Markdown, its formulas drawn (inline in the original, display in the translation).
	await expect(card.locator('.retainpdf-quote-source')).toContainText('The variation principle');
	await expect(card.locator('.retainpdf-quote-source .katex')).toHaveCount(1);
	await expect(card.locator('.retainpdf-quote-translated .katex-display')).toHaveCount(1);
	await expect(card).not.toContainText('$');

	// Another: after it (the caret was not put in the note), not above.
	await inFrame(page).locator('#quote').click();
	await expect(card).toHaveCount(2);
	// Saved as an article is (the bar says it): the keys to the Studio, not to RetainPDF's frame clicked last.
	await page.locator('#breadcrumb-title').click();
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	const quoted = '```retainpdf\nbook: Quantum Chemistry\ndocument: doc-1\njob: job-1\nblock: p012-b0003\npage: 12\n---\nThe variation principle $x^2$.\n---\n变分原理：\n\n$$E = mc^2$$\n```\n';
	const saved = await bookNoteSaved(page);
	expect(saved.split(quoted).length - 1).toBe(2);
	// Notes, not a post: a 维基 page, no line to write over above the quotes.
	expect(saved).toContain('\nkind: wiki\n');
	expect(saved).not.toContain('从这里开始写作');
	expect(savedMarkdown()).not.toContain('```retainpdf');

	// Its card: 翻译 again, at that passage.
	await card.first().locator('.retainpdf-quote-logo').click();
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
	await expect(notesPanel.locator('.retainpdf-quote')).toHaveCount(1);

	// The line between them dragged: the note wider.
	const divider = page.locator('.notes-divider');
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
	await expect(notesPanel.locator('.retainpdf-quote')).toHaveCount(1);
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
	await expect(editor(page).locator('.retainpdf-quote')).toHaveCount(0);
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
