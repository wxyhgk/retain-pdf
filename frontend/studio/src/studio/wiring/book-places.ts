// Where the author is in each book RetainPDF shows in 翻译: the page last read (读原书 opens the book there again), and
// the passages quoted from the page read now picked out in its notes (their marks: editor/retainpdf-source.ts).
import type { RetainpdfReading } from './retainpdf-view';

/** The page (from 0) last read of each job, the latest last; kept in the browser, as the notes' width is. */
const PAGES_KEY = 'retainpdf-last-pages';
const KEPT = 100;

function readPages(): Array<[string, number]> {
	try {
		const kept: unknown = JSON.parse(localStorage.getItem(PAGES_KEY) ?? '[]');
		return Array.isArray(kept) ? kept.filter((entry): entry is [string, number] => Array.isArray(entry) && typeof entry[0] === 'string' && Number.isInteger(entry[1]) && entry[1] >= 0) : [];
	} catch {
		return [];
	}
}

/** The page of a job the reader showed last. */
export function rememberPage(job: string, pageIdx: number): void {
	const pages = readPages().filter(([kept]) => kept !== job);
	pages.push([job, pageIdx]);
	try {
		localStorage.setItem(PAGES_KEY, JSON.stringify(pages.slice(-KEPT)));
	} catch {
		// Not kept (storage off): the book opens at its start.
	}
}

/** The page of a job last read; undefined for one not read here. */
export function lastPage(job: string): number | undefined {
	return readPages().find(([kept]) => kept === job)?.[1];
}

/** The page read now: its job, book and page (from 1); null when none is. */
let readingNow: { job: string; document: string | null; page: number } | null = null;
/** Said last, not marked again. */
let markedFor = 'null';

/** Whether a mark (editor/retainpdf-source.ts: its job, book, page) is of the page read now. */
export function isReadingSpot(job: string, document: string | undefined, page: string | undefined): boolean {
	if (!readingNow || page !== String(readingNow.page)) return false;
	return job === readingNow.job || (Boolean(readingNow.document) && document === readingNow.document);
}

/**
 * The passages quoted from the page the reader shows, picked out: their marks given `is-reading` (the paragraph tinted
 * by the page's CSS, studio-page.css); a mark drawn later asks isReadingSpot. As SiYuan marks what it shows, a class on the
 * element: once a page's stylesheet was written again each time the reader spoke, and the whole page's style was worked
 * out again (with a :has() over every paragraph), up to a second and more with two books open; now nothing changes while
 * the page is the same, and only the marks when it is not.
 */
export function markReadingPage(reading: RetainpdfReading | null): void {
	readingNow = reading && reading.page_idx !== null ? { job: reading.job_id, document: reading.document_id, page: reading.page_idx + 1 } : null;
	const said = JSON.stringify(readingNow);
	if (said === markedFor) return;
	markedFor = said;
	for (const mark of document.querySelectorAll<HTMLElement>('.retainpdf-source')) {
		mark.classList.toggle('is-reading', isReadingSpot(mark.dataset.job ?? '', mark.dataset.document, mark.dataset.page));
	}
}
