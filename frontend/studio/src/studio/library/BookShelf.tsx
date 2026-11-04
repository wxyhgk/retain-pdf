import { useEffect, useRef, useState } from 'react';
import { BookOpen, MoreHorizontal, RefreshCw, Search, Upload, X } from 'lucide-react';

import { locale, t } from '@blog/i18n/index.mjs';
import { retainpdfJobAction, shelfBook, shelfBooks, shelfCover, type ShelfBook, type ShelfDetail, type ShelfJob } from '../api/client';
import type { RetainpdfBook } from '../wiring/retainpdf-view';

/** What 书库 needs from the Studio around it. */
export type BookShelfHost = {
	/** A book opened beside the note being written, at a page (from 0) or where it was last read. */
	openBook(book: RetainpdfBook, pageIdx: number | null): void;
	/** A note opened, at the block holding `find` when given. */
	openNote(slug: string, find?: string): void;
	/** The page (from 0) of a job last read in this browser. */
	lastPage(job: string): number | undefined;
	/** A PDF added to RetainPDF to be translated. */
	upload(): void;
	openSettings(): void;
};

/** Which books are shown. */
type Filter = 'all' | 'quoted' | 'going' | 'untranslated';
const FILTERS: Array<[Filter, string]> = [
	['all', t('全部')],
	['quoted', t('摘过的')],
	['going', t('翻译中')],
	['untranslated', t('未翻译')],
];

const DAY = new Intl.DateTimeFormat(locale(), { year: 'numeric', month: 'numeric', day: 'numeric' });

/** How often what is translating is asked again, while 书库 is shown. */
const POLL_MS = 5000;

const going = (job: ShelfJob | null | undefined) => job?.status === 'queued' || job?.status === 'running';

const shown = (book: ShelfBook, filter: Filter) =>
	filter === 'all' || (filter === 'quoted' ? book.quoted.quotes > 0 : filter === 'going' ? going(book.job) : !book.translated && !going(book.job));

/** A job's state in a few words: 排队中, 翻译 63%, 翻译失败… */
function jobWords(job: ShelfJob | null | undefined): string | null {
	if (!job) return null;
	if (job.status === 'queued') return t('排队中');
	if (job.status === 'running') return `${job.stage || t('翻译中')}${typeof job.percent === 'number' ? ` ${job.percent}%` : ''}`;
	if (job.status === 'failed') return t('翻译失败');
	if (job.status === 'canceled') return t('已取消');
	return null;
}

/** What a book's card says under its title: where it was read to, or how many pages; not translated. */
function readWords(book: ShelfBook, host: BookShelfHost): string {
	const page = book.job_id ? host.lastPage(book.job_id) : undefined;
	if (page !== undefined) return book.pages ? t('读到第 {page} / {pages} 页', { page: page + 1, pages: book.pages }) : t('读到第 {page} 页', { page: page + 1 });
	const pages = book.pages ? t('{pages} 页', { pages: book.pages }) : '';
	return book.translated || going(book.job) ? pages : [pages, t('未翻译')].filter(Boolean).join(' · ');
}

const bookOf = (book: { document_id: string; job_id: string | null; title: string | null }): RetainpdfBook | null =>
	book.job_id ? { job_id: book.job_id, document_id: book.document_id, title: book.title } : null;

/** A book's cover: its first page, small (fetched by the Studio's server); its title on a gray card when it has none. */
function Cover({ book }: { book: { document_id: string; title: string | null } }) {
	const [failed, setFailed] = useState(false);
	return (
		<div className="shelf-cover">
			{failed ? <span className="shelf-cover-title">{book.title || t('无标题')}</span> : <img src={shelfCover(book.document_id)} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />}
		</div>
	);
}

/**
 * 书库: RetainPDF's books drawn by the Studio (not RetainPDF's own page): each its cover, how far it was read, what the
 * notes quote of it, its translation going; clicked, opened beside the note being written. ⋯: its sheet at the side —
 * its contents, the passages quoted and the notes they went into, its translations (stopped, carried on).
 */
export function BookShelf({ host, visible }: { host: BookShelfHost; visible: boolean }) {
	const [query, setQuery] = useState('');
	const [filter, setFilter] = useState<Filter>('all');
	const [books, setBooks] = useState<ShelfBook[] | null>(null);
	const [total, setTotal] = useState(0);
	const [more, setMore] = useState(false);
	const [error, setError] = useState('');
	const [sheet, setSheet] = useState<string | null>(null);
	const [round, setRound] = useState(0);
	const asking = useRef<AbortController | null>(null);

	// The books, again as what is typed changes (a moment after), as the page is shown, and as asked (↻, polling).
	useEffect(() => {
		if (!visible) return;
		const asked = new AbortController();
		asking.current?.abort();
		asking.current = asked;
		const timer = window.setTimeout(
			() => {
				shelfBooks(query.trim(), 0, asked.signal)
					.then((listed) => {
						setBooks(listed.books);
						setTotal(listed.total);
						setMore(listed.more);
						setError('');
					})
					.catch((failure: Error) => {
						if (!asked.signal.aborted) setError(failure.message);
					});
			},
			round ? 0 : 200,
		);
		return () => {
			window.clearTimeout(timer);
			asked.abort();
		};
	}, [query, visible, round]);

	// While something translates: asked again now and then.
	const anyGoing = Boolean(books?.some((book) => going(book.job)));
	useEffect(() => {
		if (!visible || !anyGoing) return;
		const timer = window.setInterval(() => setRound((at) => at + 1), POLL_MS);
		return () => window.clearInterval(timer);
	}, [visible, anyGoing]);

	async function loadMore(): Promise<void> {
		if (!books) return;
		try {
			const listed = await shelfBooks(query.trim(), books.length);
			setBooks([...books, ...listed.books.filter((book) => !books.some((kept) => kept.document_id === book.document_id))]);
			setMore(listed.more);
		} catch (failure) {
			setError((failure as Error).message);
		}
	}

	function open(book: ShelfBook): void {
		const opened = bookOf(book);
		if (opened) host.openBook(opened, null);
		else setSheet(book.document_id);
	}

	const listed = (books ?? []).filter((book) => shown(book, filter));
	return (
		<div className={sheet ? 'shelf has-sheet' : 'shelf'}>
			<div className="shelf-main">
				<header className="shelf-bar">
					<h1 className="shelf-title">
						{t('书库')}
						{books ? <span className="shelf-count">{total}</span> : null}
					</h1>
					<label className="shelf-search">
						<Search aria-hidden />
						<input type="search" value={query} placeholder={t('搜索书名…')} aria-label={t('搜索书名')} onChange={(event) => setQuery(event.target.value)} />
					</label>
					<button className="shelf-button" type="button" title={t('重新读取')} aria-label={t('重新读取')} onClick={() => setRound((at) => at + 1)}>
						<RefreshCw aria-hidden />
					</button>
					<button className="shelf-upload" type="button" onClick={host.upload}>
						<Upload aria-hidden />
						{t('上传 PDF')}
					</button>
				</header>
				<nav className="shelf-filters" aria-label={t('筛选')}>
					{FILTERS.map(([key, label]) => (
						<button key={key} type="button" className="shelf-filter" aria-pressed={filter === key} onClick={() => setFilter(key)}>
							{label}
						</button>
					))}
				</nav>
				{error ? (
					<div className="shelf-empty" role="alert">
						<p>{error}</p>
						<button className="shelf-link" type="button" onClick={host.openSettings}>
							{t('打开 RetainPDF 设置')}
						</button>
					</div>
				) : !books ? (
					<p className="shelf-empty">{t('正在读取书库…')}</p>
				) : !listed.length ? (
					<p className="shelf-empty">{query || filter !== 'all' ? t('没有这样的书') : t('书库里还没有书：上传一本 PDF 吧')}</p>
				) : (
					<ul className="shelf-grid" aria-label={t('书')}>
						{listed.map((book) => {
							const state = jobWords(book.job);
							return (
								<li key={book.document_id} className="shelf-card" data-document={book.document_id} aria-current={sheet === book.document_id || undefined}>
									<button className="shelf-open" type="button" title={bookOf(book) ? t('在笔记旁边打开') : t('这本书还没有识别，看看详情')} onClick={() => open(book)}>
										<Cover book={book} />
										{state ? (
											<span className="shelf-state" data-status={book.job?.status ?? ''}>
												{state}
											</span>
										) : null}
										<span className="shelf-name">{book.title || t('无标题')}</span>
										<span className="shelf-meta">{readWords(book, host)}</span>
										{book.quoted.quotes ? <span className="shelf-meta shelf-quoted">{t('摘 {quotes} 段 · {notes} 篇笔记', { quotes: book.quoted.quotes, notes: book.quoted.notes.length })}</span> : null}
									</button>
									<button className="shelf-more" type="button" title={t('详情')} aria-label={t('《{title}》的详情', { title: book.title || t('无标题') })} onClick={() => setSheet(sheet === book.document_id ? null : book.document_id)}>
										<MoreHorizontal aria-hidden />
									</button>
								</li>
							);
						})}
					</ul>
				)}
				{books && more && !error ? (
					<button className="shelf-link shelf-load" type="button" onClick={() => void loadMore()}>
						{t('再多显示一些')}
					</button>
				) : null}
			</div>
			{sheet ? <BookSheet key={sheet} documentId={sheet} host={host} visible={visible} close={() => setSheet(null)} changed={() => setRound((at) => at + 1)} /> : null}
		</div>
	);
}

/** A job's words in the sheet: its state, and why it failed. */
const JOB_STATUS: Record<string, string> = { queued: t('排队中'), running: t('进行中'), succeeded: t('完成'), failed: t('失败'), canceled: t('已取消') };

/** A book's sheet at 书库's side: the book, the passages quoted and their notes, its contents, its translations. */
function BookSheet({ documentId, host, visible, close, changed }: { documentId: string; host: BookShelfHost; visible: boolean; close(): void; changed(): void }) {
	const [detail, setDetail] = useState<ShelfDetail | null>(null);
	const [error, setError] = useState('');
	const [round, setRound] = useState(0);
	const [acting, setActing] = useState('');

	useEffect(() => {
		const asked = new AbortController();
		shelfBook(documentId, asked.signal)
			.then((found) => {
				setDetail(found);
				setError('');
			})
			.catch((failure: Error) => {
				if (!asked.signal.aborted) setError(failure.message);
			});
		return () => asked.abort();
	}, [documentId, round]);
	const anyGoing = Boolean(detail?.jobs.some(going));
	useEffect(() => {
		if (!visible || !anyGoing) return;
		const timer = window.setInterval(() => setRound((at) => at + 1), POLL_MS);
		return () => window.clearInterval(timer);
	}, [visible, anyGoing]);
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && visible) close();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [visible]);

	async function act(job: string, action: 'cancel' | 'resume'): Promise<void> {
		if (action === 'cancel' && !window.confirm(t('停下这个翻译任务？\n已经翻好的页留着，之后可以续跑。'))) return;
		setActing(job);
		try {
			await retainpdfJobAction(job, action);
			setRound((at) => at + 1);
			changed();
		} catch (failure) {
			setError((failure as Error).message);
		} finally {
			setActing('');
		}
	}

	const book = detail?.book;
	const opened = book ? bookOf(book) : null;
	return (
		<aside className="shelf-sheet" aria-label={t('书的详情')}>
			<header className="shelf-sheet-bar">
				<span className="shelf-sheet-heading">{t('详情')}</span>
				<button className="shelf-button" type="button" title={t('关闭')} aria-label={t('关闭')} onClick={close}>
					<X aria-hidden />
				</button>
			</header>
			{error ? <p className="shelf-sheet-error" role="alert">{error}</p> : null}
			{!book ? (
				!error ? <p className="shelf-empty">{t('正在读取…')}</p> : null
			) : (
				<div className="shelf-sheet-body">
					<div className="shelf-sheet-book">
						<Cover book={book} />
						<div>
							<h2 className="shelf-sheet-title">{book.title || t('无标题')}</h2>
							<p className="shelf-meta">
								{[book.pages ? t('{pages} 页', { pages: book.pages }) : '', detail.coverage && detail.coverage.pages ? t('已翻译 {translated} / {pages} 页', detail.coverage) : book.translated ? '' : t('未翻译')].filter(Boolean).join(' · ')}
							</p>
							{opened ? (
								<button className="shelf-primary" type="button" onClick={() => host.openBook(opened, null)}>
									<BookOpen aria-hidden />
									{t('在笔记旁边打开')}
								</button>
							) : null}
						</div>
					</div>

					<section className="shelf-section" aria-label={t('摘录')}>
						<h3>
							{t('摘录')}
							<span className="shelf-count">{detail.quoted.quotes}</span>
						</h3>
						{!detail.quoted.notes.length ? <p className="shelf-hint">{t('还没有从这本书摘过。在笔记旁边打开它，点一段的「摘到笔记」。')}</p> : null}
						{detail.quoted.notes.map((note) => (
							<div key={note.slug} className="shelf-note">
								<button className="shelf-note-title" type="button" onClick={() => host.openNote(note.slug)}>
									{note.icon ? `${note.icon} ` : ''}
									{note.title}
									<span className="shelf-count">{note.quotes.length}</span>
								</button>
								<ul>
									{note.quotes.map((quote, index) => (
										<li key={`${quote.block}:${index}`}>
											<button type="button" className="shelf-quote" title={t('打开这篇笔记，到这一段')} onClick={() => host.openNote(note.slug, quote.text.slice(0, 40) || undefined)}>
												{quote.page ? <span className="shelf-page">{t('第 {page} 页', { page: quote.page })}</span> : null}
												<span className="shelf-quote-text">{quote.text || t('（只有出处）')}</span>
											</button>
										</li>
									))}
								</ul>
							</div>
						))}
					</section>

					{detail.contents.length ? (
						<section className="shelf-section" aria-label={t('目录')}>
							<h3>{t('目录')}</h3>
							<ul className="shelf-contents">
								{detail.contents.map((entry) => (
									<li key={entry.block} data-level={entry.level}>
										<button type="button" disabled={!opened} onClick={() => opened && host.openBook(opened, entry.page - 1)}>
											<span className="shelf-contents-text">{entry.text}</span>
											<span className="shelf-page">{entry.page}</span>
										</button>
									</li>
								))}
							</ul>
						</section>
					) : null}

					<section className="shelf-section" aria-label={t('翻译任务')}>
						<h3>{t('翻译任务')}</h3>
						{!detail.jobs.length ? <p className="shelf-hint">{t('这本书还没有翻译过。')}</p> : null}
						<ul className="shelf-jobs">
							{detail.jobs.map((job) => (
								<li key={job.job_id} data-status={job.status ?? ''}>
									<div className="shelf-job-head">
										<span className="shelf-job-status">{job.status === 'running' ? jobWords(job) : JOB_STATUS[job.status ?? ''] ?? job.status}</span>
										{job.created ? <span className="shelf-page">{DAY.format(new Date(job.created))}</span> : null}
									</div>
									{job.failure ? <p className="shelf-job-failure">{job.failure}</p> : null}
									<div className="shelf-job-actions">
										{going(job) ? (
											<button type="button" className="shelf-link" disabled={acting === job.job_id} onClick={() => void act(job.job_id, 'cancel')}>
												{t('停下')}
											</button>
										) : null}
										{job.status === 'failed' || job.status === 'canceled' ? (
											<button type="button" className="shelf-link" disabled={acting === job.job_id || job.retryable === false} onClick={() => void act(job.job_id, 'resume')}>
												{t('从断点续跑')}
											</button>
										) : null}
									</div>
								</li>
							))}
						</ul>
					</section>
				</div>
			)}
		</aside>
	);
}
