import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { t } from '@blog/i18n/index.mjs';
import type { StudioPanel } from '@blog/kernel/ui.ts';
import { createStore } from '../shell/store';
import { QuotePanel, type QuotePanelHost, type QuotePanelState } from './QuotePanel';
import './quote-panel.css';

export type { QuoteBook, QuotePanelHost, QuotePanelState } from './QuotePanel';

/** Its tab's mark: two quotation marks. */
const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>';

/**
 * 摘录 (QuotePanel.tsx) as a tab of the right column: `panel` put in while a book is read in 书库 (side-panel.ts addTab)
 * and taken out after; `set` what it shows.
 */
export function createQuotePanel(host: QuotePanelHost) {
	const store = createStore<QuotePanelState>({ note: null, book: null, passages: [], asking: false });
	let root: Root | null = null;
	const panel: StudioPanel = {
		key: 'quotes',
		label: t('摘录'),
		icon: ICON,
		draw(pane) {
			pane.classList.add('quotes-pane');
			root = createRoot(pane);
			root.render(createElement(QuotePanel, { store, host }));
			return () => {
				root?.unmount();
				root = null;
			};
		},
	};
	return {
		panel,
		get: () => store.get(),
		set: (change: Partial<QuotePanelState>) => store.set(change),
	};
}
