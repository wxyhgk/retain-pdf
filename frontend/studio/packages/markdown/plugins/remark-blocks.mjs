import { visit } from 'unist-util-visit';
import { t } from '@blog/i18n/index.mjs';

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
			// A plugin that fails on a block: the block left as code, and said (the page is made all the same).
			let replaced;
			try {
				replaced = block.remark(node, file);
			} catch (error) {
				file.message(t('插件 {name} 处理这个块时出错：{error}', { name: block.name ?? node.lang, error: error instanceof Error ? error.message : String(error) }), { place: node.position, source: 'remark-blocks', ruleId: 'block-failed' });
				return;
			}
			if (replaced) parent.children[index] = replaced;
		});
	};
}
