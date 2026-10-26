import { useEffect, useState } from 'react';

import { searchArticles, searchDrive } from '../../api/client';
import type { ArticleSummary } from '../../types';
import { filterArticles } from '../../workspace/article-list';
import { Finder, type FinderRow } from './Finder';

/** What the quick find needs from the Studio around it. */
export type QuickFindHost = {
	/** The articles, to offer before anything is typed and to match titles at once. */
	articles(): ArticleSummary[];
	/** Opens an article; `text` is what was searched for, to show where it is. */
	open(slug: string, text?: string): void;
	/** Shows a file of the drive (资料库) that was found. */
	openDriveFile(path: string): void;
};

/** What was picked when an article was asked for: one there is, or a new page under the open one, of this title. */
export type Picked = { slug: string } | { create: string };

/**
 * ⌘K, as Notion's search (`find`); or asked which article (`pick`: to link, a new one made by its title), or where pages
 * go (`place`: a page's folder name, '' for the top; not `excluded`, the pages moved and those under them). `done` hears
 * what was taken, or null when given up.
 */
export type QuickFindAsk = { round: number; host: QuickFindHost } & (
	| { mode: 'find' }
	| { mode: 'pick'; done(picked: Picked | null): void }
	| { mode: 'place'; excluded: Set<string>; placeholder: string; done(parent: string | null): void }
);

/** An article, a file of the drive (`drivePath`), the row making a page (`create`), or where pages go (`place`). */
type Row = FinderRow & { slug: string; text?: string; drivePath?: string; create?: string; place?: string };

/** The part of a long line around what was found. */
function around(text: string, needle: string): string {
	const found = text.toLocaleLowerCase('zh-CN').indexOf(needle.toLocaleLowerCase('zh-CN'));
	if (found < 40) return text;
	return `…${text.slice(found - 30)}`;
}

const article = (entry: { slug: string; title: string; icon?: string }): Row => ({ key: `a:${entry.slug}`, slug: entry.slug, title: entry.title, icon: entry.icon ?? '' });

/** Titles match as they are typed; the text (and the drive's files) is asked of the server a moment later. */
export function QuickFindDialog({ ask, onClose }: { ask: QuickFindAsk; onClose(): void }) {
	const { host } = ask;

	/** The pages a page is under, as a path: `项目 › 方法`; empty at the top. */
	function pathOf(slug: string): string {
		const bySlug = new Map(host.articles().map((entry) => [entry.slug, entry]));
		const titles: string[] = [];
		const seen = new Set<string>();
		for (let at = bySlug.get(slug)?.parent; at && bySlug.has(at) && !seen.has(at); at = bySlug.get(at)?.parent) {
			seen.add(at);
			titles.unshift(bySlug.get(at)!.title);
		}
		return titles.join(' › ');
	}

	/** What is offered for `query` at once: where pages can go, or the titles (and, asked to link, the page to make). */
	function atOnce(query: string): Row[] {
		if (ask.mode === 'place') {
			const top: Row[] = query ? [] : [{ key: 'p:', slug: '', title: '最上层', icon: '⇱', place: '', snippet: '不放在任何页面下面' }];
			const pages = filterArticles(host.articles(), query).filter((entry) => !ask.excluded.has(entry.slug));
			return [...top, ...pages.map((entry) => ({ ...article(entry), key: `p:${entry.slug}`, place: entry.slug, snippet: pathOf(entry.slug) || undefined }))];
		}
		const found = filterArticles(host.articles(), query).map(article);
		if (ask.mode !== 'pick' || !query || found.some((row) => row.title === query)) return found;
		return [...found, { key: 'c:', slug: '', title: `新建子页面「${query}」`, icon: '＋', create: query }];
	}

	const [query, setQuery] = useState('');
	const [rows, setRows] = useState(() => atOnce(''));
	const [selected, setSelected] = useState(rows[0]?.key ?? '');

	function typed(value: string): void {
		setQuery(value);
		const next = atOnce(value.trim());
		setRows(next);
		setSelected(next[0]?.key ?? '');
	}

	useEffect(() => {
		const wanted = query.trim();
		if (ask.mode === 'place' || !wanted) return;
		const controller = new AbortController();
		const timer = window.setTimeout(() => {
			// The drive's files follow the articles; not offered when an article is asked for.
			const drive = ask.mode === 'pick' ? Promise.resolve(null) : searchDrive(wanted, controller.signal).catch(() => null);
			const articles = searchArticles(wanted, controller.signal).then((results) => {
				if (controller.signal.aborted) return;
				// The titles stay first; each article whose text holds it follows, with the first line it is on; then the page to make.
				setRows((before) => {
					const listed = before.filter((row) => !row.create).map((row) => ({ ...row }));
					const create = before.filter((row) => row.create);
					const seen = new Set(listed.map((row) => row.slug));
					for (const result of results) {
						const line = result.matches[0];
						const existing = listed.find((row) => row.slug === result.slug);
						if (existing && line && !existing.snippet) Object.assign(existing, { snippet: around(line.text, wanted), text: wanted });
						if (seen.has(result.slug)) continue;
						seen.add(result.slug);
						listed.push({ ...article(result), snippet: line ? around(line.text, wanted) : undefined, text: line ? wanted : undefined });
					}
					return [...listed, ...create];
				});
			}, () => {});
			void Promise.all([drive, articles]).then(([found]) => {
				if (!found || controller.signal.aborted) return;
				const files: Row[] = found.results.map((result) => {
					const slash = result.path.lastIndexOf('/');
					return { key: `d:${result.path}`, slug: '', drivePath: result.path, drive: true, title: result.path.slice(slash + 1), icon: '▢', snippet: result.snippet ?? (slash > 0 ? `资料库 / ${result.path.slice(0, slash)}` : '资料库') };
				});
				if (found.indexing) files.push({ key: 'n:indexing', slug: '', title: '资料库还在建立文字索引，结果可能不全', icon: '…' });
				setRows((before) => [...before, ...files]);
			});
		}, 120);
		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [query]);

	function choose(key: string): void {
		const row = rows.find((entry) => entry.key === key);
		if (!row || (!row.slug && !row.drivePath && !row.create && row.place === undefined)) return;
		onClose();
		if (ask.mode === 'place') ask.done(row.place ?? row.slug);
		else if (ask.mode === 'pick') ask.done(row.create ? { create: row.create } : { slug: row.slug });
		else if (row.drivePath) host.openDriveFile(row.drivePath);
		else host.open(row.slug, row.text);
	}

	return (
		<Finder
			id="quick-find-dialog"
			inputId="quick-find-input"
			title="搜索"
			icon="⌕"
			placeholder={ask.mode === 'place' ? ask.placeholder : ask.mode === 'pick' ? '链接到哪篇文章…' : '搜索文章和资料库…'}
			query={query}
			onQuery={typed}
			rows={rows}
			selected={selected}
			onSelected={setSelected}
			onChoose={choose}
			empty={query.trim() ? '没有找到' : '还没有文章'}
			hint={
				<>
					<kbd>↑</kbd>
					<kbd>↓</kbd> 选择 · <kbd>↵</kbd> 打开 · <kbd>esc</kbd> 关闭
				</>
			}
			onClose={() => {
				onClose();
				if (ask.mode !== 'find') ask.done(null);
			}}
		/>
	);
}
