import type { CubeDisplaySettings } from '../science/cube-display.mjs';

export type ArticleSummary = {
	slug: string;
	title: string;
	draft?: boolean;
};

export type ArticleFiles = {
	img: string[];
	assets: string[];
	ai: string[];
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
	files: ArticleFiles;
	chemistryViews: Record<string, { format: string; view: number[]; display?: CubeDisplaySettings }>;
};
