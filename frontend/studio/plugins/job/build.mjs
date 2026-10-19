import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { FINISHED_STATES, JOB_LANGUAGE, RUN_STATE_NAMES, parseJobFence, runFolder } from '@blog/compute/job-fence.mjs';
import { describeJob, readJobOptions } from '@blog/compute/job-options.mjs';

/**
 * The blog's build: ```job fences (@blog/compute) become a figure the page
 * draws (page.ts): the job's name and what it does, the run the fence names
 * (its run.json, read here at build time, in `data-run`), and the structure
 * it started from, folded, under it.
 *
 * Reported for the check before publishing: a run the fence names that is
 * not in the article (`job-run`), one still going (`job-running`), and one
 * that did not end well (`job-failed`).
 */
export const name = 'block-job';
export const inject = ['blocks'];

export function apply(ctx) {
	ctx.blocks.register({ name, fence: JOB_LANGUAGE, remark: jobFigure });
}

/** What a ```job fence becomes in the page; `file` is the article's (its folder holds the runs). */
export function jobFigure(node, file) {
	const article = file.path ? dirname(file.path) : null;
	const fence = parseJobFence(node.meta, node.value);
	const place = { place: node.position, source: 'block-job' };
	const program = fence.program === 'crest' ? 'crest' : 'xtb';
	let record = null;
	if (fence.id && fence.run) {
		let folder = null;
		try {
			folder = runFolder(fence.id, fence.run);
		} catch {
			file.message(`计算块的 id=${fence.id} 或 run=${fence.run} 写得不对`, { ...place, ruleId: 'job-run' });
		}
		const path = article && folder ? join(article, ...folder.split('/'), 'run.json') : null;
		if (path && existsSync(path)) {
			try {
				record = JSON.parse(readFileSync(path, 'utf8'));
			} catch {
				file.message(`./${folder}/run.json 读不出来`, { ...place, ruleId: 'job-run' });
			}
		} else if (article && folder) {
			file.message(`计算块「${fence.title || fence.id}」显示的运行 ./${folder}/ 不在文章里`, { ...place, ruleId: 'job-run' });
		}
		if (record && !FINISHED_STATES.includes(record.state)) {
			file.message(`计算块「${fence.title || fence.id}」还在${RUN_STATE_NAMES[record.state] ?? record.state}，发布出去的是没算完的结果`, { ...place, ruleId: 'job-running' });
		} else if (record && record.state !== 'done') {
			file.message(`计算块「${fence.title || fence.id}」显示的运行${RUN_STATE_NAMES[record.state] ?? record.state}了`, { ...place, ruleId: 'job-failed' });
		}
	}
	const text = (value) => ({ type: 'text', value });
	const head = {
		type: 'element',
		tagName: 'header',
		properties: { className: ['note-job-head'] },
		children: [
			{ type: 'element', tagName: 'span', properties: { className: ['note-job-kind'] }, children: [text('计算')] },
			{ type: 'element', tagName: 'strong', properties: { className: ['note-job-title'] }, children: [text(fence.title || '未命名计算')] },
			{ type: 'element', tagName: 'span', properties: { className: ['note-job-summary'] }, children: [text(`${program === 'crest' ? 'CREST' : 'xtb'} · ${describeJob(program, readJobOptions(program, fence.args))}`)] },
		],
	};
	const result = {
		type: 'element',
		tagName: 'div',
		properties: { className: ['note-job-result'] },
		children: record ? [] : [{ type: 'element', tagName: 'p', properties: { className: ['note-job-empty'] }, children: [text('还没有运行')] }],
	};
	const input = {
		type: 'element',
		tagName: 'details',
		properties: { className: ['note-job-input'] },
		children: [
			{ type: 'element', tagName: 'summary', properties: {}, children: [text(`输入：${program} 输入文件 ${fence.args}`.trim())] },
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
