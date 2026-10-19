import { HARTREE_IN_KCAL } from '@blog/compute/parsers/crest.ts';
import { parseG98Modes, parseVibSpectrum, parseXtbOutput } from '@blog/compute/parsers/xtb.ts';
import { parseXyzFrames } from '@blog/compute/parsers/xyz-frames.ts';
import { energyChart, fixed, notes, numbers, runErrors, runFacts, section, signed, structureSection, vibrationSection, type ProgramView } from '@blog/compute/browser/job-view.ts';

/**
 * An xtb run, drawn (in the browser): its numbers, an optimization's steps,
 * the IR spectrum with each mode to watch vibrate, the structure it ends at;
 * on its card the energies, the gap, the imaginary frequencies, or the step
 * it is at.
 */
export const xtbView: ProgramView = {
	async draw(context) {
		const { record, optional, finished, output, input } = context;
		const [steps, final, spectrum, modes] = await Promise.all([
			optional('xtbopt.log'),
			optional('xtbopt.xyz'),
			finished ? optional('vibspectrum') : Promise.resolve(null),
			finished ? optional('g98.out') : Promise.resolve(null),
		]);
		const out = output ? parseXtbOutput(output) : null;
		const parts: Array<HTMLElement | null> = [runFacts(record, out?.version ?? null), runErrors(context, out?.errors ?? []), notes('warning', finished ? out?.warnings ?? [] : [])];
		if (out) {
			parts.push(numbers([
				['总能量', fixed(out.energy, 6, 'Eh')],
				['自由能 G', fixed(out.freeEnergy, 6, 'Eh')],
				['焓 H', fixed(out.enthalpy, 6, 'Eh')],
				['HOMO–LUMO 能隙', fixed(out.gap, 3, 'eV')],
				['梯度范数', out.gradientNorm === null ? null : `${out.gradientNorm.toExponential(2)} Eh/α`],
				['偶极矩', fixed(out.dipole, 3, 'D')],
				['虚频', out.imaginary === null ? null : String(out.imaginary)],
				['溶剂', out.solvation ? `${out.solvation.solvent}（${out.solvation.model}）` : null],
			]));
		}
		const frames = steps ? parseXyzFrames(steps) : [];
		const points = frames.length >= 2 ? frames : out?.optimization?.steps ?? [];
		if (points.length >= 2) parts.push(section('优化过程', energyChart(points as Array<{ energy: number; gradientNorm: number | null }>, { live: !finished })));
		const spectrumModes = spectrum ? parseVibSpectrum(spectrum) : [];
		const normal = modes ? parseG98Modes(modes) : null;
		if (spectrumModes.length) parts.push(vibrationSection(spectrumModes, normal));
		else if (finished && (final || input)) parts.push(structureSection(final ? '优化后的结构' : '结构', (final ?? input) as string));
		return parts;
	},
	async summarize(context, summary) {
		const { record, optional, finished, output } = context;
		const final = finished ? await optional('xtbopt.xyz') : null;
		if (final) summary.structure = final;
		const out = output ? parseXtbOutput(output) : null;
		if (finished && record.state === 'failed' && !summary.problem) summary.problem = out?.errors.find((line) => /^-1-/u.test(line))?.replace(/^-1-\s*/u, '') ?? out?.errors[0] ?? null;
		if (!finished) {
			const steps = out?.optimization?.steps ?? [];
			if (steps.length) {
				const last = steps.at(-1)!;
				const change = steps.length > 1 ? (last.energy - steps.at(-2)!.energy) * HARTREE_IN_KCAL : null;
				summary.progress = `第 ${last.cycle} 步${change === null ? '' : ` · ΔE ${signed(change, 3)} kcal/mol`}`;
			}
			return;
		}
		if (out?.energy !== null && out?.energy !== undefined) summary.facts.push(`E ${signed(out.energy, 5)} Eh`);
		if (out?.freeEnergy !== null && out?.freeEnergy !== undefined) summary.facts.push(`G ${signed(out.freeEnergy, 5)} Eh`);
		if (out?.gap !== null && out?.gap !== undefined) summary.facts.push(`能隙 ${out.gap.toFixed(2)} eV`);
		if (out?.imaginary !== null && out?.imaginary !== undefined) summary.facts.push(out.imaginary ? `${out.imaginary} 个虚频` : '无虚频');
		for (const warning of out?.warnings ?? []) if (!/虚频/u.test(warning)) summary.facts.push(warning);
	},
};
