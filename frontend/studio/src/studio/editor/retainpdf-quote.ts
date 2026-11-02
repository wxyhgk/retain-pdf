// A passage of a book in RetainPDF, quoted in a note: its translation (the original when it has none) as the note's own
// paragraphs, written and edited as any others, and before them where it is, as a Markdown link to a `retainpdf:`
// address. The editor draws that link as RetainPDF's mark in the corner of the paragraph (retainpdf-source.ts), which
// asks the Studio (`RETAINPDF_NAVIGATE`, followQuoteOpens) to show the passage in 翻译; the blog, as the book and page.
//
//     [Smart Machine Learning · 第 1 页](retainpdf:20261101112937-ad912a/p001-b0000?page=1&document=…) 译文……
//
// Notes quoted before were a fenced block (```retainpdf, `parseQuote`): the editor reads them as the above.

export const QUOTE_LANGUAGE = 'retainpdf';
export const SOURCE_SCHEME = 'retainpdf:';

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

/** Where a quote's passage is (the link before it): the job, the block, the page from 1, the book's id. */
export type QuoteSource = { job: string; block: string; page: number | null; document: string | null };

const oneLine = (text: string) => text.replace(/\s+/gu, ' ').trim();

/** The link's address: `retainpdf:<job>/<block>?page=12&document=<id>`. */
export function sourceHref(source: QuoteSource): string {
	const query = new URLSearchParams();
	if (source.page) query.set('page', String(source.page));
	if (source.document) query.set('document', source.document);
	const asked = query.toString();
	return `${SOURCE_SCHEME}${encodeURIComponent(source.job)}/${encodeURIComponent(source.block)}${asked ? `?${asked}` : ''}`;
}

/** What a `retainpdf:` address says; null for any other, and one that does not say which job and block. */
export function parseSourceHref(href: string): QuoteSource | null {
	const match = /^retainpdf:([^/?#]+)\/([^/?#]+)(?:\?([^#]*))?$/u.exec(href.trim());
	if (!match) return null;
	try {
		const query = new URLSearchParams(match[3] ?? '');
		const page = Number(query.get('page'));
		return {
			job: decodeURIComponent(match[1]!),
			block: decodeURIComponent(match[2]!),
			page: Number.isInteger(page) && page > 0 ? page : null,
			document: query.get('document') || null,
		};
	} catch {
		return null;
	}
}

/** The link's words: the book and the page, as the blog shows them. */
export function sourceLabel(book: string | null, page: number | null): string {
	const title = book ? oneLine(book) : 'RetainPDF';
	return page ? `${title} · 第 ${page} 页` : title; // i18n-ignore: written into the note
}

/** The link as Markdown: its words escaped where Markdown would read them otherwise. */
export function sourceMarkdown(label: string, href: string): string {
	return `[${oneLine(label).replace(/[\\[\]]/gu, (character) => `\\${character}`)}](${href})`;
}

/** Text whose first line starts a block of its own (a formula, a heading, a list…): the link cannot share its line. */
const BLOCK_START = /^(?:\$\$|#{1,6}\s|>|[-*+]\s|\d+[.)]\s|\||```|~~~|<)/u;

/** The Markdown for `quote`: its translation (the original when it has none) after the link to where it is. */
export function quoteMarkdown(quote: Quote): string {
	const link = sourceMarkdown(sourceLabel(quote.book, quote.page), sourceHref(quote));
	const text = (quote.translated || quote.source || '').replace(/\r\n?/gu, '\n').trim();
	if (!text) return `${link}\n`;
	return BLOCK_START.test(text) ? `${link}\n\n${text}\n` : `${link} ${text}\n`;
}

const SEPARATOR = '---';

/** What a block quoted before says (```retainpdf: its head, the original, the translation), or null when it does not say which job and block. */
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
export function quoteTarget(source: Pick<QuoteSource, 'job' | 'block' | 'page'>): RetainpdfTarget {
	return { job_id: source.job, block_id: source.block, ...(source.page ? { page_idx: source.page - 1 } : {}) };
}

/**
 * A quote's RetainPDF mark pressed, or a `retainpdf:` link (an AI's answer), anywhere on the page: the Studio asked
 * (`RETAINPDF_NAVIGATE`) to show its passage. Taken before the editor takes the press.
 */
export function followQuoteOpens(root: Document = document): void {
	const target = (event: Event): RetainpdfTarget | null => {
		if (!(event.target instanceof Element)) return null;
		const mark = event.target.closest<HTMLElement>('.retainpdf-quote-open');
		if (mark?.dataset.target) {
			try {
				return JSON.parse(mark.dataset.target) as RetainpdfTarget;
			} catch {
				return null;
			}
		}
		const link = event.target.closest<HTMLAnchorElement>(`a[href^="${SOURCE_SCHEME}"]`);
		const source = link ? parseSourceHref(link.getAttribute('href') ?? '') : null;
		return source ? quoteTarget(source) : null;
	};
	root.addEventListener('mousedown', (event) => {
		if (target(event)) event.stopPropagation();
	}, true);
	root.addEventListener('click', (event) => {
		const shown = target(event);
		if (!shown) return;
		event.preventDefault();
		event.stopPropagation();
		window.dispatchEvent(new CustomEvent<RetainpdfTarget>(RETAINPDF_NAVIGATE, { detail: shown }));
	}, true);
}
