import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, FileText, Maximize2, X } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { drawAiMarkdownNear } from '../../ai/ai-markdown';
import { TYPE_ICONS } from './database-parts';
import { Cell } from './DatabaseTable';
import type { Row } from './database-config';
import type { Database } from './DatabaseView';

/**
 * A row opened beside the table (as Notion's side peek), the table still there: its title, typed in place; each of
 * the database's columns and its value, changed as in the table; its text as the page shows it. ↑↓ the rows before and
 * after it, ⤢ its whole page (where its text is written), × or Esc closed.
 */
export function DatabasePeek({ database, rows, slug }: { database: Database; rows: Row[]; slug: string }) {
	const { config, host } = database;
	const row = rows.find((each) => each.slug === slug) ?? database.rows?.find((each) => each.slug === slug) ?? null;
	const at = rows.findIndex((each) => each.slug === slug);
	const columns = config.columns.filter((column) => !column.hidden);
	const [body, setBody] = useState<string | null>(null);
	const [title, setTitle] = useState(row?.title ?? '');
	const text = useRef<HTMLDivElement>(null);

	useEffect(() => setTitle(row?.title ?? ''), [slug, row?.title]);
	useEffect(() => {
		let current = true;
		setBody(null);
		host.rowBody(slug).then(
			(markdown) => current && setBody(markdown),
			() => current && setBody(''),
		);
		return () => {
			current = false;
		};
	}, [slug]);
	// Its text drawn as the page shows it, its formulas as they come near (a paper's worth laid out at once held WebKit
	// for seconds), its pictures from its own folder; a very long one, its beginning (the rest in its page).
	const cut = useMemo(() => (body === null ? null : beginning(body)), [body]);
	useEffect(() => {
		const into = text.current;
		if (!into || cut === null) return;
		into.replaceChildren();
		drawAiMarkdownNear(cut.text, into, { picture: (src) => (/^(?:[a-z][\w+.-]*:|\/)/iu.test(src) ? src : host.fileUrl(slug, src)) });
	}, [cut?.text, slug]);
	// Esc (not taken by what is typed in it, a picker): closed.
	useEffect(() => {
		const away = (event: KeyboardEvent) => event.key === 'Escape' && !event.defaultPrevented && database.closePeek();
		document.addEventListener('keydown', away);
		return () => document.removeEventListener('keydown', away);
	}, []);

	if (!row) return null;
	const go = (step: number) => {
		const next = rows[at + step];
		if (next) database.openRow(next.slug);
	};
	const commitTitle = () => title.trim() !== row.title && void database.setTitle(row, title.trim());
	return createPortal(
		<div className="db db-peek" data-ui="" role="dialog" aria-label={row.title || t('无标题')} data-database-peek={slug}>
			<div className="db-peek-bar">
				<button type="button" className="db-icon-button" aria-label={t('上一行')} disabled={at <= 0} onClick={() => go(-1)} data-database-peek-prev>
					<ChevronUp aria-hidden />
				</button>
				<button type="button" className="db-icon-button" aria-label={t('下一行')} disabled={at < 0 || at >= rows.length - 1} onClick={() => go(1)} data-database-peek-next>
					<ChevronDown aria-hidden />
				</button>
				<span className="db-grow" />
				<button
					type="button"
					className="db-icon-button is-wide"
					onClick={() => {
						database.closePeek();
						host.open(slug);
					}}
					data-database-peek-page
				>
					<Maximize2 aria-hidden />
					{t('整页打开')}
				</button>
				<button type="button" className="db-icon-button" aria-label={t('关闭')} onClick={() => database.closePeek()} data-database-peek-close>
					<X aria-hidden />
				</button>
			</div>
			<div className="db-peek-scroll">
				<div className="db-peek-icon" aria-hidden>
					{row.icon || <FileText />}
				</div>
				<input
					className="db-peek-title"
					value={title}
					placeholder={t('无标题')}
					data-database-peek-title
					onChange={(event) => setTitle(event.target.value)}
					onBlur={commitTitle}
					onKeyDown={(event) => {
						if (event.nativeEvent.isComposing) return;
						if (event.key === 'Enter') event.currentTarget.blur();
						else if (event.key === 'Escape') {
							event.preventDefault();
							setTitle(row.title);
							event.currentTarget.blur();
						}
					}}
				/>
				<div className="db-peek-props">
					{columns.map((column) => {
						const Icon = TYPE_ICONS[column.type];
						return (
							<div key={column.name} className="db-peek-prop" data-column={column.name}>
								<span className="db-peek-name">
									<Icon aria-hidden />
									{column.name}
								</span>
								<div className="db-peek-value">
									<Cell row={row} column={column} database={database} />
								</div>
							</div>
						);
					})}
				</div>
				<div className="db-peek-text-head">
					<span>{t('正文')}</span>
					<button
						type="button"
						className="db-peek-edit"
						onClick={() => {
							database.closePeek();
							host.open(slug);
						}}
					>
						{t('在整页里写')}
					</button>
				</div>
				{body === null ? <p className="db-note">{t('正在读…')}</p> : body.trim() ? <div ref={text} className="db-peek-text ai-markdown" data-database-peek-text /> : <p className="db-note">{t('还没有正文')}</p>}
				{cut?.more && (
					<button
						type="button"
						className="db-peek-edit db-peek-more"
						data-database-peek-more
						onClick={() => {
							database.closePeek();
							host.open(slug);
						}}
					>
						{t('后面还有，整页打开看全文')}
					</button>
				)}
			</div>
		</div>,
		document.body,
	);
}

/** How much of a row's text is shown beside its table: a book's worth (an OCR'd one) is read in its page. */
const PEEK_TEXT = 60_000;

/** A very long text's beginning, cut where a paragraph ends (not inside a code block or a formula), and whether more follows. */
function beginning(body: string): { text: string; more: boolean } {
	if (body.length <= PEEK_TEXT) return { text: body, more: false };
	let end = body.lastIndexOf('\n\n', PEEK_TEXT);
	// Inside a fence (```, $$: an odd number of them before): cut before the one it is in.
	while (end > 0) {
		const before = body.slice(0, end);
		const fences = (before.match(/^\s{0,3}(?:```|~~~)/gmu) ?? []).length;
		const formulas = (before.match(/^\s*\$\$\s*$/gmu) ?? []).length;
		if (fences % 2 === 0 && formulas % 2 === 0) break;
		end = body.lastIndexOf('\n\n', end - 1);
	}
	return { text: end > 0 ? body.slice(0, end) : body.slice(0, PEEK_TEXT), more: true };
}
