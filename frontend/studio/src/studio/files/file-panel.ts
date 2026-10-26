import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { createFilePanelState, type FilePanelHost } from './panel/file-panel-state';
import { FilePanel } from './panel/FilePanel';

export type { FilePanelHost };

/** The 文件 tab (panel/FilePanel.tsx draws it in `pane`, over what the server drew). What the Studio asks of it: returned. */
export function createFilePanel(pane: HTMLElement, host: FilePanelHost) {
	const { store, actions, api } = createFilePanelState(host);
	flushSync(() => createRoot(pane).render(createElement(FilePanel, { store, actions })));
	return api;
}
