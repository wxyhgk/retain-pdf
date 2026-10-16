import type { ArticleIssue } from '../types.ts';

/**
 * What the check before publishing found, for the author to decide on:
 * what would stop the blog's build blocks publishing; what the page would
 * only show broken may be published all the same.
 */
export function createPublishCheck(dialog: HTMLDialogElement) {
	const summary = dialog.querySelector<HTMLElement>('#publish-check-summary')!;
	const list = dialog.querySelector<HTMLElement>('#publish-check-list')!;
	const publish = dialog.querySelector<HTMLButtonElement>('#publish-anyway')!;
	const cancel = dialog.querySelector<HTMLButtonElement>('#publish-check-cancel')!;

	return {
		/** Whether to publish with these issues; at once when there are none. */
		confirm(issues: ArticleIssue[]): Promise<boolean> {
			if (!issues.length) return Promise.resolve(true);
			const errors = issues.filter((issue) => issue.severity === 'error').length;
			summary.textContent = errors
				? `${errors} 处问题会让博客构建失败（整个网站都发布不了），修好后再发布`
				: `${issues.length} 处问题会在页面上显示出错，可以先修好，也可以照样发布`;
			list.replaceChildren(...issues.map((issue) => {
				const item = document.createElement('li');
				item.className = `publish-check-item is-${issue.severity}`;
				const where = document.createElement('span');
				where.className = 'publish-check-line';
				where.textContent = issue.line ? `第 ${issue.line} 行` : '属性';
				item.append(where, document.createTextNode(issue.message));
				return item;
			}));
			publish.hidden = errors > 0;
			cancel.textContent = errors ? '知道了' : '先不发布';
			dialog.returnValue = '';
			dialog.showModal();
			cancel.focus();
			return new Promise((resolve) => {
				dialog.addEventListener('close', () => resolve(dialog.returnValue === 'publish'), { once: true });
			});
		},
	};
}
