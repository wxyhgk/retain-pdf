import { t } from '@blog/i18n/index.mjs';
import { quoteMarkdown } from '../editor/retainpdf-quote.ts';

/**
 * RetainPDF's books, read by the AIs (the operations list_books, search_books, read_book, read_passage): its public
 * API, read only (GET), at the address and with the key found from its pages, or set (retainpdf-settings.mjs). What comes
 * back is cut to what an AI needs: a book's id and title, a page's blocks in order, each its id, original and
 * translation; a passage with the Markdown that quotes it in a note (editor/retainpdf-quote.ts: its translation after
 * a link to where it is), so a passage written into a note by an AI is what the reader's 摘到笔记 puts there, opened
 * back in 翻译 the same way.
 *
 * RetainPDF's routes (its docs/api, backend/api/docs/api-spec/reader-read-model.md):
 * - GET /api/v1/documents?q&limit, /api/v1/documents?job_id, /api/v1/documents/:id: the books;
 * - GET /api/v1/documents/:id/reading: which job a book is read in;
 * - GET /api/v1/search?q&limit&document_id: blocks with these words;
 * - GET /api/v1/jobs/:job/reader/regions, …/regions/:item: a job's blocks (pages from 1), one block.
 *
 * And the Studio's 书库 (library/), RetainPDF's books drawn by the Studio itself: the books with their jobs' state
 * (GET /api/v1/jobs?job_ids), a book's cover (…/files/thumbnail.jpg, fetched here: the key stays on this machine), its
 * jobs (GET /documents/:id/jobs), how much is translated (…/translation-coverage), its contents (its blocks' headings,
 * as RetainPDF's reader makes them: reader-find.ts readerOutline); a job cancelled or carried on (POST
 * /jobs/:job/actions/cancel, …/resume): what the author asks there, nothing done by itself.
 */

/** Pages given at once, and characters: a tool's result is kept to 60 000 characters (pi-agent.mjs). */
const PAGES_AT_ONCE = 10;
const CHARACTERS_AT_ONCE = 40_000;
/** A job's blocks kept a while (a whole book's are megabytes): read page after page, they are asked for once. */
const REGIONS_KEPT_MS = 5 * 60_000;
const REGIONS_KEPT = 3;
/** Blocks that are not the book's words. */
const NOT_TEXT = new Set(['page_number', 'header', 'footer', 'page_header', 'page_footer']);

export class RetainpdfLibraryError extends Error {
	constructor(message, statusCode = 400) {
		super(message);
		this.name = 'RetainpdfLibraryError';
		this.statusCode = statusCode;
	}
}

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const count = (value, fallback, most) => {
	const number = Number(value);
	return Number.isInteger(number) && number > 0 ? Math.min(number, most) : fallback;
};

export class RetainpdfLibrary {
	/**
	 * @param {{ settings: { connection(): Promise<{ api: string, key: string }>, forgetFound?(): void }, fetch?: typeof fetch, now?: () => number }} options
	 */
	constructor({ settings, fetch: fetching = globalThis.fetch, now = Date.now }) {
		this.settings = settings;
		this.fetch = fetching;
		this.now = now;
		/** @type {Map<string, { at: number, items: any[] }>} */
		this.regions = new Map();
	}

	/**
	 * GET `path` of RetainPDF's API: its `data`, or an error that says what to do. Its address and key were found from its
	 * pages (retainpdf-settings.mjs): when it said no, or did not answer, they are found again and it is asked once more.
	 */
	async #get(path, query = {}) {
		try {
			return await this.#getOnce(path, query);
		} catch (error) {
			if (!(error instanceof RetainpdfLibraryError) || error.statusCode !== 502 || !this.settings.forgetFound) throw error;
			this.settings.forgetFound();
			return this.#getOnce(path, query);
		}
	}

	async #getOnce(path, query, { method = 'GET', sent } = {}) {
		const { answer, url } = await this.#ask(path, query, { method, body: sent, accept: 'application/json' });
		const body = await answer.json().catch(() => null);
		// Its answers, right or wrong: { code, message, data } or { code, message, error: { code, details: { reason } } }.
		if (!body || typeof body !== 'object' || !('code' in body) || !('message' in body)) {
			// A page, not the API: the address is RetainPDF's pages served alone (its development stack).
			throw new RetainpdfLibraryError(answer.status === 404 && !body ? t('{api} 上没有 RetainPDF 的接口：在 Studio 设置的 RetainPDF 一栏填上接口地址', { api: url.origin }) : t('RetainPDF 没有回答（{status}）', { status: answer.status }), 502);
		}
		if (!answer.ok || body.code !== 0) {
			const reason = text(body.error?.details?.reason);
			if (answer.status === 404) throw new RetainpdfLibraryError(reason === 'not_ready' ? t('这本书还没识别完，读不了') : t('RetainPDF 里没有这个：{what}', { what: path }), 404);
			throw new RetainpdfLibraryError(text(body.message) || t('RetainPDF 没有回答（{status}）', { status: answer.status }), 502);
		}
		return body.data;
	}

	/** RetainPDF asked `path`: its answer as it is (its key sent) and where it was asked, or an error that says what to do. */
	async #ask(path, query = {}, { method = 'GET', body, accept }) {
		const { api, key } = await this.settings.connection();
		const url = new URL(path, api);
		for (const [name, value] of Object.entries(query)) if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value));
		let answer;
		try {
			answer = await this.fetch(url, {
				method,
				headers: { Accept: accept, ...(key ? { 'X-API-Key': key } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
				...(body !== undefined ? { body: JSON.stringify(body) } : {}),
			});
		} catch {
			throw new RetainpdfLibraryError(t('连不上 RetainPDF（{api}）：它开着吗？地址在 Studio 设置的 RetainPDF 一栏', { api: url.origin }), 502);
		}
		if (answer.status === 401 || answer.status === 403) throw new RetainpdfLibraryError(t('RetainPDF 不认这个 API 密钥：在 Studio 设置的 RetainPDF 一栏填上它的密钥'), 502);
		return { answer, url };
	}

	/** Whether RetainPDF answers, and how many books it has: for the settings to show. */
	async check() {
		const data = await this.#get('/api/v1/documents', { limit: 1 });
		return { ok: true, books: Number(data?.total) || 0 };
	}

	/**
	 * The books (those whose title or file name has `query`), the last read first.
	 * @param {{ query?: string, limit?: number }} [asked]
	 */
	async listBooks({ query, limit } = {}) {
		const data = await this.#get('/api/v1/documents', { q: text(query), limit: count(limit, 30, 100) });
		return { total: Number(data?.total) || 0, books: (data?.documents ?? []).map(bookOf), more: Boolean(data?.has_more) };
	}

	/** A book, by its id. */
	async #book(documentId) {
		return bookOf(await this.#get(`/api/v1/documents/${encodeURIComponent(documentId)}`));
	}

	/** The book a job is of (null when RetainPDF does not say). */
	async #bookOfJob(jobId) {
		const data = await this.#get('/api/v1/documents', { job_id: jobId, limit: 1 }).catch(() => null);
		const found = data?.documents?.[0];
		return found ? bookOf(found) : null;
	}

	/**
	 * Which book and job are meant: a book (read in the job its reading says, else its last), or a job (and its book).
	 * @param {{ document_id?: string, job_id?: string }} asked
	 */
	async #which({ document_id: documentId, job_id: jobId }) {
		const job = text(jobId);
		const document = text(documentId);
		if (job) return { job, book: document ? await this.#book(document).catch(() => null) : await this.#bookOfJob(job) };
		if (!document) throw new RetainpdfLibraryError(t('要说是哪本书：document_id（list_books 给的），或者 job_id'));
		const book = await this.#book(document);
		const reading = await this.#get(`/api/v1/documents/${encodeURIComponent(document)}/reading`).catch(() => null);
		const found = text(reading?.job_id) || book.job_id;
		if (!found) throw new RetainpdfLibraryError(t('《{title}》还没有识别过，读不了', { title: book.title }));
		return { job: found, book };
	}

	/**
	 * Blocks with these words, in all the books or one (`document_id`): each its book, page, block and the two texts
	 * around the words.
	 * @param {{ query: string, document_id?: string, limit?: number }} asked
	 */
	async searchBooks({ query, document_id: documentId, limit }) {
		const words = text(query);
		if (!words) throw new RetainpdfLibraryError(t('要找什么字？'));
		const data = await this.#get('/api/v1/search', { q: words, limit: count(limit, 20, 100), document_id: text(documentId) });
		const titles = new Map();
		for (const hit of data?.hits ?? []) {
			if (titles.has(hit.document_id)) continue;
			titles.set(hit.document_id, (await this.#book(hit.document_id).catch(() => null))?.title ?? null);
		}
		return {
			query: words,
			hits: (data?.hits ?? []).map((hit) => ({
				document_id: hit.document_id,
				title: titles.get(hit.document_id) ?? null,
				job_id: hit.job_id,
				page: Number(hit.page_idx) + 1,
				block: hit.block_id,
				source: text(hit.source_snippet) || null,
				translated: text(hit.translated_snippet) || null,
			})),
			more: Boolean(data?.has_more),
		};
	}

	/** A job's blocks, kept a while. */
	async #regions(job) {
		const kept = this.regions.get(job);
		if (kept && this.now() - kept.at < REGIONS_KEPT_MS) return kept.items;
		const data = await this.#get(`/api/v1/jobs/${encodeURIComponent(job)}/reader/regions`);
		const items = Array.isArray(data?.items) ? data.items : [];
		this.regions.delete(job);
		this.regions.set(job, { at: this.now(), items });
		while (this.regions.size > REGIONS_KEPT) this.regions.delete(this.regions.keys().next().value);
		return items;
	}

	/**
	 * Pages of a book, from `from` to `to` (from 1; at most ten, and so many characters, at once: `next` is the page to
	 * go on from): each page's blocks in reading order, each its id, kind, original and translation.
	 * @param {{ document_id?: string, job_id?: string, from?: number, to?: number }} asked
	 */
	async readBook(asked) {
		const { job, book } = await this.#which(asked);
		const items = await this.#regions(job);
		const last = items.reduce((most, item) => Math.max(most, Number(item.source?.page) || 0), 0);
		const from = count(asked.from, 1, Number.MAX_SAFE_INTEGER);
		if (last && from > last) throw new RetainpdfLibraryError(t('这本书只有 {pages} 页', { pages: last }));
		const to = Math.min(count(asked.to, from, Number.MAX_SAFE_INTEGER), from + PAGES_AT_ONCE - 1, last || from);
		const pages = [];
		let size = 0;
		let next = to < last ? to + 1 : null;
		for (let page = from; page <= to; page += 1) {
			const blocks = items.filter((item) => Number(item.source?.page) === page && !NOT_TEXT.has(item.sub_type)).map(blockOf).filter((block) => block.source || block.translated);
			const length = blocks.reduce((sum, block) => sum + (block.source?.length ?? 0) + (block.translated?.length ?? 0), 0);
			if (pages.length && size + length > CHARACTERS_AT_ONCE) {
				next = page;
				break;
			}
			size += length;
			pages.push({ page, blocks });
		}
		return { book: { ...(book ?? {}), job_id: job, pages: last || null }, pages, next };
	}

	/**
	 * One block (a passage): its original and translation, where it is, and the Markdown that quotes it in a note (as
	 * 摘到笔记 does).
	 * @param {{ job_id: string, block: string }} asked
	 */
	async readPassage({ job_id: jobId, block }) {
		const job = text(jobId);
		const id = text(block);
		if (!job || !id) throw new RetainpdfLibraryError(t('要给 job_id 和 block（p001-b0000 这样）'));
		const item = await this.#get(`/api/v1/jobs/${encodeURIComponent(job)}/reader/regions/${encodeURIComponent(id)}`);
		const book = await this.#bookOfJob(job);
		const passage = { ...blockOf(item), page: Number(item?.source?.page) || null };
		const quote = quoteMarkdown({ book: book?.title ?? null, document: book?.document_id ?? null, job, block: passage.block, page: passage.page, source: passage.source, translated: passage.translated });
		return { book: book ? { document_id: book.document_id, title: book.title } : null, job_id: job, ...passage, quote };
	}

	/**
	 * 书库's books, a page of them (`offset`, those whose title has `query`): each as listBooks tells it, with whether it
	 * is translated and its job's state now (queued or running: its stage and how far; failed: why).
	 * @param {{ query?: string, offset?: number }} [asked]
	 */
	async shelf({ query, offset } = {}) {
		const data = await this.#get('/api/v1/documents', { q: text(query), limit: SHELF_PAGE, offset: Number.isInteger(offset) && offset > 0 ? offset : undefined });
		const records = data?.documents ?? [];
		const jobs = [...new Set(records.map((record) => text(record?.active_job_id)).filter(Boolean))];
		const states = new Map();
		if (jobs.length) {
			const listed = await this.#get('/api/v1/jobs', { job_ids: jobs.join(','), limit: jobs.length }).catch(() => null);
			for (const item of listed?.items ?? []) states.set(item.job_id, jobState(item));
		}
		return {
			total: Number(data?.total) || 0,
			books: records.map((record) => {
				const book = bookOf(record);
				return { ...book, translated: record?.has_translation === true, added: record?.added_at || null, job: (book.job_id && states.get(book.job_id)) || null };
			}),
			more: Boolean(data?.has_more),
		};
	}

	/** A book's cover, small (RetainPDF makes it the first time it is asked): its bytes and kind. */
	async cover(documentId) {
		const id = text(documentId);
		if (!/^[0-9a-f]{16,128}$/u.test(id)) throw new RetainpdfLibraryError(t('不认识这本书'), 400);
		const { answer } = await this.#ask(`/api/v1/documents/${id}/files/thumbnail.jpg`, {}, { accept: 'image/*' });
		if (!answer.ok) throw new RetainpdfLibraryError(t('这本书没有封面'), answer.status === 404 ? 404 : 502);
		return { type: answer.headers.get('content-type') || 'image/jpeg', bytes: Buffer.from(await answer.arrayBuffer()) };
	}

	/**
	 * A book in full, for 书库's side sheet: the book, its jobs (the latest first, each its state), how many of its pages
	 * are translated, and its contents (headings of the job it is read in, each its page and block).
	 */
	async bookDetail(documentId) {
		const id = text(documentId);
		if (!id) throw new RetainpdfLibraryError(t('要说是哪本书'));
		const [book, jobs, coverage, reading] = await Promise.all([
			this.#get(`/api/v1/documents/${encodeURIComponent(id)}`),
			this.#get(`/api/v1/documents/${encodeURIComponent(id)}/jobs`, { limit: 20 }).catch(() => null),
			this.#get(`/api/v1/documents/${encodeURIComponent(id)}/translation-coverage`).catch(() => null),
			this.#get(`/api/v1/documents/${encodeURIComponent(id)}/reading`).catch(() => null),
		]);
		const told = bookOf(book);
		const job = text(reading?.job_id) || told.job_id;
		const contents = job ? outlineOf(await this.#regions(job).catch(() => [])) : [];
		return {
			book: { ...told, job_id: job || null, translated: book?.has_translation === true, added: book?.added_at || null },
			jobs: (jobs?.items ?? []).map((item) => ({ job_id: item.job_id, workflow: item.workflow || null, created: item.created_at || null, ...jobState(item) })),
			coverage: coverage ? { pages: Number(coverage.page_count) || 0, translated: Number(coverage.translated_pages) || 0 } : null,
			contents,
		};
	}

	/** A job stopped (`cancel`), or carried on from where it stopped (`resume`): what RetainPDF said. */
	async jobAction(jobId, action) {
		const job = text(jobId);
		if (!job || !['cancel', 'resume'].includes(action)) throw new RetainpdfLibraryError(t('不认识这个操作'));
		const path = `/api/v1/jobs/${encodeURIComponent(job)}/actions/${action}`;
		try {
			await this.#getOnce(path, {}, { method: 'POST', sent: {} });
		} catch (error) {
			if (error instanceof RetainpdfLibraryError && error.statusCode === 404) throw new RetainpdfLibraryError(t('RetainPDF 里没有这个任务'), 404);
			throw error;
		}
		return { ok: true };
	}
}

/** Books listed at once on 书库. */
const SHELF_PAGE = 60;

/** A job as 书库 shows it: its state; going, its stage and how far (a percent, or so many of so many); failed, why. */
function jobState(item) {
	const snapshot = item?.stage_snapshot ?? null;
	const progress = snapshot?.progress ?? null;
	const percent = Number.isFinite(progress?.percent) ? Math.round(progress.percent) : Number(progress?.total) > 0 && Number.isFinite(progress?.current) ? Math.round((progress.current / progress.total) * 100) : null;
	return {
		status: item?.status || null,
		...(snapshot ? { stage: text(snapshot.display_stage) || text(snapshot.stage) || null, percent } : {}),
		...(item?.failure ? { failure: text(item.failure.summary) || null, retryable: item.failure.retryable === true } : {}),
	};
}

/** Formulas as words, as RetainPDF's contents shows them (reader-find.ts plainMath, roughly): `$\mathrm{H}_2$` → H2. */
function plainMath(words) {
	return words
		.replace(/\$([^$]+)\$/gu, (_whole, math) => math.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, '$1').replace(/\\[a-zA-Z]+/gu, '').replace(/[{}^_]/gu, '').trim())
		.replace(/\s+/gu, ' ')
		.trim();
}

/** A job's contents: its headings in reading order (as reader-find.ts readerOutline), each its level (1, 2), words, page and block. */
function outlineOf(items) {
	const entries = [];
	for (const item of items) {
		if (!(item?.heading_level || item?.sub_type === 'title' || item?.sub_type === 'heading')) continue;
		const words = plainMath(text(item.translated_block_text) || text(item.translated?.text) || text(item.source?.text));
		const page = Number(item.source?.page);
		if (!words || !Number.isFinite(page) || page < 1) continue;
		const last = entries[entries.length - 1];
		if (last && last.text === words && last.page === page) continue;
		entries.push({ block: item.item_id, level: item.heading_level > 1 ? 2 : 1, text: words.slice(0, 200), page });
	}
	return entries;
}

/** A book as told: its id, title, authors, year, pages, how far read, the job it was last read in, when. */
function bookOf(record) {
	let authors = [];
	try {
		const parsed = JSON.parse(record?.authors_json || '[]');
		if (Array.isArray(parsed)) authors = parsed.map((author) => (typeof author === 'string' ? author : text(author?.name))).filter(Boolean);
	} catch {
		authors = [];
	}
	return {
		document_id: record?.document_id ?? '',
		title: text(record?.title) || text(record?.source_filename) || null,
		...(authors.length ? { authors } : {}),
		...(record?.year ? { year: record.year } : {}),
		pages: Number(record?.page_count) || null,
		reading_status: record?.reading_status || null,
		job_id: record?.active_job_id || null,
		last_opened: record?.last_opened_at || null,
	};
}

/** A block as told: its id, kind, original and translation (its own share, when a paragraph's translation is joined). */
function blockOf(item) {
	return {
		block: item?.item_id ?? '',
		kind: item?.sub_type || item?.region_type || null,
		...(item?.heading_level ? { heading: item.heading_level } : {}),
		source: text(item?.source?.text) || null,
		translated: text(item?.translated_block_text) || text(item?.translated?.text) || null,
	};
}
