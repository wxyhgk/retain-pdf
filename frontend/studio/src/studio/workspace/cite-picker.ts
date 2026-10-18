import { authorList, plainTex, type BibEntry } from '@blog/markdown/references/bibtex.mjs';

/** What the picker needs from the Studio around it. */
export type CitePickerHost = {
	/** The open article's library, or null when it has none yet. */
	library(): Map<string, BibEntry> | null;
	/** Adds the work with this DOI to the library; its key. */
	addDoi(doi: string): Promise<string>;
};

const DOI = /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?10\.\d{4,9}\/\S+$/iu;

type Row = { key: string; title: string; detail: string } | { doi: string };

/** What an entry is found by: key, authors, title, journal, year. */
function haystack(entry: BibEntry): string {
	const fields = entry.fields;
	return [entry.key, fields.author, fields.editor, fields.title, fields.journal, fields.booktitle, fields.year].map((field) => plainTex(field ?? '')).join(' ').toLocaleLowerCase('zh-CN');
}

/**
 * The work to cite, asked when `[@` is typed: the article's library to pick
 * from by its key, authors, title or year, or a DOI to add to it.
 */
export function createCitePicker(dialog: HTMLDialogElement, host: CitePickerHost) {
	const input = dialog.querySelector<HTMLInputElement>('#cite-input')!;
	const list = dialog.querySelector<HTMLElement>('#cite-results')!;
	const status = dialog.querySelector<HTMLElement>('#cite-status')!;
	let rows: Row[] = [];
	let index = 0;
	let answer: ((key: string | null) => void) | null = null;
	let adding = false;

	function update(): void {
		const query = input.value.trim();
		const wanted = query.toLocaleLowerCase('zh-CN').split(/\s+/u).filter(Boolean);
		const entries = [...(host.library()?.values() ?? [])];
		rows = entries
			.filter((entry) => wanted.every((word) => haystack(entry).includes(word)))
			.map((entry) => ({
				key: entry.key,
				title: plainTex(entry.fields.title) || entry.key,
				detail: [authorList(entry.fields.author ?? entry.fields.editor), plainTex(entry.fields.journal ?? entry.fields.booktitle ?? ''), plainTex(entry.fields.year ?? '')].filter(Boolean).join(' · '),
			}));
		if (DOI.test(query)) rows.unshift({ doi: query });
		index = 0;
		draw();
	}

	function draw(): void {
		list.replaceChildren(...rows.map((row, at) => {
			const item = document.createElement('li');
			item.className = `quick-find-item${at === index ? ' is-selected' : ''}`;
			item.setAttribute('role', 'option');
			item.setAttribute('aria-selected', String(at === index));
			const icon = document.createElement('span');
			icon.className = 'quick-find-icon';
			icon.textContent = 'doi' in row ? '＋' : '❝';
			const words = document.createElement('span');
			words.className = 'quick-find-words';
			const title = document.createElement('span');
			title.className = 'quick-find-title';
			title.textContent = 'doi' in row ? `用 DOI 添加：${row.doi}` : row.title;
			const detail = document.createElement('span');
			detail.className = 'quick-find-snippet';
			detail.textContent = 'doi' in row ? '从 doi.org 取回 BibTeX，加进 assets/refs.bib' : `${row.detail} · @${row.key}`;
			words.append(title, detail);
			item.append(icon, words);
			item.addEventListener('mousemove', () => {
				if (index === at) return;
				index = at;
				draw();
			});
			item.addEventListener('click', () => void choose(at));
			return item;
		}));
		if (!rows.length) {
			const empty = document.createElement('li');
			empty.className = 'quick-find-empty';
			empty.textContent = host.library() ? '没有找到。粘贴一个 DOI 可以添加新文献' : '这篇还没有 assets/refs.bib。粘贴一个 DOI 添加第一篇';
			list.append(empty);
		}
		list.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest' });
	}

	function finish(key: string | null): void {
		const give = answer;
		answer = null;
		if (dialog.open) dialog.close();
		give?.(key);
	}

	async function choose(at: number): Promise<void> {
		const row = rows[at];
		if (!row || adding) return;
		if (!('doi' in row)) {
			finish(row.key);
			return;
		}
		adding = true;
		status.textContent = '正在从 doi.org 取回…';
		try {
			finish(await host.addDoi(row.doi));
		} catch (error) {
			status.textContent = error instanceof Error ? error.message : '没能添加';
		} finally {
			adding = false;
		}
	}

	input.addEventListener('input', update);
	input.addEventListener('keydown', (event) => {
		if (event.isComposing) return;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			if (!rows.length) return;
			index = (index + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
			draw();
		} else if (event.key === 'Enter') {
			event.preventDefault();
			void choose(index);
		}
	});
	// Closed without a choice: nothing cited.
	dialog.addEventListener('close', () => finish(null));
	dialog.addEventListener('click', (event) => {
		if (event.target === dialog) dialog.close();
	});

	return {
		/** Asks which work to cite: its key, or null when given up. */
		pick(): Promise<string | null> {
			if (dialog.open) finish(null);
			return new Promise((resolve) => {
				answer = resolve;
				input.value = '';
				status.textContent = '';
				update();
				dialog.showModal();
				input.focus();
			});
		},
	};
}
