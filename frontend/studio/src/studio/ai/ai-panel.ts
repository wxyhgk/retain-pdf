import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { AiPanel } from './panel/AiPanel';
import { createPanelState, type AiPanelHost } from './panel/panel-state';

export { chosenAI } from './panel/panel-state';
export type { AiPanelHost };

/**
 * The AI panel (the right column's AI tab), drawn by React in `pane` (panel/AiPanel.tsx); its conversation and what goes
 * with it in panel/panel-state.ts. What the Studio around it asks of it: what is returned.
 */
export function createAiPanel(pane: HTMLElement, host: AiPanelHost) {
	const { store, actions, panel, sheetHost } = createPanelState(pane, host);
	// Drawn at once: what is asked of it next finds it there.
	flushSync(() => createRoot(pane).render(createElement(AiPanel, { store, actions, sheetHost })));
	return panel;
}
