import { readFileSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { openStudio, removeArticle, resetFixture, writeArticle } from './studio.ts';

// 书库 (library/BookShelf.tsx): RetainPDF's books drawn by the Studio. A stand-in for RetainPDF answers on a port of its
// own: its API as far as 书库 asks it (two books, one translated and quoted in a note, one translating; their jobs,
// contents, covers; a job stopped), with the key KEY; its pages a reader that speaks studio-bridge.v1 enough to be opened
// beside a note (hello → ready; where its address opened it and where it was told to go, shown).

const KEY = 'shelf-key';
const QC = 'a'.repeat(64);
const OC = 'b'.repeat(64);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

const READER = `<!doctype html><meta charset="utf-8"><title>RetainPDF</title>
<p>opened <span id="opened"></span> · navigated <span id="navigated"></span></p>
<script>
document.querySelector('#opened').textContent = location.search;
const head = { protocol: 'retainpdf-studio-bridge', v: 1 };
addEventListener('message', (event) => {
	const message = event.data;
	if (event.source !== parent || !message || message.protocol !== head.protocol) return;
	if (message.type === 'hello') parent.postMessage({ ...head, type: 'ready', features: ['theme', 'navigate', 'quote', 'reading'] }, event.origin);
	if (message.type === 'navigate') {
		const { protocol, v, type, ...target } = message;
		document.querySelector('#navigated').textContent = JSON.stringify(target);
	}
});
</script>`;

let retainpdf: Server;
let retainpdfUrl = '';
let cancelled: string[] = [];

const BOOKS = () => [
	{ document_id: QC, title: 'Quantum Chemistry', page_count: 300, active_job_id: 'job-qc', has_translation: true, reading_status: 'reading' },
	{ document_id: OC, title: 'Organic Chemistry', page_count: 120, active_job_id: 'job-oc', has_translation: false, reading_status: 'unread' },
];
const JOBS = () => ({
	'job-qc': { job_id: 'job-qc', workflow: 'book', status: 'succeeded', stage_snapshot: null, created_at: '2026-11-01T08:00:00Z' },
	'job-oc': cancelled.includes('job-oc')
		? { job_id: 'job-oc', workflow: 'book', status: 'canceled', stage_snapshot: null, created_at: '2026-11-03T08:00:00Z' }
		: { job_id: 'job-oc', workflow: 'book', status: 'running', stage_snapshot: { display_stage: '翻译', progress: { current: 48, total: 120, percent: 40 } }, created_at: '2026-11-03T08:00:00Z' },
});

test.beforeAll(async () => {
	retainpdf = createServer((request, response) => {
		const url = new URL(request.url ?? '/', 'http://stand-in');
		const path = url.pathname;
		if (!path.startsWith('/api/v1/')) {
			response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
			response.end(READER);
			return;
		}
		if (request.headers['x-api-key'] !== KEY) {
			response.writeHead(401, { 'Content-Type': 'application/json' });
			response.end(JSON.stringify({ code: 40100, message: 'unauthorized', error: { code: 'UNAUTHORIZED', http_status: 401, details: {} } }));
			return;
		}
		if (path === `/api/v1/documents/${QC}/files/thumbnail.jpg`) {
			response.writeHead(200, { 'Content-Type': 'image/png' });
			response.end(PNG);
			return;
		}
		const ok = (data: unknown) => {
			response.writeHead(200, { 'Content-Type': 'application/json' });
			response.end(JSON.stringify({ code: 0, message: 'ok', data }));
		};
		const jobs = JOBS();
		const book = BOOKS().find((each) => path.startsWith(`/api/v1/documents/${each.document_id}`));
		if (path === '/api/v1/documents') {
			const q = (url.searchParams.get('q') ?? '').toLowerCase();
			const documents = BOOKS().filter((each) => each.title.toLowerCase().includes(q));
			return ok({ documents, total: documents.length, has_more: false });
		}
		if (path === '/api/v1/jobs') return ok({ items: (url.searchParams.get('job_ids') ?? '').split(',').map((id) => jobs[id as keyof typeof jobs]).filter(Boolean), has_more: false });
		if (book && path.endsWith('/jobs')) return ok({ items: [jobs[book.active_job_id as keyof typeof jobs]] });
		if (book && path.endsWith('/translation-coverage')) return ok({ page_count: book.page_count, translated_pages: book.has_translation ? book.page_count : 48 });
		if (book && path.endsWith('/reading')) return ok({ job_id: book.active_job_id, merged: false, contributing_job_ids: [book.active_job_id] });
		if (book) return ok(book);
		if (path === '/api/v1/jobs/job-qc/reader/regions') {
			const block = (id: string, page: number, text: string, level?: number) => ({ item_id: id, source: { page, text }, translated: { page, text }, sub_type: level ? 'title' : 'body', ...(level ? { heading_level: level } : {}) });
			return ok({ items: [block('p001-b0000', 1, '第一章 量子力学', 1), block('p001-b0001', 1, '正文'), block('p005-b0000', 5, '1.1 薛定谔方程', 2)] });
		}
		if (path === '/api/v1/jobs/job-oc/actions/cancel' && request.method === 'POST') {
			cancelled.push('job-oc');
			return ok({ job_id: 'job-oc', status: 'canceled' });
		}
		response.writeHead(404, { 'Content-Type': 'application/json' });
		response.end(JSON.stringify({ code: 40400, message: 'not found', error: { code: 'NOT_FOUND', http_status: 404, details: {} } }));
	});
	await new Promise<void>((resolve) => retainpdf.listen(0, '127.0.0.1', resolve));
	retainpdfUrl = `http://127.0.0.1:${(retainpdf.address() as AddressInfo).port}/`;
});
test.afterAll(() => new Promise<void>((resolve) => retainpdf.close(() => resolve())));
test.beforeEach(() => {
	cancelled = [];
	resetFixture();
	writeArticle('shelf-note', `---\ntitle: 读书摘记\n---\n\n[Quantum Chemistry · 第 12 页](retainpdf:job-qc/p012-b0003?page=12&document=${QC}) 变分原理告诉我们，能量有下界。\n`);
});
test.afterEach(() => {
	removeArticle('shelf-note');
	// RetainPDF's settings left as the other tests start: none.
	const file = join(process.env.STUDIO_BLOG_DIR!, '.studio-settings.json');
	try {
		const settings = JSON.parse(readFileSync(file, 'utf8'));
		delete settings.retainpdfUrl;
		delete settings.retainpdfApiUrl;
		delete settings.retainpdfApiKey;
		writeFileSync(file, JSON.stringify(settings, null, 2));
	} catch {
		// No settings kept.
	}
});

async function connect(page: Page): Promise<void> {
	const status = await page.evaluate(
		async ([url, key]) => (await fetch('/api/studio/settings/retainpdf', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, apiUrl: url, apiKey: key }) })).status,
		[retainpdfUrl, KEY],
	);
	expect(status).toBe(200);
}

const card = (page: Page, title: string) => page.locator('.shelf-card', { hasText: title });

test('书库 is the Studio\'s page of RetainPDF\'s books: covers, how far, what the notes quote, a translation going; filtered, searched', async ({ page }) => {
	await openStudio(page);
	await connect(page);
	await page.locator('#open-library').click();
	await expect(page.locator('#open-library')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('#library-view')).toBeVisible();
	await expect(page.locator('.editor-panel')).toBeHidden();
	expect(new URL(page.url()).searchParams.has('library')).toBe(true);
	// Not RetainPDF's own page.
	await expect(page.locator('#translate-view')).toBeHidden();

	await expect(page.locator('.shelf-card')).toHaveCount(2);
	await expect(card(page, 'Quantum Chemistry').locator('.shelf-quoted')).toHaveText('摘 1 段 · 1 篇笔记');
	await expect(card(page, 'Quantum Chemistry').locator('.shelf-meta').first()).toHaveText('300 页');
	await expect(card(page, 'Organic Chemistry').locator('.shelf-state')).toHaveText('翻译 40%');
	// A cover through the Studio's server (the key kept there); none: the title on a card.
	await expect.poll(() => card(page, 'Quantum Chemistry').locator('.shelf-cover img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1);
	await expect(card(page, 'Organic Chemistry').locator('.shelf-cover-title')).toHaveText('Organic Chemistry');

	await page.locator('.shelf-filter', { hasText: '摘过的' }).click();
	await expect(page.locator('.shelf-name')).toHaveText(['Quantum Chemistry']);
	await page.locator('.shelf-filter', { hasText: '翻译中' }).click();
	await expect(page.locator('.shelf-name')).toHaveText(['Organic Chemistry']);
	await page.locator('.shelf-filter', { hasText: '全部' }).click();
	await page.locator('.shelf-search input').fill('quantum');
	await expect(page.locator('.shelf-name')).toHaveText(['Quantum Chemistry']);

	// Pressed again: back to the note.
	await page.locator('#open-library').click();
	await expect(page.locator('#library-view')).toBeHidden();
	await expect(page.locator('.editor-panel')).toBeVisible();
});

test('a book of 书库: clicked, beside the note; its sheet: the passages quoted and their notes, its contents (a heading opens its page), its translation stopped', async ({ page }) => {
	await openStudio(page);
	await connect(page);
	await page.locator('#open-library').click();

	// Its sheet: the passage quoted, in which note; the contents.
	await card(page, 'Quantum Chemistry').hover();
	await card(page, 'Quantum Chemistry').locator('.shelf-more').click();
	const sheet = page.locator('.shelf-sheet');
	await expect(sheet.locator('.shelf-sheet-title')).toHaveText('Quantum Chemistry');
	await expect(sheet.locator('.shelf-note-title')).toContainText('读书摘记');
	await expect(sheet.locator('.shelf-quote')).toContainText('第 12 页变分原理告诉我们，能量有下界。');
	await expect(sheet.locator('.shelf-contents-text')).toHaveText(['第一章 量子力学', '1.1 薛定谔方程']);
	await expect(sheet.locator('.shelf-sheet-book .shelf-meta')).toHaveText('300 页 · 已翻译 300 / 300 页');

	// A heading: the book beside the note being written, at its page.
	await sheet.locator('.shelf-contents button', { hasText: '1.1 薛定谔方程' }).click();
	await expect(page.locator('.editor-panel')).toBeVisible();
	await expect(page.locator('#books-view')).toBeVisible();
	await expect(page.locator('.book-tab-name[aria-selected="true"]')).toHaveText('Quantum Chemistry');
	const reader = page.frameLocator('.book-frame[data-job="job-qc"] iframe');
	await expect.poll(async () => `${await reader.locator('#opened').textContent()} ${await reader.locator('#navigated').textContent()}`).toMatch(/page_idx(=|":)4/u);
	await expect(page.locator('#breadcrumb-title')).toHaveText('Studio 测试夹具');

	// Back on 书库: its sheet as it was left. A passage quoted: its note opened.
	await page.locator('#open-library').click();
	await expect(sheet.locator('.shelf-sheet-title')).toHaveText('Quantum Chemistry');
	await sheet.locator('.shelf-quote').click();
	await expect(page.locator('#breadcrumb-title')).toHaveText('读书摘记');

	// A translation going, stopped (asked first).
	await page.locator('#open-library').click();
	await card(page, 'Organic Chemistry').hover();
	await card(page, 'Organic Chemistry').locator('.shelf-more').click();
	await expect(sheet.locator('.shelf-job-status')).toHaveText('翻译 40%');
	page.once('dialog', (dialog) => void dialog.accept());
	await sheet.locator('.shelf-job-actions button', { hasText: '停下' }).click();
	await expect(sheet.locator('.shelf-job-status')).toHaveText('已取消');
	expect(cancelled).toEqual(['job-oc']);
	await expect(card(page, 'Organic Chemistry').locator('.shelf-state')).toHaveText('已取消');
	await page.keyboard.press('Escape');
	await expect(sheet).toHaveCount(0);

	// The card itself: beside the note.
	await card(page, 'Quantum Chemistry').locator('.shelf-open').click();
	await expect(page.locator('#books-view')).toBeVisible();
	await expect(page.locator('.book-tab-name[aria-selected="true"]')).toHaveText('Quantum Chemistry');
});

test('书库 without RetainPDF connected: says so, and opens its settings', async ({ page }) => {
	await openStudio(page);
	await page.evaluate(async () => fetch('/api/studio/settings/retainpdf', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'http://127.0.0.1:9/', apiUrl: 'http://127.0.0.1:9/', apiKey: 'x' }) }));
	await page.locator('#open-library').click();
	await expect(page.locator('.shelf-empty[role="alert"]')).toContainText('连不上 RetainPDF');
	await page.locator('.shelf-empty button', { hasText: '打开 RetainPDF 设置' }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
});
