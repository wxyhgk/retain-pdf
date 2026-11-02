/**
 * Raw HTML in an article as sanitized elements (see rehype-article-html.mjs).
 * Typed loosely on purpose: Astro and the tests each bring their own copy of unified's types.
 */
declare function rehypeArticleHtml(this: any): (tree: any, file: any) => void;
export default rehypeArticleHtml;
