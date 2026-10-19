import { createJobCard } from '@blog/compute/browser/job-card.ts';
import { drawOutput, drawRun, summarizeRun, type RunRecord } from '@blog/compute/browser/job-view.ts';
import { runFolder } from '@blog/compute/job-fence.mjs';
import type { Context } from '@blog/kernel/index.mjs';
import type {} from '@blog/kernel/page.ts';
import { openBlockSheet } from '@blog/ui/block-sheet.ts';

/**
 * The blog's pages: each calculation build.mjs drew becomes a card, its
 * run's results in a sheet a click opens, read from the article's
 * published files (assets/jobs/<id>/<run>/…).
 */
export const name = 'page-job';
export const inject = ['page'];

export function apply(ctx: Context): void {
	const url = (record: RunRecord, name: string) => ctx.page.fileUrl(`${runFolder(record.id, record.run)}/${name}`);
	for (const figure of document.querySelectorAll<HTMLElement>('figure.note-job')) {
		let record: RunRecord | null = null;
		try {
			record = figure.dataset.run ? JSON.parse(figure.dataset.run) : null;
		} catch {
			record = null;
		}
		const title = figure.querySelector('.note-job-title')?.textContent ?? '';
		const describe = figure.querySelector('.note-job-summary')?.textContent ?? '';
		const command = figure.querySelector('.note-job-input summary')?.textContent ?? '';
		const input = figure.querySelector('.note-job-input code')?.textContent ?? '';
		const card = createJobCard(figure);
		card.paint({ title, describe, record, summary: null });
		if (!record) continue;
		const shown = record;
		const read = async (name: string) => {
			const response = await fetch(url(shown, name));
			return response.ok ? response.text() : null;
		};
		void summarizeRun(shown, read).then((summary) => card.paint({ title, describe, record: shown, summary })).catch(() => {});

		const open = () =>
			openBlockSheet({
				kind: '计算',
				title: title || '未命名计算',
				tabs: [
					{
						key: 'result',
						label: '结果',
						draw: (panel) => {
							const target = document.createElement('div');
							panel.append(target);
							void drawRun(target, shown, read, { url: (name) => url(shown, name), output: false });
						},
					},
					{
						key: 'input',
						label: '输入',
						draw: (panel) => {
							const line = document.createElement('p');
							line.className = 'job-section-note';
							line.textContent = command;
							const pre = document.createElement('pre');
							pre.className = 'job-log-text';
							pre.textContent = input;
							panel.append(line, pre);
						},
					},
					{ key: 'output', label: '输出', draw: (panel) => void drawOutput(panel, shown, read, url(shown, shown.output)) },
				],
			});
		figure.tabIndex = 0;
		figure.setAttribute('role', 'button');
		figure.setAttribute('aria-label', `${title || '计算'}：打开结果`);
		figure.classList.add('is-openable');
		figure.addEventListener('click', open);
		figure.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				open();
			}
		});
	}
}
