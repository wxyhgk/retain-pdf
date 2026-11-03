// The open article's library (assets/refs.bib): what its citations are numbered from, and the cite picker's list.
import { t } from '@blog/i18n/index.mjs';
import { BIBLIOGRAPHY_PATH, parseBibtex, type BibEntry } from '@blog/markdown/references/bibtex.mjs';
import { addReference, articleFileUrl } from '../api/client';
import { createCitePicker } from '../shell/dialogs/ask';
import type { Studio } from './studio';

export function createLibrary(studio: Studio) {
	const { session, editor } = studio;

	/** The open article's library, read again when it changes; null when it has none. */
	let library: Map<string, BibEntry> | null = null;
	let librarySlug: string | null = null;
	let libraryRead = 0;
	async function load(slug: string): Promise<void> {
		const reading = ++libraryRead;
		// Another article's library numbers nothing here.
		if (librarySlug !== slug) {
			librarySlug = slug;
			library = null;
			editor.setLibrary(null);
		}
		let next: Map<string, BibEntry> | null = null;
		try {
			const response = await fetch(articleFileUrl(slug, `./${BIBLIOGRAPHY_PATH}`), { cache: 'no-store' });
			if (response.ok) next = parseBibtex(await response.text());
		} catch {
			// Unreadable: as if there were none.
		}
		if (reading !== libraryRead || session.slug !== slug) return;
		library = next;
		editor.setLibrary(library);
	}

	const citePicker = createCitePicker({
		library: () => library,
		async addDoi(doi) {
			const slug = session.slug;
			if (!slug) throw new Error(t('还没有打开页面'));
			const { key } = await addReference(slug, doi);
			await load(slug);
			return key;
		},
	});

	return { load, pick: () => citePicker.pick() };
}
