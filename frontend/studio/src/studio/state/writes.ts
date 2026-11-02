let pending = 0;
const waiting: Array<() => void> = [];
/** When the last write of the Studio's own was over (ms). */
let lastEnded = 0;

/**
 * Runs a change the Studio makes to the article on disk (a save, a saved
 * view, a move that rewrites references), so that when the disk watcher
 * reports it, the change is recognised as the Studio's own and not someone else's.
 */
export async function trackWrite<T>(task: () => Promise<T>): Promise<T> {
	pending += 1;
	try {
		return await task();
	} finally {
		pending -= 1;
		lastEnded = Date.now();
		if (pending === 0) for (const resolve of waiting.splice(0)) resolve();
	}
}

/** Resolves once no write of the Studio's own is under way. */
export function writesSettled(): Promise<void> {
	return pending === 0 ? Promise.resolve() : new Promise((resolve) => waiting.push(resolve));
}

/**
 * Whether a write of the Studio's own is under way, or was over less than `within` ms ago: what the disk watcher
 * reports now is most likely that (it tells of a change a moment after, gathered).
 */
export function wroteJustNow(within = 1500): boolean {
	return pending > 0 || Date.now() - lastEnded < within;
}
