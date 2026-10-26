import { openDialog } from '../shell/dialogs/Dialogs';
import type { CiteHost } from '../shell/dialogs/CiteDialog';

/** The work to cite, asked when `[@` is typed (shell/dialogs/CiteDialog.tsx). */
export function createCitePicker(host: CiteHost) {
	let round = 0;
	let givenUp: (() => void) | null = null;
	return {
		/** Asks which work to cite: its key, or null when given up. */
		pick(): Promise<string | null> {
			givenUp?.();
			return new Promise((resolve) => {
				const done = (key: string | null) => {
					givenUp = null;
					resolve(key);
				};
				givenUp = () => done(null);
				openDialog('cite', { round: ++round, host, done });
			});
		},
	};
}
