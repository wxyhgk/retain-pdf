import { referencedPaths } from '@blog/markdown/articles/article-references.mjs';
import { parseMarkdownBodyBlocks, parseStudioDocument, reparseBodyBlocks } from '../document/parse.ts';
import type { MarkdownBlockSlice } from '../document/types.ts';

const KEPT = 20_000;

/**
 * What a block names a file with has one of these in it (a link or image's `](`, a definition's `]:`, an HTML
 * attribute, a chemistry block's `@file`): a block without them names none and is not parsed.
 */
const MAY_NAME = /\]\(|\]:|src|href|poster|@file/iu;

/**
 * The article's files its source names (as referencedPaths), read a block
 * at a time and remembered by block: as an article is typed, only the
 * blocks round the change are read again, not a whole book.
 */
export function referencedFilesReader(): (source: string) => Set<string> {
	let last: { body: string; blocks: MarkdownBlockSlice[] } | null = null;
	const byBlock = new Map<string, readonly string[]>();
	return (source) => {
		const document = parseStudioDocument(source);
		const body = document.body.raw;
		const blocks = last ? reparseBodyBlocks(last, body) : parseMarkdownBodyBlocks(body);
		last = { body, blocks };
		if (byBlock.size > KEPT) byBlock.clear();
		// The frontmatter's (its hero image), then each block's.
		const paths = referencedPaths(source.slice(0, document.body.start));
		for (const block of blocks) {
			let named = byBlock.get(block.raw);
			if (!named) byBlock.set(block.raw, (named = MAY_NAME.test(block.raw) ? [...referencedPaths(block.raw)] : []));
			for (const path of named) paths.add(path);
		}
		return paths;
	};
}
