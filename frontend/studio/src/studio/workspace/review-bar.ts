/**
 * The bar over the body while differences are reviewed, those of a change
 * made on disk (saved already: what is rejected is saved back over it), of
 * an earlier version being brought back, or of what the AI in the editor
 * wrote (what is accepted is saved): how many are left, and 全部接受 /
 * 全部拒绝; for the AI's, 重试 too.
 */
export function createReviewBar(root: HTMLElement, host: { acceptAll(): void; rejectAll(): void; retry(): void }) {
	const bar = root.querySelector<HTMLElement>('#review-bar')!;
	const count = bar.querySelector<HTMLElement>('#review-count')!;
	const hint = bar.querySelector<HTMLElement>('#review-hint')!;
	const retry = bar.querySelector<HTMLButtonElement>('#review-retry')!;
	bar.querySelector<HTMLButtonElement>('#review-accept-all')!.addEventListener('click', () => host.acceptAll());
	bar.querySelector<HTMLButtonElement>('#review-reject-all')!.addEventListener('click', () => host.rejectAll());
	retry.addEventListener('click', () => host.retry());

	let from: ReviewKind = 'disk';
	return {
		/** What the next review is of. */
		reviewing(what: ReviewKind): void {
			from = what;
			hint.textContent = { disk: '已经保存在磁盘上；拒绝的会改回去', history: '接受的会保存', ai: '接受的会保存；不满意可以重试' }[what];
			retry.hidden = what !== 'ai';
		},
		/** How many changes are left, or null when none is under review. */
		show(pending: number | null): void {
			bar.hidden = pending === null;
			if (pending !== null) count.textContent = { disk: `磁盘上的文章有 ${pending} 处改动`, history: `这个历史版本和现在有 ${pending} 处不同`, ai: `AI 写的有 ${pending} 处改动` }[from];
		},
	};
}

/** What differences are reviewed: a change on disk, an earlier version, or what the AI in the editor wrote. */
export type ReviewKind = 'disk' | 'history' | 'ai';
