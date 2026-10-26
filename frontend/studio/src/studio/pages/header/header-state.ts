import { createStore, type Store } from '../../shell/store.ts';
import type { ArticleProperties } from '../../types.ts';

/** What the page header needs from the Studio around it. */
export type PageHeaderHost = {
	/** The properties as typed. Why they cannot be saved, or null. */
	changed(properties: ArticleProperties): string | null;
	/** 发布 was pressed: whether the article may be published (the check before it). */
	mayPublish(): Promise<boolean>;
	/** 发布 or 撤回 was pressed, and the new draft state taken: save it now. */
	publish(): void;
	/** Enter or ↓ in the title: on to the body. */
	leaveTitle(): void;
	/** Where to load a file the article names (`./img/cover.jpg`) from. */
	fileUrl(src: string): string;
	/** The article's pictures, as the article names them: `./img/plot.png`. */
	pictures(): Promise<string[]>;
	/** Puts a picture into the article's img/; how the article names it. */
	upload(file: File): Promise<string>;
};

export type PagePath = {
	/** The pages the open one is under, the nearest last. */
	pages: Array<{ slug: string; title: string }>;
	open(slug: string): void;
	/** The pages under one, for the › after it. */
	under(slug: string): Array<{ slug: string; title: string }>;
};

/** What the page header shows (PageHeader.tsx draws it). */
export type HeaderState = {
	/** An article's properties to edit; none yet: the fields wait, disabled. */
	properties: Required<Omit<ArticleProperties, 'parent'>> | null;
	/** Why the blog could not build the properties as saved, from the server. */
	problems: string[];
	/** Why the properties as typed cannot be saved. */
	typedError: string | null;
	/** The tags other articles use, offered while typing one. */
	knownTags: string[];
	path: PagePath;
	publishing: boolean;
};

const initial: HeaderState = { properties: null, problems: [], typedError: null, knownTags: [], path: { pages: [], open: () => {}, under: () => [] }, publishing: false };

/** The page header's state, and what changes it: each change handed to the Studio (`host.changed`) as it is made. */
export function createHeaderState(host: PageHeaderHost) {
	const store: Store<HeaderState> = createStore(initial);
	const get = store.get;

	/** The properties changed by `change`, handed over; false (and nothing kept) when they cannot be saved. */
	function edit(change: Partial<ArticleProperties>, keepIfRefused = true): boolean {
		const now = get().properties;
		if (!now) return false;
		const next = { ...now, ...change };
		// As typed in the fields; handed over without the spaces at either end of the title and the description.
		const problem = host.changed({ ...next, title: next.title.trim(), description: next.description.trim() });
		if (problem && !keepIfRefused) {
			store.set({ typedError: problem });
			return false;
		}
		store.set({ properties: next, typedError: problem });
		return !problem;
	}

	const actions = {
		edit: (change: Partial<ArticleProperties>) => void edit(change),
		host,
		/** 发布 or 撤回; to publish, the check before it first. */
		async togglePublished(): Promise<void> {
			const now = get().properties;
			if (!now) return;
			if (now.draft) {
				store.set({ publishing: true });
				try {
					if (!(await host.mayPublish())) return;
				} finally {
					store.set({ publishing: false });
				}
			}
			if (edit({ draft: !now.draft }, false)) host.publish();
		},
	};

	/** What the Studio around it asks of the page header. */
	const api = {
		/** An article's properties, ready to edit, and what is wrong with them as saved. */
		show(properties: ArticleProperties, saved: string[] = []): void {
			store.set({
				properties: { title: properties.title, description: properties.description, pubDate: properties.pubDate, tags: [...properties.tags], draft: properties.draft, icon: properties.icon ?? '', cover: properties.cover ?? '', kind: properties.kind ?? 'post', wide: properties.wide ?? false },
				problems: saved,
				typedError: null,
			});
		},
		/** What is wrong with the properties now saved; an empty list when nothing is. */
		showProblems(saved: string[]): void {
			if (saved.join('\n') !== get().problems.join('\n')) store.set({ problems: saved });
		},
		/** The tags other articles use, offered while typing one. */
		knowTags(all: string[]): void {
			store.set({ knownTags: [...new Set(all)].sort((a, b) => a.localeCompare(b, 'zh-CN')) });
		},
		/** Whether the page uses the full width. */
		isWide: (): boolean => get().properties?.wide ?? false,
		/** The page to use the full width, or not; false when the properties cannot be saved now. */
		setWide: (value: boolean): boolean => edit({ wide: value }, false),
		/** The caret at the end of the title, from the start of the body. */
		focusTitle(): void {
			const title = document.querySelector<HTMLInputElement>('#article-title-input');
			if (!title) return;
			title.focus();
			title.setSelectionRange(title.value.length, title.value.length);
		},
		/** The title selected, for a page just made: what is typed is its title. */
		selectTitle(): void {
			const title = document.querySelector<HTMLInputElement>('#article-title-input');
			title?.focus();
			title?.select();
		},
		/**
		 * The pages the open one is under, the nearest last, each a link to it; none, nothing shown. The › after each
		 * opens a menu of the pages under that one (as SiYuan's path has it): from page to page of a project.
		 */
		showPath(pages: PagePath['pages'], open: PagePath['open'], under: PagePath['under']): void {
			store.set({ path: { pages, open, under } });
		},
	};

	return { store, actions, api };
}

export type HeaderActions = ReturnType<typeof createHeaderState>['actions'];
