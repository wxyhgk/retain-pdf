import assert from 'node:assert/strict';
import test from 'node:test';

import { parseSourceHref } from '../editor/retainpdf-quote.ts';
import { RetainpdfLibrary } from './retainpdf-library.mjs';

const BOOK = {
	document_id: 'doc-1',
	title: 'Quantum Chemistry',
	authors_json: '["Levine"]',
	year: 2013,
	source_filename: 'levine.pdf',
	page_count: 3,
	active_job_id: 'job-old',
	reading_status: 'reading',
	last_opened_at: '2026-11-01T10:00:00Z',
};

const box = (page, text) => ({ page, bbox: [0, 0, 1, 1], unit: 'pdf_point', origin: 'top_left', text });
const REGIONS = [
	{ item_id: 'p001-b0000', source: box(1, 'Chapter 1'), translated: box(1, '第一章'), markdown: null, region_type: 'text', status: 'translated', asset_ids: [], asset_urls: [], sub_type: 'title', heading_level: 1 },
	{ item_id: 'p001-b0001', source: box(1, 'The Schrödinger equation.'), translated: box(1, '薛定谔方程。'), markdown: null, region_type: 'text', status: 'translated', asset_ids: [], asset_urls: [], sub_type: 'body' },
	{ item_id: 'p001-b0002', source: box(1, '1'), translated: box(1, null), markdown: null, region_type: 'text', status: 'skipped', asset_ids: [], asset_urls: [], sub_type: 'page_number' },
	// One paragraph across two pages: each block its own share of the joined translation.
	{ item_id: 'p002-b0000', source: box(2, 'A wave function'), translated: box(2, '波函数描述了粒子的状态'), markdown: null, region_type: 'text', status: 'translated', asset_ids: [], asset_urls: [], sub_type: 'body', continuation_group_id: 'g1', translated_block_text: '波函数描述了' },
	{ item_id: 'p003-b0000', source: box(3, 'describes a state.'), translated: box(3, '波函数描述了粒子的状态'), markdown: null, region_type: 'text', status: 'translated', asset_ids: [], asset_urls: [], sub_type: 'body', continuation_group_id: 'g1', translated_block_text: '粒子的状态' },
];

/** RetainPDF's API as far as it is asked: what was asked kept, and the key it came with. */
function fakeRetainpdf({ key = 'the-key' } = {}) {
	const asked = [];
	const ok = (data) => new Response(JSON.stringify({ code: 0, message: 'ok', data }), { status: 200 });
	const fetch = async (url, init) => {
		const address = new URL(url);
		asked.push(`${address.pathname}${address.search}`);
		if (init?.headers?.['X-API-Key'] !== key) return new Response(JSON.stringify({ code: 40100, message: 'unauthorized', error: { code: 'UNAUTHORIZED', http_status: 401, details: {} } }), { status: 401 });
		const path = address.pathname;
		if (path === '/api/v1/documents') return ok({ documents: [BOOK], total: 1, limit: 30, offset: 0, has_more: false });
		if (path === '/api/v1/documents/doc-1') return ok(BOOK);
		if (path === '/api/v1/documents/doc-1/reading') return ok({ job_id: 'job-1', merged: false, contributing_job_ids: ['job-1'] });
		if (path === '/api/v1/search') return ok({ query: address.searchParams.get('q'), hits: [{ document_id: 'doc-1', job_id: 'job-1', page_idx: 0, block_id: 'p001-b0001', source_snippet: 'The Schrödinger equation.', translated_snippet: '薛定谔方程。' }], limit: 20, has_more: false });
		if (path === '/api/v1/jobs/job-1/reader/regions') return ok({ items: REGIONS });
		if (path === '/api/v1/jobs/job-1/reader/regions/p001-b0001') return ok(REGIONS[1]);
		if (path === '/api/v1/jobs/job-2/reader/regions') return new Response(JSON.stringify({ code: 40400, message: 'reader regions not ready', error: { code: 'NOT_FOUND', http_status: 404, details: { reason: 'not_ready' } } }), { status: 404 });
		return new Response(JSON.stringify({ code: 40400, message: 'not found', error: { code: 'NOT_FOUND', http_status: 404, details: {} } }), { status: 404 });
	};
	return { asked, fetch };
}

const library = ({ api = 'http://127.0.0.1:41000/', key = 'the-key', fetch }) => new RetainpdfLibrary({ settings: { connection: async () => ({ api, key }) }, fetch });

test('the books: their ids, titles, authors, pages, the job last read; asked with the key', async () => {
	const retainpdf = fakeRetainpdf();
	const books = await library(retainpdf).listBooks({ query: 'quantum' });
	assert.deepEqual(books, {
		total: 1,
		more: false,
		books: [{ document_id: 'doc-1', title: 'Quantum Chemistry', authors: ['Levine'], year: 2013, pages: 3, reading_status: 'reading', job_id: 'job-old', last_opened: '2026-11-01T10:00:00Z' }],
	});
	assert.deepEqual(retainpdf.asked, ['/api/v1/documents?q=quantum&limit=30']);
});

test('a search: each place its book and title, page from 1, block and both texts', async () => {
	const found = await library(fakeRetainpdf()).searchBooks({ query: 'Schrödinger', document_id: 'doc-1' });
	assert.deepEqual(found.hits, [{ document_id: 'doc-1', title: 'Quantum Chemistry', job_id: 'job-1', page: 1, block: 'p001-b0001', source: 'The Schrödinger equation.', translated: '薛定谔方程。' }]);
	await assert.rejects(library(fakeRetainpdf()).searchBooks({ query: '  ' }), /要找什么字/u);
});

test('pages of a book, read in the job its reading says: blocks in order, page numbers left out, a joined paragraph each its share', async () => {
	const retainpdf = fakeRetainpdf();
	const books = library(retainpdf);
	const read = await books.readBook({ document_id: 'doc-1', from: 1, to: 2 });
	assert.equal(read.book.job_id, 'job-1');
	assert.equal(read.book.title, 'Quantum Chemistry');
	assert.equal(read.book.pages, 3);
	assert.equal(read.next, 3);
	assert.deepEqual(read.pages, [
		{
			page: 1,
			blocks: [
				{ block: 'p001-b0000', kind: 'title', heading: 1, source: 'Chapter 1', translated: '第一章' },
				{ block: 'p001-b0001', kind: 'body', source: 'The Schrödinger equation.', translated: '薛定谔方程。' },
			],
		},
		{ page: 2, blocks: [{ block: 'p002-b0000', kind: 'body', source: 'A wave function', translated: '波函数描述了' }] },
	]);
	// The next pages from the blocks kept: the book's are not asked for again.
	const rest = await books.readBook({ job_id: 'job-1', from: 3 });
	assert.deepEqual(rest.pages.map((page) => page.page), [3]);
	assert.equal(rest.next, null);
	assert.equal(retainpdf.asked.filter((path) => path.endsWith('/reader/regions')).length, 1);
	await assert.rejects(books.readBook({ job_id: 'job-1', from: 9 }), /只有 3 页/u);
	await assert.rejects(books.readBook({}), /要说是哪本书/u);
	await assert.rejects(books.readBook({ job_id: 'job-2' }), /还没识别完/u);
});

test('a passage comes with the Markdown that quotes it, as 摘到笔记 makes it: its translation after a link to where it is', async () => {
	const passage = await library(fakeRetainpdf()).readPassage({ job_id: 'job-1', block: 'p001-b0001' });
	assert.equal(passage.page, 1);
	assert.equal(passage.source, 'The Schrödinger equation.');
	assert.equal(passage.quote, '[Quantum Chemistry · 第 1 页](retainpdf:job-1/p001-b0001?page=1&document=doc-1) 薛定谔方程。\n');
	assert.deepEqual(parseSourceHref('retainpdf:job-1/p001-b0001?page=1&document=doc-1'), { job: 'job-1', block: 'p001-b0001', page: 1, document: 'doc-1' });
});

test('what goes wrong is said with what to do: RetainPDF not running, the key wrong, the pages served without the API', async () => {
	await assert.rejects(library({ fetch: async () => Promise.reject(new TypeError('fetch failed')) }).listBooks(), /连不上 RetainPDF（http:\/\/127\.0\.0\.1:41000）/u);
	await assert.rejects(library({ ...fakeRetainpdf(), key: 'wrong' }).listBooks(), /不认这个 API 密钥/u);
	const pages = async () => new Response('<!DOCTYPE HTML><p>404</p>', { status: 404 });
	await assert.rejects(library({ api: 'http://127.0.0.1:40001/', fetch: pages }).check(), /40001 上没有 RetainPDF 的接口/u);
	assert.deepEqual(await library(fakeRetainpdf()).check(), { ok: true, books: 1 });
});

test('RetainPDF saying no to the key found before (it started since, or its key changed): found again, asked once more', async () => {
	const { fetch, asked } = fakeRetainpdf();
	let found = 'old-key';
	let forgotten = 0;
	const library = new RetainpdfLibrary({
		fetch,
		settings: {
			connection: async () => ({ api: 'http://127.0.0.1:41000/', key: found }),
			forgetFound() {
				forgotten += 1;
				found = 'the-key';
			},
		},
	});
	assert.equal((await library.listBooks()).books[0].title, 'Quantum Chemistry');
	assert.equal(forgotten, 1);
	assert.equal(asked.length, 2);
	// Still no: said, not asked again and again.
	found = 'wrong';
	const stubborn = new RetainpdfLibrary({ fetch, settings: { connection: async () => ({ api: 'http://127.0.0.1:41000/', key: 'wrong' }), forgetFound() {} } });
	await assert.rejects(stubborn.listBooks(), /不认这个 API 密钥/u);
});
