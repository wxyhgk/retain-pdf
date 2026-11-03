import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { FINISHED_STATES, JOB_LANGUAGE, parseJobFence, runFolder } from '@blog/compute/job-fence.mjs';
import { JobPrograms } from '@blog/compute/programs.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * The blog's build: ```job fences (@blog/compute) become a figure the page
 * draws (page.ts): the job's name and what it does, the run the fence names
 * (its run.json, read here at build time, in `data-run`), and the structure
 * it started from, folded, under it.
 *
 * The programs are plugins of their own (plugins/xtb, plugins/crest), in
 * `ctx.jobs`, which this one provides.
 *
 * Reported for the check before publishing: a program no plugin knows
 * (`job-program`), a run the fence names that is not in the article
 * (`job-run`), one still going (`job-running`), and one that did not end
 * well (`job-failed`).
 */
export const name = 'block-job';
export const inject = ['blocks'];

export async function apply(ctx) {
	await ctx.plugin(JobPrograms);
	const programs = ctx.get('jobs');
	ctx.blocks.register({ name, fence: JOB_LANGUAGE, remark: (node, file) => jobFigure(node, file, programs) });
}

/** What the check says of a run shown that has not finished, by its state. */
function unfinishedRun(title, state) {
	if (state === 'preparing') return t('计算块「{title}」还在准备中，发布出去的是没算完的结果', { title });
	if (state === 'queued') return t('计算块「{title}」还在排队中，发布出去的是没算完的结果', { title });
	if (state === 'running') return t('计算块「{title}」还在运行中，发布出去的是没算完的结果', { title });
	return t('计算块「{title}」还在{state}，发布出去的是没算完的结果', { title, state });
}

/** What the check says of a run shown that ended without being done, by its state. */
function endedRun(title, state) {
	if (state === 'failed') return t('计算块「{title}」显示的运行失败了', { title });
	if (state === 'cancelled') return t('计算块「{title}」显示的运行已停止了', { title });
	if (state === 'lost') return t('计算块「{title}」显示的运行失去联系了', { title });
	return t('计算块「{title}」显示的运行{state}了', { title, state });
}

/**
 * What a ```job fence becomes in the page; `file` is the article's (its
 * folder holds the runs), `programs` the programs there are (`ctx.jobs`).
 */
export function jobFigure(node, file, programs) {
	const article = file.path ? dirname(file.path) : null;
	const fence = parseJobFence(node.meta, node.value);
	const place = { place: node.position, source: 'block-job' };
	const program = programs.get(fence.program);
	if (!program) file.message(t('计算块「{title}」用的程序 {program} 没有插件认识（plugins/ 里没有注册它的）', { title: fence.title || fence.id, program: fence.program }), { ...place, ruleId: 'job-program' });
	let record = null;
	if (fence.id && fence.run) {
		let folder = null;
		try {
			folder = runFolder(fence.id, fence.run);
		} catch {
			file.message(t('计算块的 id={id} 或 run={run} 写得不对', { id: fence.id, run: fence.run }), { ...place, ruleId: 'job-run' });
		}
		const path = article && folder ? join(article, ...folder.split('/'), 'run.json') : null;
		if (path && existsSync(path)) {
			try {
				record = JSON.parse(readFileSync(path, 'utf8'));
			} catch {
				file.message(t('./{folder}/run.json 读不出来', { folder }), { ...place, ruleId: 'job-run' });
			}
		} else if (article && folder) {
			file.message(t('计算块「{title}」显示的运行 ./{folder}/ 不在页面里', { title: fence.title || fence.id, folder }), { ...place, ruleId: 'job-run' });
		}
		if (record && !FINISHED_STATES.includes(record.state)) {
			file.message(unfinishedRun(fence.title || fence.id, record.state), { ...place, ruleId: 'job-running' });
		} else if (record && record.state !== 'done') {
			file.message(endedRun(fence.title || fence.id, record.state), { ...place, ruleId: 'job-failed' });
		}
	}
	const text = (value) => ({ type: 'text', value });
	const head = {
		type: 'element',
		tagName: 'header',
		properties: { className: ['note-job-head'] },
		children: [
			{ type: 'element', tagName: 'span', properties: { className: ['note-job-kind'] }, children: [text('计算')] }, // i18n-ignore: the blog's page
			{ type: 'element', tagName: 'strong', properties: { className: ['note-job-title'] }, children: [text(fence.title || '未命名计算')] }, // i18n-ignore: the blog's page
			{ type: 'element', tagName: 'span', properties: { className: ['note-job-summary'] }, children: [text(program ? `${program.label} · ${program.describe(program.read(fence.args))}` : `${fence.program} · ${fence.args}`.trim())] },
		],
	};
	const result = {
		type: 'element',
		tagName: 'div',
		properties: { className: ['note-job-result'] },
		children: record ? [] : [{ type: 'element', tagName: 'p', properties: { className: ['note-job-empty'] }, children: [text('还没有运行')] }], // i18n-ignore: the blog's page
	};
	const input = {
		type: 'element',
		tagName: 'details',
		properties: { className: ['note-job-input'] },
		children: [
			{ type: 'element', tagName: 'summary', properties: {}, children: [text(`输入：${fence.program} 输入文件 ${fence.args}`.trim())] }, // i18n-ignore: the blog's page
			{ type: 'element', tagName: 'pre', properties: {}, children: [{ type: 'element', tagName: 'code', properties: {}, children: [text(node.value)] }] },
		],
	};
	return {
		type: 'job',
		data: {
			hName: 'figure',
			hProperties: { className: ['note-job'], ...(record ? { dataRun: JSON.stringify(record) } : {}) },
			hChildren: [head, result, input],
		},
	};
}
