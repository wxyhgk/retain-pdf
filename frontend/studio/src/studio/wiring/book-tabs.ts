// 书, beside a note (以笔记为根, docs/ops/planning/studio-workbench/20261102-以笔记为根.md in RetainPDF): the books the note
// quotes, and any opened beside it, each a tab over RetainPDF's reader in a frame of its own (retainpdf-view.ts). A
// book's frame is made the first time its tab is shown and kept, hidden while another is shown, so going back to it,
// or to another note with it, loads nothing again; only the least lately shown are let go past MOST_FRAMES.
import { t } from '@blog/i18n/index.mjs';
import type { RetainpdfTarget } from '../editor/retainpdf-quote';
import { lastPage } from './book-places';
import { BESIDE_NOTE_FEATURES, createRetainpdfView, type RetainpdfBook, type RetainpdfQuote, type RetainpdfReading } from './retainpdf-view';

/** Frames kept at most: each is a whole RetainPDF reader. */
const MOST_FRAMES = 6;

export type BookTabsHost = {
	/** 设置 › RetainPDF, to change the address. */
	openSettings(): void;
	/** A book quoted a passage (摘到笔记): into the note. */
	quote(quote: RetainpdfQuote): void;
	/** A book's AI: the Studio's own. */
	askAi(): void;
	/** What the book shown reads now; null: none shown, or it does not say yet. */
	reading(reading: RetainpdfReading | null): void;
	/** The tabs, or the one shown, changed by the author: kept for the note. */
	changed(books: RetainpdfBook[], shown: string | null): void;
	/** ＋: a book to open beside the note, chosen; null when none was. */
	pick(anchor: HTMLElement): Promise<RetainpdfBook | null>;
};

type Frame = { place: HTMLElement; view: ReturnType<typeof createRetainpdfView>; reading: RetainpdfReading | null; used: number };

export function createBookTabs(pane: HTMLElement, host: BookTabsHost) {
	const bar = document.createElement('div');
	bar.className = 'book-tabs';
	bar.setAttribute('role', 'tablist');
	bar.setAttribute('aria-label', t('这篇笔记的书'));
	const add = document.createElement('button');
	add.type = 'button';
	add.id = 'book-tabs-add';
	add.className = 'book-tabs-add';
	add.textContent = '+';
	add.title = t('在旁边打开一本书');
	add.setAttribute('aria-label', add.title);
	bar.append(add);
	const frames = document.createElement('div');
	frames.className = 'book-frames';
	const empty = document.createElement('p');
	empty.className = 'book-tabs-empty';
	empty.textContent = t('这篇笔记还没有书。点 + 在旁边打开一本；在书里「摘到笔记」，摘的段落就进这篇笔记。');
	frames.append(empty);
	pane.append(bar, frames);

	let books: RetainpdfBook[] = [];
	let shown: string | null = null;
	/** Whether the pane is out: frames are made only for a tab shown while it is. */
	let visible = false;
	const kept = new Map<string, Frame>();
	/** A passage asked for while the pane was put away: shown once its book's frame is. */
	const pending = new Map<string, RetainpdfTarget>();
	let uses = 0;

	function frameOf(book: RetainpdfBook, asked?: RetainpdfTarget): Frame {
		const target = asked ?? pending.get(book.job_id);
		pending.delete(book.job_id);
		let frame = kept.get(book.job_id);
		if (!frame) {
			const place = document.createElement('div');
			place.className = 'book-frame';
			place.dataset.job = book.job_id;
			frames.append(place);
			const job = book.job_id;
			const made: Frame = {
				place,
				reading: null,
				used: 0,
				view: createRetainpdfView(
					place,
					{
						openSettings: () => host.openSettings(),
						quote: (quote) => host.quote(quote),
						askAi: () => host.askAi(),
						// No 笔记 button of its own (BESIDE_NOTE_FEATURES): the note is beside it.
						openNotes: () => {},
						closeNotes: () => {},
						// What it reads (its own book: another, or none, is nothing to tell of this tab).
						reading(said) {
							const reading = said && said.job_id === job ? said : null;
							made.reading = reading;
							if (reading?.title) retitle(job, reading.title);
							if (shown === job) host.reading(reading);
						},
					},
					{ features: BESIDE_NOTE_FEATURES, id: null, pane: 'beside' },
				),
			};
			frame = made;
			kept.set(job, frame);
			void frame.view.navigate(target ?? { job_id: job, page_idx: lastPage(job) ?? 0 });
			letGo();
		} else if (target) {
			void frame.view.navigate(target);
		}
		frame.used = ++uses;
		return frame;
	}

	/** Past MOST_FRAMES, the least lately shown let go (not one of the tabs' shown one). */
	function letGo(): void {
		while (kept.size > MOST_FRAMES) {
			const [job, frame] = [...kept.entries()].filter(([job]) => job !== shown).sort((a, b) => a[1].used - b[1].used)[0] ?? [];
			if (!job || !frame) return;
			frame.place.remove();
			kept.delete(job);
		}
	}

	function retitle(job: string, title: string): void {
		const book = books.find((each) => each.job_id === job);
		if (!book || book.title === title) return;
		book.title = title;
		draw();
		host.changed(books.map((each) => ({ ...each })), shown);
	}

	function draw(): void {
		bar.querySelectorAll('.book-tab').forEach((tab) => tab.remove());
		for (const book of books) {
			const tab = document.createElement('div');
			tab.className = 'book-tab';
			tab.dataset.job = book.job_id;
			const name = document.createElement('button');
			name.type = 'button';
			name.className = 'book-tab-name';
			name.setAttribute('role', 'tab');
			name.setAttribute('aria-selected', String(book.job_id === shown));
			name.textContent = book.title || t('未命名的书');
			name.title = book.title || book.job_id;
			name.addEventListener('click', () => choose(book.job_id));
			const close = document.createElement('button');
			close.type = 'button';
			close.className = 'book-tab-close';
			close.textContent = '×';
			close.title = t('关掉这本书');
			close.setAttribute('aria-label', t('关掉《{title}》', { title: book.title || book.job_id }));
			close.addEventListener('click', () => closeTab(book.job_id));
			tab.append(name, close);
			bar.insertBefore(tab, add);
		}
		empty.hidden = books.length > 0;
		for (const [job, frame] of kept) frame.place.toggleAttribute('data-shown', visible && job === shown);
	}

	/** The tab shown (its frame made if it has none); what it reads told. */
	function showTab(job: string | null, target?: RetainpdfTarget): void {
		shown = job && books.some((book) => book.job_id === job) ? job : (books[0]?.job_id ?? null);
		if (!visible && target && shown === target.job_id) pending.set(shown, target);
		const book = books.find((each) => each.job_id === shown);
		const frame = book && visible ? frameOf(book, target) : null;
		draw();
		host.reading(frame?.reading ?? null);
	}

	function choose(job: string): void {
		if (job === shown) return;
		showTab(job);
		host.changed(books.map((book) => ({ ...book })), shown);
	}

	function closeTab(job: string): void {
		books = books.filter((book) => book.job_id !== job);
		const frame = kept.get(job);
		frame?.place.remove();
		kept.delete(job);
		showTab(shown === job ? (books[0]?.job_id ?? null) : shown);
		host.changed(books.map((book) => ({ ...book })), shown);
	}

	add.addEventListener('click', () => {
		void host.pick(add).then((book) => book && api.open(book));
	});

	const api = {
		/** The note's books (another note shown, or the same again): their tabs, `show` the one shown. */
		setBooks(next: RetainpdfBook[], show: string | null = null): void {
			books = next.map((book) => ({ ...book }));
			showTab(show);
		},
		/** A book opened beside the note (a tab of it made when there is none) and shown, at `target` when given. */
		open(book: RetainpdfBook, target?: RetainpdfTarget): void {
			const known = books.find((each) => each.job_id === book.job_id);
			if (!known) books.push({ ...book });
			else if (!known.title && book.title) known.title = book.title;
			showTab(book.job_id, target);
			host.changed(books.map((each) => ({ ...each })), shown);
		},
		/** The pane out or put away: the tab shown made then (loaded the first time). */
		setVisible(out: boolean): void {
			visible = out;
			showTab(shown);
		},
		books: (): RetainpdfBook[] => books.map((book) => ({ ...book })),
		shown: (): string | null => shown,
		/** What the book shown reads (null: none, or not said yet). */
		reading: (): RetainpdfReading | null => (shown && visible ? (kept.get(shown)?.reading ?? null) : null),
	};
	return api;
}
