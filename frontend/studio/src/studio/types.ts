import type { CubeDisplaySettings } from '../science/cube-display.mjs';

export type ArticleSummary = {
	slug: string;
	title: string;
	draft?: boolean;
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
};

export type ArticlePayload = {
	slug: string;
	source: string;
	revision: string;
	properties: ArticleProperties;
	/** Temporary compatibility fields returned by the first Studio API. */
	content?: string;
	hash?: string;
	chemistryViews: Record<string, { format: string; view: number[]; display?: CubeDisplaySettings }>;
	/** The article's own formula macros, from its `macros:` property. */
	macros?: Record<string, string>;
};
