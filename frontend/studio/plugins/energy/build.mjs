import { t } from '@blog/i18n/index.mjs';
import { ENERGY_LANGUAGE, energyFigure, parseEnergy } from './energy.mjs';

/**
 * The blog's build: an ```energy fence becomes its diagram (energy.mjs), SVG
 * drawn here; the page needs no script for it.
 *
 * Reported for the check before publishing: a line that is no species, a
 * species given two energies (`energy-line`), a diagram with none (`energy-empty`).
 */
export const name = 'block-energy';
export const inject = ['blocks'];

export function apply(ctx) {
	ctx.blocks.register({ name, fence: ENERGY_LANGUAGE, remark: energyBlock });
}

export function energyBlock(node, file) {
	const profile = parseEnergy(node.value);
	const place = { place: node.position, source: name };
	for (const problem of profile.problems) file.message(t('能量图第 {line} 行：{reason}', { line: problem.line, reason: problem.reason }), { ...place, ruleId: 'energy-line' });
	if (!profile.paths.length) file.message(t('能量图还没有数据'), { ...place, ruleId: 'energy-empty' });
	const figure = energyFigure(profile);
	return { type: 'energy', data: { hName: figure.tagName, hProperties: figure.properties, hChildren: figure.children } };
}
