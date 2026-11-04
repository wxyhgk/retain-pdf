/**
 * What the author is reading in 翻译, as the page last said (PUT /api/studio/retainpdf/reading): the book, the page,
 * its page of notes. Told the AIs (agent-sessions.mjs's context; the operation reading_now), so that 「这一页讲了什么」
 * is of the page in front of the author. Kept in the server's memory only: gone with it, and when the page says
 * the reader is left (null).
 *
 * The page knows it from RetainPDF (studio-bridge.v1 `reading`: the job, the book, the page) and from the notes it opened
 * for a book (`open-notes`); a RetainPDF before `reading` tells nothing until its notes are opened.
 */
export class RetainpdfReading {
	constructor({ clock = Date.now } = {}) {
		this.clock = clock;
		/** @type {null | { job_id: string, document_id: string | null, title: string | null, page: number | null, pages: number | null, notes: { slug: string, title: string } | null, others: Array<{ job_id: string, document_id: string | null, title: string | null }>, at: number }} */
		this.current = null;
	}

	/** What was said; null or no job: nothing read. */
	set(said) {
		const job = typeof said?.job_id === 'string' ? said.job_id.trim() : '';
		if (!job) {
			this.current = null;
			return null;
		}
		const words = (value) => (typeof value === 'string' && value.trim() ? value.replace(/\s+/gu, ' ').trim().slice(0, 300) : null);
		const whole = (value, least) => (Number.isInteger(value) && value >= least ? value : null);
		const notes = said.notes && typeof said.notes.slug === 'string' && said.notes.slug ? { slug: said.notes.slug, title: words(said.notes.title) ?? said.notes.slug } : null;
		// The other books open beside the note (its tabs), not the one shown: a few, each its job, id and title.
		const others = (Array.isArray(said.others) ? said.others : [])
			.filter((book) => typeof book?.job_id === 'string' && book.job_id.trim() && book.job_id !== job)
			.slice(0, 8)
			.map((book) => ({ job_id: book.job_id.trim(), document_id: words(book.document_id), title: words(book.title) }));
		this.current = { job_id: job, document_id: words(said.document_id), title: words(said.title), page: whole(said.page, 1), pages: whole(said.pages, 1), notes, others, at: this.clock() };
		return this.current;
	}

	/** What is read now (null: nothing). */
	get() {
		return this.current;
	}
}
