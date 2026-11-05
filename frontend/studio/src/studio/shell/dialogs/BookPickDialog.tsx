import { useEffect, useRef, useState } from 'react';

import { t } from '@blog/i18n/index.mjs';
import { retainpdfCover } from '../../api/client';
import { Frame } from './Frame';

/** A book of RetainPDF's library, as the books' ＋ offers it. */
export type PickableBook = { job_id: string | null; document_id: string; title: string | null; pages: number | null };

/** Asked which book to open beside the note: `done` hears it, or null when given up. */
export type BookPickAsk = { round: number; books: PickableBook[]; open: string[]; done(book: PickableBook | null): void };

/** A book's cover: its first page (fetched by the Studio's server); its title on a gray card when it has none. */
function Cover({ book }: { book: PickableBook }) {
	const [failed, setFailed] = useState(false);
	return (
		<span className="book-pick-cover">
			{failed ? <span className="book-pick-cover-title">{book.title || t('无标题')}</span> : <img src={retainpdfCover(book.document_id)} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />}
		</span>
	);
}

/**
 * ＋ on the books beside a note: RetainPDF's library as it looks there, a cover each (the author: 是我们的书库里面的书,
 * 而不是一个长条), found by their title as it is typed; one clicked (or ↵ on the first) opens beside the note. Those open
 * already are marked; those not read yet (no job) cannot be opened yet.
 */
export function BookPickDialog({ ask, onClose }: { ask: BookPickAsk; onClose(): void }) {
	const [query, setQuery] = useState('');
	const field = useRef<HTMLInputElement>(null);
	const answer = (book: PickableBook | null) => {
		onClose();
		ask.done(book);
	};
	const words = query.toLocaleLowerCase('zh-CN').split(/\s+/u).filter(Boolean);
	const shown = ask.books.filter((book) => words.every((word) => (book.title ?? '').toLocaleLowerCase('zh-CN').includes(word)));
	const first = shown.find((book) => book.job_id);
	useEffect(() => field.current?.focus(), []);
	return (
		<Frame id="book-pick-dialog" className="sm:max-w-[760px]" title={t('在旁边打开一本书')} description={t('书库里的书；点一本，它在这篇笔记旁边打开。')} focus={() => field.current} onClose={() => answer(null)}>
			<input
				ref={field}
				id="book-pick-input"
				className="book-pick-search"
				type="search"
				value={query}
				placeholder={t('按书名找…')}
				aria-label={t('按书名找')}
				onChange={(event) => setQuery(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === 'Enter' && !event.nativeEvent.isComposing && first) answer(first);
				}}
			/>
			{shown.length ? (
				<ul className="book-pick-grid" aria-label={t('书库里的书')}>
					{shown.map((book) => {
						const open = Boolean(book.job_id && ask.open.includes(book.job_id));
						return (
							<li key={book.document_id}>
								<button type="button" className="book-pick-book" data-document={book.document_id} disabled={!book.job_id} aria-current={open || undefined} title={book.job_id ? (book.title ?? '') : t('这本书还没翻译，暂时不能在旁边打开')} onClick={() => answer(book)}>
									<Cover book={book} />
									<span className="book-pick-name">{book.title || t('无标题')}</span>
									<span className="book-pick-meta">{open ? t('开着') : !book.job_id ? t('还没翻译') : book.pages ? t('{pages} 页', { pages: book.pages }) : ''}</span>
								</button>
							</li>
						);
					})}
				</ul>
			) : (
				<p className="book-pick-empty">{ask.books.length ? t('书库里没有这样的书') : t('RetainPDF 的书库里还没有书')}</p>
			)}
		</Frame>
	);
}
