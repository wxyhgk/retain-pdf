// The notes open, a tab each over the note (as SiYuan's documents: the author, 2026-11-05): a page opened, from the tree,
// ⌘K, a link, comes in as a tab after the one shown, if it is not one already; a tab clicked shows its note again;
// × lets it go (the next one shown when it was the shown one). Kept in this browser; the pages gone are let go.
import { t } from '@blog/i18n/index.mjs';

const KEPT = 'studio.note-tabs';
/** Tabs at most: past them, the one shown least lately goes. */
const MOST = 12;

export type NoteTabsHost = {
	/** A tab's note shown. */
	open(slug: string): void;
};

type Tab = { slug: string; title: string; icon: string; used: number };

function readKept(): Tab[] {
	try {
		const kept = JSON.parse(localStorage.getItem(KEPT) ?? '[]') as Tab[];
		return Array.isArray(kept) ? kept.filter((tab) => typeof tab?.slug === 'string' && tab.slug).map((tab, index) => ({ slug: tab.slug, title: String(tab.title ?? ''), icon: String(tab.icon ?? ''), used: Number(tab.used) || index })) : [];
	} catch {
		return [];
	}
}

export function createNoteTabs(root: HTMLElement, host: NoteTabsHost) {
	root.setAttribute('role', 'tablist');
	root.setAttribute('aria-label', t('打开的笔记'));
	let tabs = readKept();
	let shown: string | null = null;
	let uses = Math.max(0, ...tabs.map((tab) => tab.used));

	function keep(): void {
		try {
			localStorage.setItem(KEPT, JSON.stringify(tabs));
		} catch {
			// Not kept: this visit's only.
		}
	}

	function draw(): void {
		root.replaceChildren(
			...tabs.map((tab) => {
				const item = document.createElement('div');
				item.className = 'note-tab';
				item.dataset.slug = tab.slug;
				const name = document.createElement('button');
				name.type = 'button';
				name.className = 'note-tab-name';
				name.setAttribute('role', 'tab');
				name.setAttribute('aria-selected', String(tab.slug === shown));
				name.textContent = `${tab.icon ? `${tab.icon} ` : ''}${tab.title || t('无标题')}`;
				name.title = tab.title || t('无标题');
				name.addEventListener('click', () => tab.slug !== shown && host.open(tab.slug));
				// The middle button lets it go, as a browser's tab.
				name.addEventListener('auxclick', (event) => {
					if (event.button === 1) close(tab.slug);
				});
				item.append(name);
				// The last one stays: there is always the note shown.
				if (tabs.length > 1) {
					const x = document.createElement('button');
					x.type = 'button';
					x.className = 'note-tab-close';
					x.textContent = '×';
					x.title = t('关掉这个标签');
					x.setAttribute('aria-label', t('关掉《{title}》的标签', { title: tab.title || t('无标题') }));
					x.addEventListener('click', () => close(tab.slug));
					item.append(x);
				}
				return item;
			}),
		);
		root.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}

	function close(slug: string): void {
		const at = tabs.findIndex((tab) => tab.slug === slug);
		if (at < 0 || tabs.length < 2) return;
		tabs.splice(at, 1);
		keep();
		if (slug === shown) host.open(tabs[Math.min(at, tabs.length - 1)]!.slug);
		draw();
	}

	draw();
	return {
		/** The note shown now: its tab put in after the one shown before (if it has none), marked shown. */
		shown(slug: string, title: string, icon = ''): void {
			let tab = tabs.find((each) => each.slug === slug);
			if (!tab) {
				tab = { slug, title, icon, used: 0 };
				const after = tabs.findIndex((each) => each.slug === shown);
				tabs.splice(after < 0 ? tabs.length : after + 1, 0, tab);
			}
			tab.title = title;
			tab.icon = icon;
			tab.used = ++uses;
			shown = slug;
			while (tabs.length > MOST) {
				const least = tabs.filter((each) => each.slug !== shown).sort((a, b) => a.used - b.used)[0];
				tabs = tabs.filter((each) => each !== least);
			}
			keep();
			draw();
		},
		/** A note named anew: its tab too. */
		retitled(slug: string, title: string): void {
			const tab = tabs.find((each) => each.slug === slug);
			if (!tab || tab.title === title) return;
			tab.title = title;
			keep();
			draw();
		},
		/** The pages there are now: the tabs of those gone (moved to the trash, renamed on disk) let go. */
		listed(slugs: string[]): void {
			const there = new Set(slugs);
			const next = tabs.filter((tab) => there.has(tab.slug));
			if (next.length === tabs.length) return;
			tabs = next;
			keep();
			draw();
		},
	};
}
