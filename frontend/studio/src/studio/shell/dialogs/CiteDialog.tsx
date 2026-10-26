import { useState } from 'react';

import { authorList, plainTex, type BibEntry } from '@blog/markdown/references/bibtex.mjs';
import { Finder, type FinderRow } from './Finder';

/** What the picker needs from the Studio around it. */
export type CiteHost = {
	/** The open article's library, or null when it has none yet. */
	library(): Map<string, BibEntry> | null;
	/** Adds the work with this DOI to the library; its key. */
	addDoi(doi: string): Promise<string>;
};

/** Asked which work to cite: `done` hears its key, or null when given up. */
export type CiteAsk = { round: number; host: CiteHost; done(key: string | null): void };

const DOI = /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?10\.\d{4,9}\/\S+$/iu;

/** What an entry is found by: key, authors, title, journal, year. */
function haystack(entry: BibEntry): string {
	const fields = entry.fields;
	return [entry.key, fields.author, fields.editor, fields.title, fields.journal, fields.booktitle, fields.year].map((field) => plainTex(field ?? '')).join(' ').toLocaleLowerCase('zh-CN');
}

/** The works of the library holding every word of `query`; first, a DOI typed, to add. */
function found(library: Map<string, BibEntry> | null, query: string): FinderRow[] {
	const wanted = query.toLocaleLowerCase('zh-CN').split(/\s+/u).filter(Boolean);
	const rows: FinderRow[] = [...(library?.values() ?? [])]
		.filter((entry) => wanted.every((word) => haystack(entry).includes(word)))
		.map((entry) => ({
			key: `@${entry.key}`,
			icon: '❝',
			title: plainTex(entry.fields.title) || entry.key,
			snippet: `${[authorList(entry.fields.author ?? entry.fields.editor), plainTex(entry.fields.journal ?? entry.fields.booktitle ?? ''), plainTex(entry.fields.year ?? '')].filter(Boolean).join(' · ')} · @${entry.key}`,
		}));
	if (DOI.test(query)) rows.unshift({ key: `doi:${query}`, icon: '＋', title: `用 DOI 添加：${query}`, snippet: '从 doi.org 取回 BibTeX，加进 assets/refs.bib' });
	return rows;
}

/** The work to cite, asked when `[@` is typed: the article's library to pick from by its key, authors, title or year, or a DOI to add to it. */
export function CiteDialog({ ask, onClose }: { ask: CiteAsk; onClose(): void }) {
	const library = ask.host.library();
	const [query, setQuery] = useState('');
	const [rows, setRows] = useState(() => found(library, ''));
	const [selected, setSelected] = useState(rows[0]?.key ?? '');
	const [status, setStatus] = useState('');
	const [adding, setAdding] = useState(false);

	function typed(value: string): void {
		setQuery(value);
		const next = found(library, value.trim());
		setRows(next);
		setSelected(next[0]?.key ?? '');
	}

	async function choose(key: string): Promise<void> {
		if (adding) return;
		if (key.startsWith('@')) {
			onClose();
			ask.done(key.slice(1));
			return;
		}
		setAdding(true);
		setStatus('正在从 doi.org 取回…');
		try {
			const added = await ask.host.addDoi(key.slice('doi:'.length));
			onClose();
			ask.done(added);
		} catch (error) {
			setStatus(error instanceof Error ? error.message : '没能添加');
			setAdding(false);
		}
	}

	return (
		<Finder
			id="cite-dialog"
			inputId="cite-input"
			title="引用文献"
			icon="❝"
			placeholder="按作者、题目、年份找，或粘贴 DOI…"
			query={query}
			onQuery={typed}
			rows={rows}
			selected={selected}
			onSelected={setSelected}
			onChoose={(key) => void choose(key)}
			empty={library ? '没有找到。粘贴一个 DOI 可以添加新文献' : '这篇还没有 assets/refs.bib。粘贴一个 DOI 添加第一篇'}
			hint={
				<>
					<span id="cite-status" role="status" aria-live="polite">
						{status}
					</span>{' '}
					<kbd>↵</kbd> 引用 · <kbd>esc</kbd> 关闭
				</>
			}
			onClose={() => {
				onClose();
				ask.done(null);
			}}
		/>
	);
}
