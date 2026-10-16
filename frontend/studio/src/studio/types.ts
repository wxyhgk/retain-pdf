import type { CubeDisplaySettings } from '../science/cube-display.mjs';

export type ArticleSummary = {
	slug: string;
	title: string;
	draft?: boolean;
	/** Its icon, an emoji; empty for none. */
	icon?: string;
	tags?: string[];
	/** Where the blog lists it: under /blog/ or /wiki/. */
	kind?: 'post' | 'wiki';
};

/** An article that holds what was searched for, with some lines it is on. */
export type SearchResult = {
	slug: string;
	title: string;
	icon: string;
	/** The title (or folder name) holds it. */
	inTitle: boolean;
	matches: Array<{ line: number; text: string }>;
};

/** Something in the trash: a whole article, or a file or folder of one. */
export type TrashEntry = {
	kind: 'article' | 'file' | 'directory';
	/** What names it for restoring or deleting for good. */
	trashed: string;
	slug: string;
	/** For a file or folder: where it was in the article. */
	path?: string;
	/** For an article: its title and icon. */
	title?: string;
	icon?: string;
	/** When it was deleted, in milliseconds. */
	deletedAt: number;
};

/** The articles as git sees them; `available` is false when blog/ is in no repository. */
export type GitStatus = {
	available: boolean;
	/** Per article folder with changes not committed: never committed (`new`) or changed since. */
	changed: Record<string, 'new' | 'modified'>;
	/** Folders committed once and gone from disk (renamed or deleted), committed with the next article. */
	vanished: string[];
};

/** One file or folder of an article, as the file panel lists it. */
export type ArticleFileEntry = {
	/** Relative to the article folder: `img/plot.png`, `assets/runs`. */
	path: string;
	kind: 'file' | 'directory';
	size?: number;
	/** Missing for `img/`, `assets/` or `ai/` while the folder does not exist yet. */
	modified?: number;
	/** The article's own files and its three resource folders: they cannot be renamed, moved or removed. */
	locked?: boolean;
};

export type ArticleProperties = {
	title: string;
	description: string;
	pubDate: string;
	tags: string[];
	draft: boolean;
	/** The page's icon, an emoji (`icon:`); empty for none. Left out: not changed. */
	icon?: string;
	/** The cover picture as written (`heroImage: ./img/cover.jpg`); empty for none. Left out: not changed. */
	cover?: string;
	/** Where the blog lists it. Left out: not changed. */
	kind?: 'post' | 'wiki';
};

/** Something the check before publishing found: `error` stops the blog's build, `warning` shows broken on the page. */
export type ArticleIssue = {
	severity: 'error' | 'warning';
	message: string;
	/** Where in `index.md`; none for the properties as a whole. */
	line?: number;
};

export type ArticlePayload = {
	slug: string;
	source: string;
	revision: string;
	properties: ArticleProperties;
	/** Why the blog could not build its properties (a missing description, broken YAML…); empty when none. */
	problems?: string[];
	/** Temporary compatibility fields returned by the first Studio API. */
	content?: string;
	hash?: string;
	chemistryViews: Record<string, { format: string; view: number[]; display?: CubeDisplaySettings }>;
	/** The article's own formula macros, from its `macros:` property. */
	macros?: Record<string, string>;
};
