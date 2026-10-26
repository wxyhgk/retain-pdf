import type { LucideIcon } from 'lucide-react';

import { createStore } from '../shell/store.ts';

/** An item's mark before it, as Notion's menus have: a lucide icon, or a plugin's SVG or character. */
export type MenuIcon = LucideIcon | string;

export type MenuItem =
	| { label: string; action: () => void; danger?: boolean; hint?: string; icon?: MenuIcon }
	| 'separator';

/** The menu open (shell/ContextMenu.tsx draws it): its items, where, and what had the keys before it. */
export type MenuAsk = { round: number; items: readonly MenuItem[]; at: { x: number; y: number }; returnFocus: HTMLElement | null };

export const contextMenu = createStore<{ ask: MenuAsk | null }>({ ask: null });
let round = 0;

/**
 * A menu at the pointer (or under an element, from the keyboard). It takes focus, moves with the arrow keys, and closes
 * on Escape (giving the keys back to where they were), a click elsewhere, a scroll or a blur; one at a time.
 */
export function showContextMenu(items: readonly MenuItem[], at: { x: number; y: number } | HTMLElement): void {
	const point = at instanceof HTMLElement ? (() => {
		const rect = at.getBoundingClientRect();
		return { x: rect.left + 24, y: rect.bottom };
	})() : at;
	const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	contextMenu.set({ ask: { round: ++round, items, at: point, returnFocus } });
}
