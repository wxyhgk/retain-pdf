export type ReferenceKind = 'image' | 'link' | 'definition' | 'html' | 'file' | 'frontmatter';

/** A path the article names, and where it is written in `index.md`. */
export type ArticleReference = {
	/** Article-relative, decoded: `img/图 1.png`. */
	path: string;
	kind: ReferenceKind;
	/** Offsets of the path as written, in the whole source. */
	start: number;
	end: number;
	raw: string;
};

export function findArticleReferences(source: string): ArticleReference[];
export function referencedPaths(source: string): Set<string>;
export function isReferenced(referenced: Set<string>, path: string): boolean;
export function movedPath(path: string, from: string, to: string): string | null;
export function rewriteMovedReferences(
	source: string,
	from: string,
	to: string,
): { source: string; changed: number; moves: Array<{ kind: ReferenceKind; from: string; to: string }> };
export function articlePath(written: string): string | null;
