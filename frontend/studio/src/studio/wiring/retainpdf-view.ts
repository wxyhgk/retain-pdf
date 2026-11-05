// 翻译 (the left column): RetainPDF's own pages (the books, translating them, reading them) in the middle, in a frame.
// Where they are is a setting (设置 › RetainPDF, server/retainpdf-settings.mjs). Nothing is loaded until the view is
// first shown; the frame stays when another view is shown, so coming back finds it as it was left.
//
// The two talk by postMessage, as RetainPDF's contract studio-bridge.v1 says: its pages are loaded with
// `embed=studio`; each time the frame loads, the Studio says `hello` (light or dark, what it takes) and RetainPDF
// answers `ready` with what it handles. Then `theme` follows the Studio's, `navigate` shows a passage, `notes` says
// whether the book's notes are open beside it; RetainPDF's `quote` (摘到笔记), `open-notes` and `close-notes` (笔记) are
// handed to the Studio, and `reading` (the book and page read, all null when the reader is left), for the AIs to be
// told; `ask-ai` (its reader's AI clicked) opens the Studio's AI instead of RetainPDF's own. Only messages from this frame, from the address set, are taken.
import { t } from '@blog/i18n/index.mjs';
import { retainpdfSettings } from '../api/client';
import type { RetainpdfTarget } from '../editor/retainpdf-quote';

export const BRIDGE_PROTOCOL = 'retainpdf-studio-bridge';

/** RetainPDF's 摘到笔记: a passage, its text as it is now (studio-bridge.v1 `QuoteMessage`). */
export type RetainpdfQuote = {
	job_id: string;
	document_id: string | null;
	title: string | null;
	item_id: string;
	page_idx: number;
	source_text: string | null;
	translated_text: string | null;
};

/** The book whose notes RetainPDF asks for (studio-bridge.v1 `OpenNotesMessage`). */
export type RetainpdfBook = { job_id: string; document_id: string | null; title: string | null };

/** What RetainPDF's reader shows (studio-bridge.v1 `ReadingMessage`): the book, the page (from 0) and how many. */
export type RetainpdfReading = RetainpdfBook & { page_idx: number | null; page_count: number | null };

/** Which of a book's texts its reader shows: the original, the two side by side, the translation. */
export type ReaderMode = 'source' | 'compare' | 'translated';
/**
 * Its reader's controls as it says they are (`reader-state`; the Studio says it takes it, the reader that it takes
 * `reader-command`: the Studio draws them then): the page, the texts it can show and the one shown, its contents or
 * search open, how large, what else it offers (for ⋯); `ready`, false while its PDF is still loading.
 */
export type ReaderState = {
	job_id: string;
	page_idx: number | null;
	page_count: number | null;
	modes: ReaderMode[];
	mode: ReaderMode | null;
	panels: Array<'outline' | 'search'>;
	panel: 'outline' | 'search' | null;
	zoom: { percent: number | null; fit: boolean };
	actions: Array<{ key: string; label: string }>;
	ready: boolean;
};
/** What the Studio asks of the reader whose controls it draws (`reader-command`). */
export type ReaderCommand =
	| { command: 'mode'; mode: ReaderMode }
	| { command: 'page'; page_idx: number }
	| { command: 'panel'; panel: 'outline' | 'search' | null }
	| { command: 'zoom'; zoom: 'in' | 'out' | 'fit' }
	| { command: 'action'; key: string };

const MODES = new Set<string>(['source', 'compare', 'translated']);
/** What its reader said, as far as it says it right: the rest left out. */
function readerStateOf(message: Record<string, unknown>): ReaderState | null {
	if (typeof message.job_id !== 'string' || !message.job_id) return null;
	const whole = (value: unknown, least: number) => (typeof value === 'number' && Number.isInteger(value) && value >= least ? value : null);
	const zoom = (message.zoom ?? {}) as Record<string, unknown>;
	return {
		job_id: message.job_id,
		page_idx: whole(message.page_idx, 0),
		page_count: whole(message.page_count, 1),
		modes: (Array.isArray(message.modes) ? message.modes : []).filter((mode): mode is ReaderMode => MODES.has(mode)),
		mode: MODES.has(message.mode as string) ? (message.mode as ReaderMode) : null,
		panels: (Array.isArray(message.panels) ? message.panels : []).filter((panel): panel is 'outline' | 'search' => panel === 'outline' || panel === 'search'),
		panel: message.panel === 'outline' || message.panel === 'search' ? message.panel : null,
		zoom: { percent: typeof zoom.percent === 'number' && zoom.percent > 0 ? Math.round(zoom.percent) : null, fit: zoom.fit === true },
		actions: (Array.isArray(message.actions) ? message.actions : [])
			.filter((action): action is { key: string; label: string } => typeof action?.key === 'string' && typeof action?.label === 'string' && Boolean(action.key))
			.slice(0, 20)
			.map(({ key, label }) => ({ key, label: label.slice(0, 60) })),
		ready: message.ready !== false,
	};
}

export type RetainpdfViewHost = {
	/** 设置 › RetainPDF, to change the address. */
	openSettings(): void;
	/** RetainPDF quoted a passage (摘到笔记). */
	quote(quote: RetainpdfQuote): void;
	/** RetainPDF's 笔记: the book's notes beside it, or put away. */
	openNotes(book: RetainpdfBook): void;
	closeNotes(): void;
	/** What its reader shows now; null: no book (the reader left, or the frame loaded again). */
	reading(reading: RetainpdfReading | null): void;
	/** Its reader's AI clicked (`ask-ai`): the Studio's AI asked instead, the book and page read told it (`reading`, just before). */
	askAi(): void;
	/**
	 * A book clicked to read in its library (`open-book`, 书库 only): beside the note being written instead (以笔记为根),
	 * at `page_idx` when given, else where it was left.
	 */
	openBook?(book: RetainpdfBook, page_idx: number | null): void;
	/** Its reader's controls as it says they are (`reader-state`), the Studio drawing them; null: it draws its own. */
	readerState?(state: ReaderState | null): void;
};

/** What the Studio takes of RetainPDF's messages (`hello`'s `features`): in 书库, a book to read is given to it (`open-book`). */
const STUDIO_FEATURES = ['quote', 'open-notes', 'ask-ai', 'open-book', 'shortcut'];
/** A book beside a note (book-tabs.ts): its notes are the note beside it, so no 笔记 button of its own. */
/** Its controls drawn by the Studio, one row with the tabs: `reader-state` taken (the reader says it takes `reader-command`). */
export const BESIDE_NOTE_FEATURES = ['quote', 'ask-ai', 'shortcut', 'reader-state'];

/** Whether anything answers at `url`: RetainPDF's pages are another origin, so only that it answered, not what. */
async function answers(url: string): Promise<boolean> {
	try {
		await fetch(url, { mode: 'no-cors', cache: 'no-store' });
		return true;
	} catch {
		return false;
	}
}

/** RetainPDF's page at `url`, told it is in the Studio. */
export function embedded(url: string, search: Record<string, string | number> = {}): string {
	const address = new URL(url);
	for (const [key, value] of Object.entries(search)) address.searchParams.set(key, String(value));
	address.searchParams.set('embed', 'studio');
	return address.href;
}

const theme = (): 'light' | 'dark' => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

const orNull = (value: unknown): value is string | null => value === null || (typeof value === 'string' && value.length > 0);
const isBook = (message: Record<string, unknown>): boolean => typeof message.job_id === 'string' && !!message.job_id && orNull(message.document_id) && (message.title === null || typeof message.title === 'string');

/** A `shortcut` as the contract has it: a key, and which of ⌘ Ctrl ⇧ ⌥ with it. */
const isShortcut = (message: Record<string, unknown>): boolean =>
	typeof message.key === 'string' && !!message.key && ['meta', 'ctrl', 'shift', 'alt'].every((name) => typeof message[name] === 'boolean');

const whole = (value: unknown, least: number): value is number | null => value === null || (Number.isInteger(value) && (value as number) >= least);
/** A `reading` as the contract has it: a book, its page and pages, or all of them null. */
const isReading = (message: Record<string, unknown>): boolean =>
	(message.job_id === null || (isBook(message) && whole(message.page_idx, 0) && whole(message.page_count, 1))) && ['document_id', 'title', 'page_idx', 'page_count'].every((key) => key in message);

const isQuote = (message: Record<string, unknown>): boolean =>
	typeof message.job_id === 'string' && !!message.job_id && typeof message.item_id === 'string' && !!message.item_id && Number.isInteger(message.page_idx) && (message.page_idx as number) >= 0;

export function createRetainpdfView(
	view: HTMLElement,
	host: RetainpdfViewHost,
	{ features: studioFeatures = STUDIO_FEATURES, id = 'retainpdf-frame', pane = '' }: { features?: string[]; id?: string | null; pane?: string } = {},
) {
	/** Its pages told where in the Studio they are (`embed_pane`: a book beside a note has no 关闭 of its own). */
	const atPane: Record<string, string> = pane ? { embed_pane: pane } : {};
	const frame = document.createElement('iframe');
	if (id) frame.id = id;
	frame.title = 'RetainPDF';
	frame.hidden = true;
	const unreachable = document.createElement('div');
	if (id) unreachable.id = 'retainpdf-unreachable';
	unreachable.className = 'translate-unreachable';
	unreachable.setAttribute('role', 'status');
	unreachable.hidden = true;
	view.append(frame, unreachable);
	/** The address set that the frame shows (its pages, wherever in them it went); empty while it shows nothing. */
	let shown = '';
	/** What RetainPDF said it handles, once it answered this load's `hello`; null before. */
	let features: Set<string> | null = null;
	/** Being shown: asked again meanwhile, the same. */
	let showing: Promise<void> | null = null;
	/** Whether the book's notes are open beside it, and which page: told to RetainPDF (`notes`) once it says it takes it. */
	let notesState: { open: boolean; title: string | null } = { open: false, title: null };

	function post(message: Record<string, unknown>): void {
		if (!shown) return;
		frame.contentWindow?.postMessage({ protocol: BRIDGE_PROTOCOL, v: 1, ...message }, new URL(shown).origin);
	}

	frame.addEventListener('load', () => {
		features = null;
		host.reading(null);
		post({ type: 'hello', theme: theme(), features: studioFeatures });
	});
	window.addEventListener('message', (event) => {
		if (!shown || event.source !== frame.contentWindow || event.origin !== new URL(shown).origin) return;
		const message = event.data as Record<string, unknown> | null;
		if (!message || typeof message !== 'object' || message.protocol !== BRIDGE_PROTOCOL || message.v !== 1) return;
		if (message.type === 'ready') {
			features = new Set(Array.isArray(message.features) ? message.features.filter((each): each is string => typeof each === 'string') : []);
			tellNotes();
			tellQuoted();
			// Its own controls, till it says how they are (an older reader never does).
			if (!features.has('reader-command') || !studioFeatures.includes('reader-state')) host.readerState?.(null);
		} else if (!features) {
			return;
		} else if (message.type === 'quote' && isQuote(message)) {
			host.quote(message as unknown as RetainpdfQuote);
		} else if (message.type === 'open-notes' && isBook(message)) {
			host.openNotes({ job_id: message.job_id as string, document_id: message.document_id as string | null, title: message.title as string | null });
		} else if (message.type === 'open-book' && isBook(message) && studioFeatures.includes('open-book') && host.openBook) {
			const page = message.page_idx;
			host.openBook(
				{ job_id: message.job_id as string, document_id: message.document_id as string | null, title: message.title as string | null },
				typeof page === 'number' && Number.isInteger(page) && page >= 0 ? page : null,
			);
		} else if (message.type === 'shortcut' && isShortcut(message)) {
			// A key of the Studio's pressed while the book had the keys (⌘K, ⌘S, ⌘J, ⌘\): as if pressed here.
			frame.ownerDocument.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: message.key as string,
					metaKey: message.meta as boolean,
					ctrlKey: message.ctrl as boolean,
					shiftKey: message.shift as boolean,
					altKey: message.alt as boolean,
					bubbles: true,
					cancelable: true,
				}),
			);
		} else if (message.type === 'close-notes') {
			host.closeNotes();
		} else if (message.type === 'ask-ai') {
			host.askAi();
		} else if (message.type === 'reader-state' && features.has('reader-command') && studioFeatures.includes('reader-state')) {
			const state = readerStateOf(message);
			if (state) host.readerState?.(state);
		} else if (message.type === 'reading' && isReading(message)) {
			host.reading(
				message.job_id === null
					? null
					: { job_id: message.job_id as string, document_id: message.document_id as string | null, title: message.title as string | null, page_idx: message.page_idx as number | null, page_count: message.page_count as number | null },
			);
		}
	});
	window.addEventListener('themechange', () => {
		if (features?.has('theme')) post({ type: 'theme', theme: theme() });
	});

	function tellNotes(): void {
		if (features?.has('notes')) post({ type: 'notes', ...notesState });
	}

	/** Which passages of a book the note quotes (its blocks, all of them each time), for its reader to mark them. */
	let quotedState: { job_id: string; document_id: string | null; item_ids: string[] } | null = null;
	function tellQuoted(): void {
		if (quotedState && features?.has('quoted')) post({ type: 'quoted', ...quotedState });
	}
	/** The passages of `book` the note quotes now (its blocks), told RetainPDF when it marks them (ready's `quoted`). */
	function quoted(book: { job_id: string; document_id: string | null }, itemIds: string[]): void {
		const next = { job_id: book.job_id, document_id: book.document_id, item_ids: [...new Set(itemIds)] };
		if (JSON.stringify(next) === JSON.stringify(quotedState)) return;
		quotedState = next;
		tellQuoted();
	}

	/** The book's notes opened beside RetainPDF (with the page's title), or put away: RetainPDF told. */
	function notes(open: boolean, title: string | null = null): void {
		notesState = { open, title: open ? title : null };
		tellNotes();
	}

	function cannot(text: string, url: string): void {
		shown = '';
		features = null;
		host.reading(null);
		frame.hidden = true;
		frame.removeAttribute('src');
		const line = document.createElement('p');
		line.textContent = text;
		const address = document.createElement('code');
		address.textContent = url;
		const buttons = document.createElement('div');
		const retry = document.createElement('button');
		retry.type = 'button';
		retry.textContent = t('重试');
		retry.addEventListener('click', () => void show());
		const change = document.createElement('button');
		change.type = 'button';
		change.textContent = t('改地址');
		change.addEventListener('click', () => host.openSettings());
		buttons.className = 'translate-unreachable-actions';
		buttons.append(retry, change);
		unreachable.replaceChildren(line, address, buttons);
		unreachable.hidden = false;
	}

	/**
	 * Shown (again): the pages at the address set, loaded when it changed or nothing is shown yet; `first`, the page of
	 * them to load then (a book's reader, rather than the books).
	 */
	function show(first?: { page: string; search: Record<string, string | number> }): Promise<void> {
		showing ??= (async () => {
			let url: string;
			try {
				url = (await retainpdfSettings()).url;
			} catch (error) {
				cannot(t('读不到 RetainPDF 的地址：{error}', { error: error instanceof Error ? error.message : String(error) }), '');
				return;
			}
			if (url === shown) return;
			if (!(await answers(url))) {
				cannot(t('连不上 RetainPDF：先打开 RetainPDF，或者改一下它的地址'), url);
				return;
			}
			unreachable.hidden = true;
			frame.hidden = false;
			shown = url;
			features = null;
			frame.src = first ? embedded(new URL(first.page, url).href, { ...first.search, ...atPane }) : embedded(url, atPane);
		})().finally(() => {
			showing = null;
		});
		return showing;
	}

	/**
	 * A passage shown: told to RetainPDF when it handles `navigate`, else its reader opened there (the address it has
	 * always taken, so a RetainPDF without the bridge goes there too).
	 */
	async function navigate(target: RetainpdfTarget): Promise<void> {
		const search: Record<string, string | number> = { job_id: target.job_id };
		if (target.page_idx !== undefined) search.page_idx = target.page_idx;
		if (target.block_id) search.block_id = target.block_id;
		// Nothing shown yet: the reader there straight away, not the books first.
		if (!shown && !showing) {
			await show({ page: 'reader.html', search });
			return;
		}
		await show();
		if (!shown) return;
		if (features?.has('navigate')) {
			post({ type: 'navigate', ...target });
			return;
		}
		frame.src = embedded(new URL('reader.html', shown).href, { ...search, ...atPane });
	}

	/** Asked of a reader whose controls the Studio draws; nothing of one that draws its own. */
	function command(asked: ReaderCommand): void {
		if (features?.has('reader-command') && studioFeatures.includes('reader-state')) post({ type: 'reader-command', ...asked });
	}

	return { show, navigate, notes, quoted, command };
}
