import type { Node as ProseMirrorNode, NodeType } from '@milkdown/prose/model';

/**
 * A block of math, as Crepe keeps it (the Milkdown fork's `mathBlockAttrs`):
 * a LaTeX code block that remembers it is written as `$$ … $$`.
 */
export const FORMULA_BLOCK_ATTRS = { language: 'LaTeX', fence: '$$' } as const;

/**
 * Whether a code block is a formula: what the blog draws with KaTeX, a `$$`
 * block or a ```math fence. A ```latex fence is code in the blog, and here.
 */
export function isFormulaBlock(node: ProseMirrorNode): boolean {
	const language = String(node.attrs.language ?? '').toLowerCase();
	return language === 'math' || (language === 'latex' && node.attrs.fence === FORMULA_BLOCK_ATTRS.fence);
}

/** A new block of math holding `source`. */
export function createFormulaBlock(code: NodeType, source = ''): ProseMirrorNode {
	return code.create(FORMULA_BLOCK_ATTRS, source ? code.schema.text(source) : null);
}
