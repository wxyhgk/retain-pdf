/** A line saying how a change went: busy while it runs, an error kept, anything else gone after a while. */
export type Status = { text: string; state: '' | 'busy' | 'error' };

export const NO_STATUS: Status = { text: '', state: '' };

/** What `error` says, or `fallback`. */
export function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}

/** Sets a status by `show`; a done one (state '') is cleared after `clearAfter` ms, when given. */
export function statusLine(show: (status: Status) => void, clearAfter = 0): (text: string, state?: Status['state']) => void {
	let timer = 0;
	return function say(text, state = '') {
		window.clearTimeout(timer);
		show({ text, state });
		if (clearAfter && text && state === '') timer = window.setTimeout(() => show(NO_STATUS), clearAfter);
	};
}
