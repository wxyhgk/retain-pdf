import { ensembleTable, parseCrestOutput } from '@blog/compute/parsers/crest.ts';
import { parseXyzFrames } from '@blog/compute/parsers/xyz-frames.ts';
import { conformerSection, fixed, numbers, runErrors, runFacts, signed, structureSection, type ProgramView } from '@blog/compute/browser/job-view.ts';

/**
 * A CREST run, drawn (in the browser): how many conformers, the lowest
 * energy, the table of conformers with each to look at; on its card the
 * count, the largest share and the lowest energy.
 */
export const crestView: ProgramView = {
	async draw(context) {
		const { record, optional, finished, output } = context;
		const [final, conformers] = await Promise.all([optional('crest_best.xyz'), finished ? optional('crest_conformers.xyz') : Promise.resolve(null)]);
		const out = output ? parseCrestOutput(output) : null;
		const ensemble = conformers ? parseXyzFrames(conformers) : [];
		const table = ensembleTable(ensemble);
		const parts: Array<HTMLElement | null> = [runFacts(record, out?.version ?? null), runErrors(context, out?.errors ?? [])];
		parts.push(numbers([
			['构象数', table.length ? String(table.length) : out?.conformers !== null && out?.conformers !== undefined ? String(out.conformers) : null],
			['最低能量', fixed(table[0] ? Math.min(...table.map((row) => row.energy)) : out?.lowest ?? null, 6, 'Eh')],
			['最低构象占比', table.length ? `${(Math.max(...table.map((row) => row.population)) * 100).toFixed(1)} %` : null],
		]));
		if (table.length) parts.push(conformerSection(ensemble, table));
		else if (final) parts.push(structureSection('最低能量构象', final));
		return parts;
	},
	async summarize(context, summary) {
		const { record, optional, finished, output, read } = context;
		const final = await optional('crest_best.xyz');
		if (final) summary.structure = final;
		const out = output ? parseCrestOutput(output) : null;
		if (finished && record.state === 'failed' && !summary.problem) summary.problem = out?.errors[0] ?? null;
		if (!finished) return;
		const conformers = record.files.includes('crest_conformers.xyz') ? await read('crest_conformers.xyz').catch(() => null) : null;
		const table = conformers ? ensembleTable(parseXyzFrames(conformers)) : [];
		if (table.length) summary.facts.push(`${table.length} 个构象`, `最低占比 ${(Math.max(...table.map((row) => row.population)) * 100).toFixed(1)}%`);
		else if (out?.conformers) summary.facts.push(`${out.conformers} 个构象`);
		if (out?.lowest !== null && out?.lowest !== undefined) summary.facts.push(`E ${signed(out.lowest, 5)} Eh`);
	},
};
