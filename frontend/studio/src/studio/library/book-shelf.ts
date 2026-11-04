import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { BookShelf, type BookShelfHost } from './BookShelf';
import './book-shelf.css';

export type { BookShelfHost };

/**
 * 书库 in `root` (BookShelf.tsx draws it): RetainPDF's books, drawn by the Studio. `setVisible`: shown or not (its
 * books asked for as it is shown, and what translates asked again only while it is).
 */
export function createBookShelf(root: HTMLElement, host: BookShelfHost) {
	const shelf = createRoot(root);
	const draw = (visible: boolean) => flushSync(() => shelf.render(createElement(BookShelf, { host, visible })));
	draw(false);
	return { setVisible: draw };
}
