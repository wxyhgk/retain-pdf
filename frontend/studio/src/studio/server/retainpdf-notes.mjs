import { setFrontmatterRetainpdf } from '@blog/document/frontmatter.ts';
import { t } from '@blog/i18n/index.mjs';
import { autoSlug, freeSlug } from '../pages/page-names.ts';

/** The page the books' notes are under, as first made (renamed by the author, it is still found: `retainpdf.books`). */
const BOOKS_TITLE = '读书笔记'; // i18n-ignore: a page's title, written into the notes

/**
 * RetainPDF's 读书笔记: one page of notes per book, all under one page (made the first time). A book's page says which
 * book it is (`retainpdf: { document, job }`), so it is found again however it is named or moved; the page they are
 * under says so too (`retainpdf: { books: true }`). Asked from 翻译 when the reader asks for its notes (studio-bridge.v1
 * `open-notes`).
 */
export class RetainpdfNotes {
	/** @param {import('./articles/article-repository.mjs').ArticleRepository} articles */
	constructor(articles) {
		this.articles = articles;
		/** One at a time: two asked at once (two clicks) make one page, not two. */
		this.queue = Promise.resolve();
	}

	/**
	 * The page of notes of a book (its id in RetainPDF, the job read; its title for a page made): found by the book's
	 * id, else by the job; made under 读书笔记 when there is none.
	 * @param {{ job_id: unknown, document_id?: unknown, title?: unknown }} book
	 * @returns {Promise<{ slug: string, title: string, created: boolean }>}
	 */
	bookNote(book) {
		const job = typeof book?.job_id === 'string' ? book.job_id.trim() : '';
		if (!job) return Promise.reject(Object.assign(new Error(t('缺少任务编号（job_id）')), { statusCode: 400 }));
		const document = typeof book.document_id === 'string' ? book.document_id.trim() : '';
		const title = (typeof book.title === 'string' ? book.title.replace(/\s+/gu, ' ').trim() : '') || t('无标题的书');
		const done = this.queue.then(() => this.#bookNote(job, document, title));
		this.queue = done.catch(() => {});
		return done;
	}

	async #bookNote(job, document, title) {
		const all = await this.articles.list();
		const found = (document && all.find((page) => page.retainpdf?.document === document)) || all.find((page) => page.retainpdf?.job === job && (!document || !page.retainpdf?.document));
		if (found) {
			// A book's page made from a job before RetainPDF knew the book: the book's id kept from now on.
			if (document && !found.retainpdf.document) await this.#mark(found.slug, { document, job });
			return { slug: found.slug, title: found.title, created: false };
		}
		const books = all.find((page) => page.retainpdf?.books) ?? (await this.#make(all, BOOKS_TITLE, '', { books: true }));
		const made = await this.#make([...all, books], title, books.slug, { ...(document ? { document } : {}), job });
		return { slug: made.slug, title, created: true };
	}

	/** A 维基 page (notes, not a post to publish), starting empty: the quotes and what is written about them go in. */
	async #make(all, title, parent, retainpdf) {
		const slug = freeSlug(autoSlug(), all.map((page) => page.slug));
		await this.articles.create({ slug, title, parent, kind: 'wiki', blank: true });
		await this.#mark(slug, retainpdf);
		return { slug, title };
	}

	async #mark(slug, retainpdf) {
		const { source, revision } = await this.articles.read(slug);
		await this.articles.save(slug, { source: setFrontmatterRetainpdf(source, retainpdf), expectedRevision: revision });
	}
}
