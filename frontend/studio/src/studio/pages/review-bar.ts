import { t } from '@blog/i18n/index.mjs';

/**
 * The bar over the body while differences are reviewed, those of a change
 * made on disk (saved already: what is rejected is saved back over it), of
 * an earlier version being brought back, or of what the AI in the editor
 * wrote (what is accepted is saved): how many are left, and 全部接受 /
 * 全部拒绝; for the AI's, 重试 too. Once some are decided one by one, the
 * buttons are for the rest: 其余接受 / 其余拒绝, what was decided kept.
 */
export function createReviewBar(root: HTMLElement, host: { acceptAll(): void; rejectAll(): void; retry(): void }) {
	const bar = root.querySelector<HTMLElement>('#review-bar')!;
	const count = bar.querySelector<HTMLElement>('#review-count')!;
	const hint = bar.querySelector<HTMLElement>('#review-hint')!;
	const retry = bar.querySelector<HTMLButtonElement>('#review-retry')!;
	const acceptAll = bar.querySelector<HTMLButtonElement>('#review-accept-all')!;
	const rejectAll = bar.querySelector<HTMLButtonElement>('#review-reject-all')!;
	acceptAll.addEventListener('click', () => host.acceptAll());
	rejectAll.addEventListener('click', () => host.rejectAll());
	retry.addEventListener('click', () => host.retry());

	let from: ReviewKind = 'disk';
	/** How many there were when this review began: fewer now, some were decided one by one. */
	let first: number | null = null;
	return {
		/** What the next review is of. */
		reviewing(what: ReviewKind): void {
			from = what;
			hint.textContent = { disk: t('已经保存在磁盘上；拒绝的会改回去'), history: t('接受的会保存'), ai: t('接受的会保存；不满意可以重试') }[what];
			retry.hidden = what !== 'ai';
			first = null;
		},
		/** How many changes are left, or null when none is under review. */
		show(pending: number | null): void {
			bar.hidden = pending === null;
			if (pending === null) {
				first = null;
				return;
			}
			first ??= pending;
			const some = pending < first;
			count.textContent = some
				? t('已决定 {decided} 处，还剩 {pending} 处', { decided: first - pending, pending })
				: { disk: t('磁盘上的文章有 {pending} 处改动', { pending }), history: t('这个历史版本和现在有 {pending} 处不同', { pending }), ai: t('AI 写的有 {pending} 处改动', { pending }) }[from];
			acceptAll.textContent = some ? t('其余接受') : t('全部接受');
			rejectAll.textContent = some ? t('其余拒绝') : t('全部拒绝');
		},
	};
}

/** What differences are reviewed: a change on disk, an earlier version, or what the AI in the editor wrote. */
export type ReviewKind = 'disk' | 'history' | 'ai';
