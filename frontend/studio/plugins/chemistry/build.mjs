import { MOLECULE_LANGUAGES } from '@blog/science/parsers/molecule-block.ts';

/**
 * The blog's build: chemistry fences (```smiles, ```sdf, ```xyz, ```cube…,
 * the formats @blog/science reads) are this plugin's. They are left as they
 * are, code in the page, which page.ts draws from their text: claimed here so
 * that they are not taken for code files nor highlighted.
 */
export const name = 'block-chemistry';
export const inject = ['blocks'];

export function apply(ctx) {
	ctx.blocks.register({ name, fence: [...MOLECULE_LANGUAGES], remark: () => undefined });
}
