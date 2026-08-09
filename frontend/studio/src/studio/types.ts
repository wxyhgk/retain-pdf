export type ArticleSummary = {
	slug: string;
	title: string;
};

export type ArticleFiles = {
	img: string[];
	assets: string[];
	ai: string[];
};

export type ArticlePayload = {
	slug: string;
	content: string;
	hash: string;
	files: ArticleFiles;
};
