import type { OfficeKind } from './kinds.mjs';

/**
 * Word, PowerPoint and Excel files drawn in the page, by libraries loaded
 * only when one is: docx-preview draws a document as its pages,
 * pptx-preview a deck's slides, SheetJS a workbook's sheets as tables.
 * The Studio and the blog draw them alike (office-viewer.ts, office-card.ts).
 */

type SheetLibrary = typeof import('xlsx');

let sheets: Promise<SheetLibrary> | null = null;
const sheetLibrary = (): Promise<SheetLibrary> => (sheets ??= import('xlsx'));

/** A file's bytes; the server's reason when it has none to give. */
export async function officeBytes(url: string): Promise<ArrayBuffer> {
	const response = await fetch(url, { cache: 'no-cache' });
	if (!response.ok) {
		const reason = ((await response.json().catch(() => null)) as { error?: string } | null)?.error;
		throw new Error(reason ?? (response.status === 404 ? '文件不存在' : `读不到这个文件（${response.status}）`));
	}
	return response.arrayBuffer();
}

/** Links in what was drawn go out in a new tab, and none runs script. */
function safeLinks(root: HTMLElement): void {
	for (const link of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
		const href = link.getAttribute('href') ?? '';
		if (/^\s*(?:javascript|vbscript|data):/iu.test(href)) link.removeAttribute('href');
		else if (!href.startsWith('#')) {
			link.target = '_blank';
			link.rel = 'noopener noreferrer';
		}
	}
}

/** What was drawn: how many pages, slides or sheets, and the sheets' names. */
export type Drawn = { count: number; sheets?: string[]; showSheet?: (name: string) => void };

/** A document's pages, drawn into `into`. */
async function drawDocument(bytes: ArrayBuffer, into: HTMLElement): Promise<Drawn> {
	const { renderAsync } = await import('docx-preview');
	const styles = document.createElement('div');
	const pages = document.createElement('div');
	pages.className = 'office-document';
	into.replaceChildren(styles, pages);
	await renderAsync(bytes, pages, styles, { inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: true, experimental: true, useBase64URL: true });
	safeLinks(pages);
	return { count: pages.querySelectorAll('section.docx').length };
}

/** A deck's slides, `width` wide: one under another, or only the first. */
async function drawSlides(bytes: ArrayBuffer, into: HTMLElement, width: number, all: boolean): Promise<Drawn> {
	const { init } = await import('pptx-preview');
	const deck = document.createElement('div');
	deck.className = 'office-slides';
	into.replaceChildren(deck);
	const viewer = init(deck, { width, height: Math.round((width * 9) / 16), mode: all ? 'list' : 'slide' });
	await viewer.preview(bytes);
	safeLinks(deck);
	return { count: viewer.slideCount };
}

/** A workbook's sheets, one shown at a time: the first, or the one asked for. */
async function drawSheets(bytes: ArrayBuffer, into: HTMLElement, rows?: number): Promise<Drawn> {
	const XLSX = await sheetLibrary();
	const book = XLSX.read(bytes, { type: 'array', sheetRows: rows });
	const showSheet = (name: string) => {
		const table = document.createElement('div');
		table.className = 'office-sheet';
		// SheetJS writes the cells' text escaped.
		table.innerHTML = XLSX.utils.sheet_to_html(book.Sheets[name]!, { header: '', footer: '' });
		into.replaceChildren(table);
	};
	if (book.SheetNames[0]) showSheet(book.SheetNames[0]);
	return { count: book.SheetNames.length, sheets: book.SheetNames, showSheet };
}

/**
 * Draws an office file into `into`: all of it, or only its start (the
 * first page, slide, or rows of the first sheet) for a card.
 */
export function drawOffice(kind: Exclude<OfficeKind, 'old'>, bytes: ArrayBuffer, into: HTMLElement, options: { width: number; start?: boolean }): Promise<Drawn> {
	if (kind === 'document') return drawDocument(bytes, into);
	if (kind === 'slides') return drawSlides(bytes, into, options.width, !options.start);
	return drawSheets(bytes, into, options.start ? 12 : undefined);
}

/** A workbook's first sheet as rows of the text its cells show; rows with nothing in them are left off. */
export async function firstSheetRows(url: string): Promise<string[][]> {
	const XLSX = await sheetLibrary();
	const book = XLSX.read(await officeBytes(url), { type: 'array' });
	const sheet = book.Sheets[book.SheetNames[0] ?? ''];
	if (!sheet) return [];
	const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '', blankrows: false });
	return rows.map((row) => row.map((cell) => String(cell ?? '')));
}
