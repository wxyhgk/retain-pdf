/**
 * The blocks plugins claim (@blog/kernel's `ctx.blocks`), once the page is
 * HTML and made safe (rehype-article-html.mjs): each block's `rehype(tree,
 * file)` may finish what its `remark` drew (a widget's frame gets its page
 * here, which the HTML policy would have taken away).
 * @param {{ blocks?: { list(): any[] } | null }} [options]
 */
export default function rehypeBlocks({ blocks = null } = {}) {
	return (tree, file) => {
		for (const block of blocks?.list() ?? []) {
			if (typeof block.rehype === 'function') block.rehype(tree, file);
		}
	};
}
