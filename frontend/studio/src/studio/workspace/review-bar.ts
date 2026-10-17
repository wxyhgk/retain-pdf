/**
 * The bar over the body while differences are reviewed, those of a change
 * made on disk (saved already: what is rejected is saved back over it) or
 * of an earlier version being brought back (what is accepted is saved):
 * how many are left, and 全部接受 / 全部拒绝.
 */
export function createReviewBar(root: HTMLElement, host: { acceptAll(): void; rejectAll(): void }) {
	const bar = root.querySelector<HTMLElement>('#review-bar')!;
	const count = bar.querySelector<HTMLElement>('#review-count')!;
	bar.querySelector<HTMLButtonElement>('#review-accept-all')!.addEventListener('click', () => host.acceptAll());
	bar.querySelector<HTMLButtonElement>('#review-reject-all')!.addEventListener('click', () => host.rejectAll());

	let from: 'disk' | 'history' = 'disk';
	return {
		/** What the next review is of. */
		reviewing(what: 'disk' | 'history'): void {
			from = what;
		},
		/** How many changes are left, or null when none is under review. */
		show(pending: number | null): void {
			bar.hidden = pending === null;
			if (pending !== null) count.textContent = from === 'disk' ? `磁盘上的文章有 ${pending} 处改动` : `这个历史版本和现在有 ${pending} 处不同`;
		},
	};
}
