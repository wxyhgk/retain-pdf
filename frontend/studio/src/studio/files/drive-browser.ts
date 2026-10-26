import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { DriveBrowser } from './drive/DriveBrowser';
import { createDriveState, type DriveBrowserHost } from './drive/drive-state';
import './drive.css';

export type { DriveBrowserHost };

/**
 * The drive (资料库) as a file browser in `root` (drive/DriveBrowser.tsx draws it): a page of its own (`page`) or the
 * side panel's smaller list (`pane`). What the Studio asks of it: returned.
 */
export function createDriveBrowser(root: HTMLElement, host: DriveBrowserHost, { mode }: { mode: 'page' | 'pane' }) {
	const { store, actions, api } = createDriveState(host);
	root.classList.add('drive', `drive--${mode}`);
	flushSync(() => createRoot(root).render(createElement(DriveBrowser, { store, actions, mode })));
	return api;
}
