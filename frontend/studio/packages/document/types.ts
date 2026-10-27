export type SourceRange = {
	/** Inclusive UTF-16 offset in the complete Markdown source. */
	readonly start: number;
	/** Exclusive UTF-16 offset in the complete Markdown source. */
	readonly end: number;
};

export type FrontmatterSlice = SourceRange & {
	readonly raw: string;
	readonly openingRaw: string;
	readonly yamlRaw: string;
	readonly closingRaw: string;
};

export type MarkdownBlockSlice = SourceRange & {
	/** The mdast top-level node type. Unknown node types are intentionally retained. */
	readonly kind: string;
	readonly raw: string;
};

export type StudioDocument = {
	/** A byte-order mark, when present. No other content is treated as a preamble. */
	readonly preambleRaw: string;
	readonly frontmatter: FrontmatterSlice | null;
	readonly body: SourceRange & {
		readonly raw: string;
		readonly blocks: readonly MarkdownBlockSlice[];
	};
};

/** An article's properties, as the page header shows and edits them (its frontmatter). */
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
	/** The page uses the full width. Left out: not changed. */
	wide?: boolean;
	/** The folder name of the page it is under; empty for none. Left out: not changed. */
	parent?: string;
};
