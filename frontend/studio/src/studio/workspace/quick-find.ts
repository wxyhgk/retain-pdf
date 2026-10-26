import { openDialog } from '../shell/dialogs/Dialogs';
import type { Picked, QuickFindHost } from '../shell/dialogs/QuickFindDialog';

/** The finder asked last (one at a time): given up when another is asked for. */
let round = 0;
let givenUp: (() => void) | null = null;

/** ⌘K, and the questions asked through it (shell/dialogs/QuickFindDialog.tsx): which article to link, where pages go. */
export function createQuickFind(host: QuickFindHost) {
	function ask<T>(mode: 'pick' | 'place', more: { excluded?: Set<string>; placeholder?: string } = {}): Promise<T | null> {
		givenUp?.();
		return new Promise((resolve) => {
			let answered = false;
			const done = (answer: T | null) => {
				if (answered) return;
				answered = true;
				givenUp = null;
				resolve(answer);
			};
			givenUp = () => done(null);
			openDialog('finder', { round: ++round, host, mode, ...more, done } as never);
		});
	}

	return {
		/** ⌘K: finds an article or a file of the drive; open already, its words selected to be typed over. */
		open(): void {
			const field = document.querySelector<HTMLInputElement>('#quick-find-dialog #quick-find-input');
			if (field && !givenUp) {
				field.select();
				return;
			}
			givenUp?.();
			openDialog('finder', { round: ++round, host, mode: 'find' });
		},
		/**
		 * 移到…: asks where these pages go, by a page's title (each shown with its path): that page's folder name, `''`
		 * for the top, null when given up. Not among the pages moved, nor under them.
		 */
		pickPlace(moving: string[]): Promise<string | null> {
			const all = host.articles();
			const excluded = new Set(moving);
			// And all under them.
			for (let grew = true; grew; ) {
				grew = false;
				for (const article of all) {
					if (article.parent && excluded.has(article.parent) && !excluded.has(article.slug)) {
						excluded.add(article.slug);
						grew = true;
					}
				}
			}
			return ask<string>('place', { excluded, placeholder: moving.length > 1 ? `把 ${moving.length} 个页面移到哪个页面下面…` : '移到哪个页面下面…' });
		},
		/** Asks which article: one there is, a new one to make (its title typed), or null when given up. */
		pick: (): Promise<Picked | null> => ask<Picked>('pick'),
	};
}
