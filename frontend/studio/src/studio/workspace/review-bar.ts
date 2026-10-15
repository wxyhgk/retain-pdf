/**
 * The bar over the body while changes made on disk are reviewed: how many
 * are left, and 全部接受 / 全部拒绝. The changes are saved already; what is
 * rejected is saved back over them.
 */
export function createReviewBar(root: HTMLElement, host: { acceptAll(): void; rejectAll(): void }) {
	const bar = root.querySelector<HTMLElement>('#review-bar')!;
	const count = bar.querySelector<HTMLElement>('#review-count')!;
	bar.querySelector<HTMLButtonElement>('#review-accept-all')!.addEventListener('click', () => host.acceptAll());
	bar.querySelector<HTMLButtonElement>('#review-reject-all')!.addEventListener('click', () => host.rejectAll());

	return {
		/** How many changes are left, or null when none is under review. */
		show(pending: number | null): void {
			bar.hidden = pending === null;
			if (pending !== null) count.textContent = `磁盘上的文章有 ${pending} 处改动`;
		},
	};
}
