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
