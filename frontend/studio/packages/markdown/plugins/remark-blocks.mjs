import { visit } from 'unist-util-visit';

/**
 * The fences plugins claim (@blog/kernel's `ctx.blocks`, filled from each
 * plugin's build.mjs): each is given to its block's `remark(node, file)`,
 * which returns what takes its place (or nothing, to leave it as it is).
 * What it reports through `file.message` is what the check before
 * publishing shows.
 * @param {{ blocks?: { get(fence: string): any } | null }} [options]
 */
export default function remarkBlocks({ blocks = null } = {}) {
	return (tree, file) => {
		if (!blocks) return;
		visit(tree, 'code', (node, index, parent) => {
			if (!parent || index === undefined) return;
			const block = blocks.get(node.lang ?? '');
			if (typeof block?.remark !== 'function') return;
			const replaced = block.remark(node, file);
			if (replaced) parent.children[index] = replaced;
		});
	};
}
