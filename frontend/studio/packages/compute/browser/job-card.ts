import { t } from '@blog/i18n/index.mjs';
import { RUN_STATE_NAMES } from '../job-fence.mjs';
import { formatDuration, isFinished, runDuration, structureThumbnail, type RunRecord, type RunSummary } from './job-view.ts';

/**
 * A job as the page shows it, in two lines: its name, how its run is going
 * or how it ended; then a few numbers (or where a run is, or why it failed)
 * beside its structure drawn small. Everything else is in its sheet. The
 * blog and the Studio draw the same card.
 */
export type JobCard = {
	root: HTMLElement;
	/** Where the Studio puts its buttons (运行, ⋯). */
	actions: HTMLElement;
	/** `reading`: its summary is still being read (not there yet, rather than nothing found). */
	paint(state: { title: string; describe: string; record: RunRecord | null; summary: RunSummary | null; reading?: boolean }): void;
	/** Only the time, every second while a run goes. */
	tick(): void;
};

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
	const made = document.createElement(tag);
	if (className) made.className = className;
	if (text !== undefined) made.textContent = text;
	return made;
}

export function createJobCard(root: HTMLElement = element('div')): JobCard {
	root.classList.add('job-card');
	const head = element('div', 'job-card-head');
	const kind = element('span', 'job-kind', t('计算'));
	const title = element('span', 'job-card-title');
	const state = element('span', 'job-state');
	const when = element('span', 'job-card-when');
	const actions = element('span', 'job-card-actions');
	head.append(kind, title, state, when, actions);
	const body = element('div', 'job-card-body');
	const picture = element('div', 'job-card-picture');
	const text = element('div', 'job-card-text');
	const line = element('p', 'job-card-line');
	const describe = element('p', 'job-card-describe');
	const progress = element('div', 'job-card-progress');
	text.append(line, describe);
	body.append(picture, text);
	root.replaceChildren(head, body, progress);

	let record: RunRecord | null = null;
	let drawnStructure: string | null = null;

	const tick = () => {
		const duration = record ? runDuration(record) : null;
		when.textContent = !record ? '' : duration === null ? '' : isFinished(record) ? formatDuration(duration) : t('已运行 {duration}', { duration: formatDuration(duration) });
	};

	return {
		root,
		actions,
		tick,
		paint({ title: name, describe: what, record: shown, summary, reading = false }) {
			record = shown;
			title.textContent = name || t('未命名计算');
			title.classList.toggle('is-untitled', !name);
			state.hidden = !shown;
			if (shown) {
				state.textContent = RUN_STATE_NAMES[shown.state] ?? shown.state;
				state.dataset.state = shown.state;
			}
			root.dataset.state = shown?.state ?? 'none';
			tick();
			const running = Boolean(shown && !isFinished(shown));
			progress.hidden = !running;
			line.classList.toggle('is-problem', Boolean(summary?.problem));
			if (!shown) line.textContent = t('还没有运行');
			else if (summary?.problem) line.textContent = summary.problem;
			else if (running) line.textContent = summary?.progress ?? (shown.state === 'queued' ? t('在队列里等着') : shown.state === 'preparing' ? t('正在准备') : t('正在算'));
			else if (!summary && reading) line.textContent = t('正在读取结果…');
			else line.textContent = summary?.facts.join('  ·  ') || t('没有读出结果');
			describe.textContent = what;
			const structure = summary?.structure ?? null;
			if (structure !== drawnStructure) {
				drawnStructure = structure;
				const thumbnail = structure ? structureThumbnail(structure) : null;
				picture.replaceChildren(...(thumbnail ? [thumbnail] : []));
			}
			picture.hidden = !picture.hasChildNodes();
		},
	};
}
