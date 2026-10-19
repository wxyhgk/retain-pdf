import { fileURLToPath } from 'node:url';
import { buildKernel } from '@blog/kernel/node.mjs';
import { chemistryLanguages, markdownPlugins } from '@blog/markdown/pipeline.mjs';
import { macrosFor } from '../math-macros.mjs';

/**
 * How this blog's articles become pages (packages/markdown): the build uses
 * these plugins (astro.config.mjs), and the Studio's check before publishing
 * runs them too. Formulas use the site's macros (src/katex-macros.json);
 * the blocks are those of the project's plugins (plugins/*\/build.mjs).
 */
export { chemistryLanguages };

const { blocks } = await buildKernel(fileURLToPath(new URL('../..', import.meta.url)));

export const { remarkPlugins, rehypePlugins } = markdownPlugins({ macrosFor, blocks });
