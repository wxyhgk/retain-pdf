import { pageVersion } from '../api/client';

/** Where the picture is kept; StudioPage.astro reads it before anything else loads. */
const STORAGE_KEY = 'studio.snapshot';
/** A picture longer than this is not kept: the browser's storage is a few megabytes in all. */
const MAX_LENGTH = 3_000_000;

export type PageSnapshotHost = {
	/** The open article. */
	slug(): string | null;
	/** Whether what the page shows is what is on disk: nothing typed and not saved, the article in the middle. */
	settled(): boolean;
};

/**
 * The page as the author leaves it, kept in the browser, so the next visit
 * draws it at once instead of an empty page while the editor loads, as
 * Notion does. StudioPage.astro shows it over the page, untouchable, only
 * when the server's mark of the open article (page-version.mjs) is the one
 * kept with it; `ready()` takes it away when the editor has the article.
 */
export function createPageSnapshot(shell: HTMLElement, host: PageSnapshotHost) {
	let known: { slug: string; version: string } | null = null;
	let timer = 0;
	let asked = 0;

	/** Something on the page or on disk changed: asks for the mark again, once things are quiet. */
	function changed(): void {
		known = null;
		window.clearTimeout(timer);
		const slug = host.slug();
		if (!slug) return;
		timer = window.setTimeout(() => {
			const ask = ++asked;
			pageVersion(slug).then(
				(version) => {
					if (ask === asked && host.slug() === slug) known = { slug, version };
				},
				() => {},
			);
		}, 400);
	}

	function keep(): void {
		try {
			const slug = host.slug();
			const html = known && known.slug === slug && host.settled() ? picture(shell) : '';
			if (!html || html.length > MAX_LENGTH) localStorage.removeItem(STORAGE_KEY);
			else localStorage.setItem(STORAGE_KEY, JSON.stringify({ slug, version: known!.version, html }));
		} catch {
			// Storage refused or full: the next visit loads as it did before.
		}
	}

	// A browser driven by tests sees the page as it loads (page-snapshot.spec.ts turns this back on).
	if (!navigator.webdriver) {
		window.addEventListener('pagehide', keep);
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden') keep();
		});
	}

	return {
		changed,
		/** The editor has the article (or could not get it): the page itself from now on. */
		ready(): void {
			shell.dataset.ready = '';
			document.querySelector('.studio-snapshot')?.remove();
		},
	};
}

/** The page's markup with what is typed in its fields, and without what only the live page can run. */
function picture(shell: HTMLElement): string {
	const copy = shell.cloneNode(true) as HTMLElement;
	const fields = 'input, textarea, select';
	const copies = copy.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(fields);
	shell.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(fields).forEach((field, index) => {
		const twin = copies[index];
		if (field instanceof HTMLTextAreaElement) twin.textContent = field.value;
		else if (field instanceof HTMLSelectElement) [...(twin as HTMLSelectElement).options].forEach((option, at) => option.toggleAttribute('selected', at === field.selectedIndex));
		else if (field.type === 'checkbox' || field.type === 'radio') twin.toggleAttribute('checked', field.checked);
		else if (field.type !== 'file' && field.type !== 'password') twin.setAttribute('value', field.value);
	});
	// The sidebar comes back open; frames, the terminal and menus are drawn by the page that runs them.
	copy.classList.remove('sidebar-collapsed', 'is-resizing');
	const embedded = 'iframe, object, embed, video, audio';
	const frames = copy.querySelectorAll<HTMLElement>(embedded);
	shell.querySelectorAll<HTMLElement>(embedded).forEach((live, index) => {
		const room = document.createElement('div');
		room.style.height = `${live.offsetHeight}px`;
		frames[index].replaceWith(room);
	});
	copy.querySelector('#terminal-screen')?.replaceChildren();
	for (const mark of copy.querySelectorAll('.search-flash')) mark.remove();
	for (const shown of copy.querySelectorAll('[data-show="true"]')) shown.setAttribute('data-show', 'false');
	for (const focused of copy.querySelectorAll('.ProseMirror-focused, .ProseMirror-selectednode')) focused.classList.remove('ProseMirror-focused', 'ProseMirror-selectednode');
	return copy.outerHTML;
}
