// A passage of a book in RetainPDF, quoted in a note (```retainpdf): where it is (the job, the block, the page) and its
// text as it was when quoted, the original and the translation, so the note reads the same without RetainPDF. The
// preview is a card (retainpdf-quote-card.ts); its RetainPDF mark asks the Studio (`RETAINPDF_NAVIGATE`, followQuoteOpens)
// to show the passage in 翻译.
//
//     ```retainpdf
//     book: Smart Machine Learning
//     job: 20261101112937-ad912a
//     block: p001-b0000
//     page: 1
//     ---
//     The original…
//     ---
//     译文……
//     ```

export const QUOTE_LANGUAGE = 'retainpdf';

/** Asked of the Studio when a quote's passage is to be shown (main.ts): `RetainpdfTarget` its detail. */
export const RETAINPDF_NAVIGATE = 'retainpdf-navigate';

/** A passage in RetainPDF: the job, the block (p001-b0000) and the page, from 0 (as its reader's address has it). */
export type RetainpdfTarget = { job_id: string; block_id?: string; page_idx?: number };

export type Quote = {
	/** The book's title; its id (the same across translations of it). */
	book: string | null;
	document: string | null;
	job: string;
	block: string;
	/** The page, from 1, as a reader counts. */
	page: number | null;
	source: string | null;
	translated: string | null;
};

const SEPARATOR = '---';

/** The block for `quote`: fenced with more backticks than its text has in a row. */
export function quoteMarkdown(quote: Quote): string {
	const head = [
		quote.book ? `book: ${oneLine(quote.book)}` : '',
		quote.document ? `document: ${quote.document}` : '',
		`job: ${quote.job}`,
		`block: ${quote.block}`,
		quote.page ? `page: ${quote.page}` : '',
	].filter(Boolean);
	const body = [...head, SEPARATOR, quote.source ?? '', SEPARATOR, quote.translated ?? ''].join('\n').replace(/\n+$/u, '');
	const longest = Math.max(0, ...[...body.matchAll(/`+/gu)].map((run) => run[0].length));
	const fence = '`'.repeat(Math.max(3, longest + 1));
	return `${fence}${QUOTE_LANGUAGE}\n${body}\n${fence}\n`;
}

const oneLine = (text: string) => text.replace(/\s+/gu, ' ').trim();

/** What a block says, or null when it does not say which job and block. */
export function parseQuote(content: string): Quote | null {
	const lines = content.replace(/\r\n?/gu, '\n').split('\n');
	const first = lines.indexOf(SEPARATOR);
	const head = first < 0 ? lines : lines.slice(0, first);
	const fields = new Map<string, string>();
	for (const line of head) {
		const match = /^\s*([a-z]+)\s*:\s*(.*?)\s*$/u.exec(line);
		if (match) fields.set(match[1]!, match[2]!);
	}
	const job = fields.get('job');
	const block = fields.get('block');
	if (!job || !block) return null;
	const rest = first < 0 ? [] : lines.slice(first + 1);
	const second = rest.indexOf(SEPARATOR);
	const text = (part: string[]) => part.join('\n').trim() || null;
	const page = Number(fields.get('page'));
	return {
		book: fields.get('book') || null,
		document: fields.get('document') || null,
		job,
		block,
		page: Number.isInteger(page) && page > 0 ? page : null,
		source: text(second < 0 ? rest : rest.slice(0, second)),
		translated: second < 0 ? null : text(rest.slice(second + 1)),
	};
}

/** Where to show a quote's passage. */
export function quoteTarget(quote: Quote): RetainpdfTarget {
	return { job_id: quote.job, block_id: quote.block, ...(quote.page ? { page_idx: quote.page - 1 } : {}) };
}

/**
 * A card's RetainPDF mark or its book and page pressed, anywhere on the page: the Studio asked (`RETAINPDF_NAVIGATE`) to show its
 * passage. Taken before the code block takes the press as one to edit it.
 */
export function followQuoteOpens(root: Document = document): void {
	const opener = (event: Event) => (event.target instanceof Element ? event.target.closest<HTMLElement>('.retainpdf-quote-open') : null);
	root.addEventListener('mousedown', (event) => {
		if (opener(event)) event.stopPropagation();
	}, true);
	root.addEventListener('click', (event) => {
		const button = opener(event);
		if (!button?.dataset.target) return;
		event.preventDefault();
		event.stopPropagation();
		let target: RetainpdfTarget;
		try {
			target = JSON.parse(button.dataset.target) as RetainpdfTarget;
		} catch {
			return;
		}
		window.dispatchEvent(new CustomEvent<RetainpdfTarget>(RETAINPDF_NAVIGATE, { detail: target }));
	}, true);
}
