import { fileURLToPath } from 'node:url';
import { buildKernel } from '@blog/kernel/node.mjs';
import { markdownPlugins } from '@blog/markdown/pipeline.mjs';
import { macrosFor } from '../math-macros.mjs';

/**
 * How this blog's articles become pages (packages/markdown): the build uses
 * these plugins (astro.config.mjs), and the Studio's check before publishing
 * runs them too. Formulas use the site's macros (src/katex-macros.json);
 * the blocks are those of the project's plugins (plugins/*\/build.mjs).
 */
const { blocks } = await buildKernel(fileURLToPath(new URL('../..', import.meta.url)));

/** The fences the plugins claim: Shiki leaves them to their plugins (a molecule is drawn in the page from its text). */
export const blockFences = blocks.fences();

export const { remarkPlugins, rehypePlugins } = markdownPlugins({ macrosFor, blocks });
