// Where the author is in each book RetainPDF shows in 翻译: the page last read (读原书 opens the book there again), and
// the passages quoted from the page read now picked out in its notes (the cards of editor/retainpdf-quote-card.ts).
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

let marking: HTMLStyleElement | null = null;

/**
 * The passages quoted from the page the reader shows, picked out wherever their cards are (a rule of its own, so the
 * cards the editor draws again later are picked out too); none when it shows no page.
 */
export function markReadingPage(reading: RetainpdfReading | null): void {
	marking ??= document.head.appendChild(Object.assign(document.createElement('style'), { id: 'retainpdf-reading-page' }));
	if (!reading || reading.page_idx === null) {
		marking.textContent = '';
		return;
	}
	const page = `[data-page="${reading.page_idx + 1}"]`;
	const books = [`.retainpdf-quote[data-job="${CSS.escape(reading.job_id)}"]${page}`];
	if (reading.document_id) books.push(`.retainpdf-quote[data-document="${CSS.escape(reading.document_id)}"]${page}`);
	marking.textContent = `:is(${books.join(', ')}) { border-color: rgba(var(--black), 0.42); box-shadow: inset 3px 0 0 rgba(var(--black), 0.55); }`;
}
