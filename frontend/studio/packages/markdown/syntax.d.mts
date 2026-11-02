import type { Root } from 'mdast';
import type { PluggableList, Processor } from 'unified';

/** How an article's Markdown is read, wherever it is read (GFM, formulas). */
export declare const articleSyntax: PluggableList;
export declare const articleParser: Processor<Root, Root, Root>;
/** An article's Markdown as a tree (mdast), read as the blog reads it. */
export declare function parseArticle(source: string): Root;
