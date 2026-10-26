import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { parseQcOutput } from '@blog/compute/parsers/qc/qc.mjs';
import { t } from '@blog/i18n/index.mjs';
import { QC_LANGUAGE, parseQcFence, privatePath, qcCard, qcFilePath, qcProblem } from './qc-card.mjs';

/**
 * The blog's build: a ```qc fence becomes its card (qc-card.mjs), the output
 * it names read here: what it found is in the page without a script, the
 * page (page.ts) opens its details from the published output.
 *
 * Reported for the check before publishing: no output, or one not in the
 * article (`qc-file`); one neither Gaussian's nor ORCA's (`qc-unknown`); a
 * calculation that did not end well (`qc-failed`); a server's path left in the
 * output, which publishing shows (`qc-private`).
 */
export const name = 'block-qc';
export const inject = ['blocks'];

export function apply(ctx) {
	ctx.blocks.register({ name, fence: QC_LANGUAGE, remark: qcFigure });
}

export function qcFigure(node, file) {
	const fence = parseQcFence(node.value);
	const place = { place: node.position, source: name };
	const report = (reason, ruleId) => file.message(reason, { ...place, ruleId });
	const path = fence.file ? qcFilePath(fence.file) : null;
	const target = path && file.path ? join(dirname(file.path), ...path.split('/')) : null;
	let result = null;
	let problem = null;
	if (!fence.file) {
		problem = '还没有选输出文件'; // i18n-ignore: the blog's page
		report(t('计算结果块还没有选输出文件'), 'qc-file');
	} else if (!path) {
		problem = `${fence.file} 不在文章的 img/ 或 assets/ 里`; // i18n-ignore: the blog's page
		report(t('计算结果的输出 {file} 不在文章的 img/ 或 assets/ 里，发布后读不到', { file: fence.file }), 'qc-file');
	} else if (target && (!existsSync(target) || !statSync(target).isFile())) {
		problem = `找不到 ./${path}`; // i18n-ignore: the blog's page
		report(t('找不到计算结果的输出 ./{path}', { path }), 'qc-file');
	} else if (target) {
		const text = readFileSync(target, 'utf8');
		result = parseQcOutput(text);
		if (!result) {
			problem = t('./{path} 认不出是 Gaussian 或 ORCA 的输出', { path });
			report(problem, 'qc-unknown');
		} else {
			const trouble = qcProblem(result);
			if (trouble) report(t('计算结果 ./{path}：{problem}', { path, problem: trouble }), 'qc-failed');
		}
		const shown = privatePath(text);
		if (shown) report(t('./{path} 里有服务器上的路径 {serverPath}，发布后谁都能看到', { path, serverPath: shown }), 'qc-private');
	}
	const card = qcCard(fence, { result, problem });
	return { type: 'qc', data: { hName: card.tagName, hProperties: card.properties, hChildren: card.children } };
}
