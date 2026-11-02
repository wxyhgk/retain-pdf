import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { PageTree } from './tree/PageTree';
import { createTreeState, type ArticleListHost } from './tree/tree-state';

export type { ArticleListHost };

/**
 * The pages in the left column (tree/PageTree.tsx draws them in #article-list, in `root`); what the list does and
 * keeps in tree/tree-state.ts. What the Studio around it asks of it: what is returned.
 */
export function createArticleList(root: HTMLElement, host: ArticleListHost) {
	const list = root.querySelector<HTMLElement>('#article-list')!;
	const { store, actions, api } = createTreeState(host);
	flushSync(() => createRoot(list).render(createElement(PageTree, { store, actions, root: list })));
	return api;
}
