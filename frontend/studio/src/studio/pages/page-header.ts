import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { createHeaderState, type PageHeaderHost } from './header/header-state';
import { PageHeader } from './header/PageHeader';

export type { PageHeaderHost };

/**
 * The top of the page (header/PageHeader.tsx draws it in `root`, the editor's header): the cover, the icon, the title,
 * the properties. What the Studio around it asks of it: what is returned.
 */
export function createPageHeader(root: HTMLElement, host: PageHeaderHost) {
	const { store, actions, api } = createHeaderState(host);
	// Drawn at once (over what the server drew): backlinks.ts finds its element in it next.
	flushSync(() => createRoot(root).render(createElement(PageHeader, { store, actions, root })));
	return api;
}
