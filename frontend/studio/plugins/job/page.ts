import { createJobCard } from '@blog/compute/browser/job-card.ts';
import { drawOutput, drawRun, summarizeRun, type ProgramView, type RunRecord } from '@blog/compute/browser/job-view.ts';
import { runFolder } from '@blog/compute/job-fence.mjs';
import { JobPrograms } from '@blog/compute/programs.mjs';
import type { Context } from '@blog/kernel/index.mjs';
import type {} from '@blog/kernel/page.ts';
import { openBlockSheet } from '@blog/ui/block-sheet.ts';

/**
 * The blog's pages: each calculation build.mjs drew becomes a card, its
 * run's results in a sheet a click opens, read from the article's
 * published files (assets/jobs/<id>/<run>/…), as its program's view draws
 * it (`ctx.jobs`, which this provides: plugins/xtb, plugins/crest…).
 */
export const name = 'page-job';
export const inject = ['page'];

export async function apply(ctx: Context): Promise<void> {
	await ctx.plugin(JobPrograms);
	const programs = ctx.get('jobs') as JobPrograms;
	const viewOf = (record: RunRecord) => programs.get(record.program) as (ProgramView & object) | null;
	// Drawn once every plugin has started: the programs are plugins after this one.
	ctx.on('page/ready', () => drawJobs(ctx, viewOf));
}

function drawJobs(ctx: Context, viewOf: (record: RunRecord) => ProgramView | null): void {
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
		void summarizeRun(shown, read, viewOf(shown)).then((summary) => card.paint({ title, describe, record: shown, summary })).catch(() => {});

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
							void drawRun(target, shown, read, { url: (name) => url(shown, name), output: false }, viewOf(shown));
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
