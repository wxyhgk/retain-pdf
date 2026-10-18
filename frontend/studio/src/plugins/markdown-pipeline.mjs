import { chemistryLanguages, markdownPlugins } from '@blog/markdown/pipeline.mjs';
import { macrosFor } from '../math-macros.mjs';

/**
 * How this blog's articles become pages (packages/markdown): the build uses
 * these plugins (astro.config.mjs), and the Studio's check before publishing
 * runs them too. Formulas use the site's macros (src/katex-macros.json).
 */
export { chemistryLanguages };

export const { remarkPlugins, rehypePlugins } = markdownPlugins({ macrosFor });
