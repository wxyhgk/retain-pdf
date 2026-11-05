import { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown, Plus } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { bookQuotes, type NoteQuotes } from '../api/client';
import type { QuotedPassage } from '../editor/retainpdf-source';
import { useStore, type Store } from '../shell/store';
import type { ArticleSummary } from '../types';

/** The book read in 书库: its job and id, title, the page shown (from 0). */
export type QuoteBook = { job_id: string; document_id: string | null; title: string | null; page_idx: number | null };

export type QuotePanelState = {
	/** Where passages go: the note being written; null when none is open. */
	note: { slug: string; title: string } | null;
	book: QuoteBook | null;
	/** The book's passages in that note, in order. */
	passages: QuotedPassage[];
	/** A passage quoted with no note to go into: which note, asked. */
	asking: boolean;
};

/** What the 摘录 tab needs from the Studio around it (main.ts). */
export type QuotePanelHost = {
	/** The passage shown in the book (its reader goes there). */
	show(passage: QuotedPassage): void;
	/** A line of the author's own put in the note after the passage. */
	write(passage: QuotedPassage, text: string): void;
	/** The note passages go into from now on: this one, or a new one (null). */
	pick(slug: string | null): void;
	/** The pages to pick from, the latest written first. */
	pages(): ArticleSummary[];
	/** The note shown, the book beside it at the page read. */
	openNote(): void;
	/** Another note shown, at the block holding `find`. */
	openOther(slug: string, find?: string): void;
};

const pageWords = (page: number | null) => (page ? t('第 {page} 页', { page }) : '');

/** Picks a note: the latest written first, those whose title has what is typed; or a new one. */
function NotePicker({ host, current, done }: { host: QuotePanelHost; current: string | null; done(): void }) {
	const [typed, setTyped] = useState('');
	const input = useRef<HTMLInputElement>(null);
	useEffect(() => input.current?.focus(), []);
	const needle = typed.trim().toLocaleLowerCase('zh-CN');
	const pages = host
		.pages()
		.filter((page) => page.slug !== current && (!needle || page.title.toLocaleLowerCase('zh-CN').includes(needle)))
		.slice(0, 8);
	const pick = (slug: string | null) => {
		host.pick(slug);
		done();
	};
	return (
		<div className="quotes-picker" onKeyDown={(event) => event.key === 'Escape' && done()}>
			<input ref={input} type="search" value={typed} placeholder={t('找一篇笔记…')} aria-label={t('找一篇笔记')} onChange={(event) => setTyped(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && pages[0] && pick(pages[0].slug)} />
			<ul>
				{pages.map((page) => (
					<li key={page.slug}>
						<button type="button" onClick={() => pick(page.slug)}>
							{page.icon ? `${page.icon} ` : ''}
							{page.title}
						</button>
					</li>
				))}
				<li>
					<button type="button" className="quotes-new" onClick={() => pick(null)}>
						<Plus aria-hidden />
						{t('新建一篇笔记')}
					</button>
				</li>
			</ul>
		</div>
	);
}

/** A passage of the note: where in the book, its first words; clicked, shown in the book; ＋ 写一句 after it. */
function Passage({ passage, current, host }: { passage: QuotedPassage; current: boolean; host: QuotePanelHost }) {
	const [writing, setWriting] = useState(false);
	const [line, setLine] = useState('');
	const write = () => {
		if (line.trim()) host.write(passage, line.trim());
		setLine('');
		setWriting(false);
	};
	return (
		<li className="quotes-passage" data-current={current || undefined}>
			<button type="button" className="quotes-show" title={t('在书里翻到这一段')} onClick={() => host.show(passage)}>
				{passage.page ? <span className="quotes-page">{pageWords(passage.page)}</span> : null}
				<span className="quotes-text">{passage.text || t('（只有出处）')}</span>
			</button>
			{writing ? (
				<textarea
					className="quotes-line"
					autoFocus
					rows={2}
					value={line}
					placeholder={t('写一句，回车放进笔记')}
					aria-label={t('在这段后面写一句')}
					onChange={(event) => setLine(event.target.value)}
					onBlur={write}
					onKeyDown={(event) => {
						if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
							event.preventDefault();
							write();
						} else if (event.key === 'Escape') {
							setLine('');
							setWriting(false);
						}
					}}
				/>
			) : (
				<button type="button" className="quotes-add" onClick={() => setWriting(true)}>
					<Plus aria-hidden />
					{t('写一句')}
				</button>
			)}
		</li>
	);
}

/**
 * 摘录, the right column's tab while a book is read in 书库: which note passages go into (changed here), the book's
 * passages in it (shown in the book when clicked, a line written after one), those in other notes, and back to the note.
 * Nothing kept of its own: what it lists is read from the notes.
 */
export function QuotePanel({ store, host }: { store: Store<QuotePanelState>; host: QuotePanelHost }) {
	const { note, book, passages, asking } = useStore(store);
	const [picking, setPicking] = useState(false);
	const [others, setOthers] = useState<NoteQuotes[]>([]);

	// The other notes' passages of this book, again as the book or the note changes, or a passage comes in.
	useEffect(() => {
		if (!book) return setOthers([]);
		const asked = new AbortController();
		bookQuotes(book, asked.signal)
			.then((found) => setOthers(found.notes.filter((each) => each.slug !== note?.slug)))
			.catch(() => {});
		return () => asked.abort();
	}, [book?.job_id, book?.document_id, note?.slug, passages.length]);

	const page = book?.page_idx == null ? null : book.page_idx + 1;
	const otherCount = others.reduce((sum, each) => sum + each.quotes.length, 0);
	return (
		<div className="quotes">
			<header className="quotes-bar">
				<span className="quotes-to">{t('摘到')}</span>
				<button type="button" className="quotes-note" aria-expanded={picking || asking} onClick={() => setPicking(!picking)}>
					<span>{note ? `《${note.title}》` : t('选一篇笔记')}</span>
					<ChevronDown aria-hidden />
				</button>
			</header>
			{asking ? <p className="quotes-ask">{t('这一段摘到哪篇笔记？')}</p> : null}
			{picking || asking ? <NotePicker host={host} current={note?.slug ?? null} done={() => setPicking(false)} /> : null}

			{!book ? <p className="quotes-empty">{t('在书库里打开一本书读，从它摘下的段落会列在这里。')}</p> : null}
			<div className="quotes-body" hidden={!book}>
				<section aria-label={t('这篇笔记里')}>
					<h3>
						{t('这篇笔记里')}
						<span className="quotes-count">{t('{count} 段', { count: passages.length })}</span>
					</h3>
					{passages.length ? (
						<ul>
							{passages.map((passage) => (
								<Passage key={`${passage.from}:${passage.block}`} passage={passage} current={page !== null && passage.page === page} host={host} />
							))}
						</ul>
					) : (
						<p className="quotes-hint">{t('在书里选中一段，点「摘到笔记」，它会放进这篇笔记，列在这里。')}</p>
					)}
				</section>
				{others.length ? (
					<details className="quotes-others">
						<summary>
							{t('别的笔记里')}
							<span className="quotes-count">{t('{count} 段', { count: otherCount })}</span>
						</summary>
						{others.map((other) => (
							<div key={other.slug} className="quotes-other">
								<button type="button" className="quotes-other-title" onClick={() => host.openOther(other.slug)}>
									{other.icon ? `${other.icon} ` : ''}
									{other.title}
								</button>
								<ul>
									{other.quotes.map((quote, index) => (
										<li key={`${quote.block}:${index}`}>
											<button type="button" className="quotes-show" onClick={() => host.openOther(other.slug, quote.text.slice(0, 40) || undefined)}>
												{quote.page ? <span className="quotes-page">{pageWords(quote.page)}</span> : null}
												<span className="quotes-text">{quote.text || t('（只有出处）')}</span>
											</button>
										</li>
									))}
								</ul>
							</div>
						))}
					</details>
				) : null}
			</div>
			{note && book ? (
				<footer className="quotes-foot">
					<button type="button" className="quotes-open" onClick={host.openNote}>
						<BookOpen aria-hidden />
						{t('打开笔记')}
					</button>
				</footer>
			) : null}
		</div>
	);
}
