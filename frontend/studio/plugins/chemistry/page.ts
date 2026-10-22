import type { Context } from '@blog/kernel/index.mjs';
import type {} from '@blog/kernel/page.ts';
import '@blog/science/browser/molecule-renderer.css';
import { setMoleculeViewContext, type SavedMoleculeView } from '@blog/science/browser/molecule-renderer.ts';
import { setScienceResourceBaseUrl } from '@blog/science/browser/resource-context.ts';
import { renderScienceCodeBlocks } from '@blog/science/browser/science-renderer.ts';

/**
 * The blog's pages: the chemistry fences build.mjs left as code are drawn
 * (@blog/science: RDKit for flat structures, 3Dmol for those in space and
 * cubes), each 3D one from the view the author saved in the Studio
 * (article.views.json); a block that is a file of the article reads it from
 * where the article publishes its files.
 */
export const name = 'page-chemistry';
export const inject = ['page'];

export function apply(ctx: Context): void {
	setMoleculeViewContext({ views: ctx.page.views as Record<string, SavedMoleculeView> });
	// The article's files: /article-assets/<slug>/…
	setScienceResourceBaseUrl(ctx.page.fileUrl(''));
	ctx.on('page/ready', () => renderScienceCodeBlocks());
}
