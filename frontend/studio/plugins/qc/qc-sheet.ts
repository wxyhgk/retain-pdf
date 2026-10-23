import { energyChart, fixed, formatDuration, notes, numbers, section, signed, structureSection, structureThumbnail, vibrationSection } from '@blog/compute/browser/job-view.ts';
import { HARTREE_IN_EV, type QcOutput } from '@blog/compute/parsers/qc/qc.mjs';
import { openBlockSheet, type OpenSheet, type SheetTab } from '@blog/ui/block-sheet.ts';

import { qcDescribe, qcProblem, qcProgramLabel, qcStructure } from './qc-card.mjs';

/**
 * A calculation's result in the browser (the blog's page and the Studio): its
 * card's picture, and its sheet: what it found (the numbers, the optimization,
 * the vibrations to watch and the IR spectrum, the structure, the excited
 * states), and the output itself.
 */

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
	const made = document.createElement(tag);
	if (className) made.className = className;
	if (text !== undefined) made.textContent = text;
	return made;
}

/** The card's small picture of its structure (`data-structure`, drawn into `.job-card-picture`). */
export function paintPicture(card: HTMLElement): void {
	const picture = card.querySelector<HTMLElement>('.job-card-picture');
	if (!picture) return;
	const thumbnail = card.dataset.structure ? structureThumbnail(card.dataset.structure) : null;
	picture.replaceChildren(...(thumbnail ? [thumbnail] : []));
	picture.hidden = !thumbnail;
}

const eh = (value: number | null) => (value === null ? null : `${signed(value, 6)} Eh`);
const orbital = (value: number | null) => (value === null ? null : `${signed(value, 5)} Eh（${signed(value * HARTREE_IN_EV, 2)} eV）`);

/** What a calculation found, drawn into `root`. */
export function drawResult(root: HTMLElement, result: QcOutput): void {
	const problem = qcProblem(result);
	const imaginary = result.vibrations.filter((mode) => mode.frequency < 0);
	const parts: Array<HTMLElement | null> = [
		element('p', 'job-section-note', `${qcProgramLabel(result)} · ${qcDescribe(result)}`),
		notes('error', problem ? [problem, ...result.errors.filter((error) => error !== problem)] : []),
		numbers([
			['能量 E', eh(result.energy)],
			['零点能校正', result.thermo?.zpe == null ? null : `${result.thermo.zpe.toFixed(6)} Eh`],
			['焓 H', eh(result.thermo?.enthalpy ?? null)],
			['自由能 G', eh(result.thermo?.freeEnergy ?? null)],
			['温度', result.thermo?.temperature == null ? null : `${result.thermo.temperature} K`],
			['HOMO', orbital(result.homo)],
			['LUMO', orbital(result.lumo)],
			['HOMO–LUMO 能隙', result.homo === null || result.lumo === null ? null : `${((result.lumo - result.homo) * HARTREE_IN_EV).toFixed(3)} eV`],
			['⟨S²⟩', result.reference === 'R' || result.s2 === null ? null : result.s2.toFixed(4)],
			['偶极矩', fixed(result.dipole, 3, 'D')],
			['虚频', result.imaginary === null ? null : imaginary.length ? imaginary.map((mode) => `${signed(mode.frequency, 1)} cm⁻¹`).join('、') : '无'],
			['用时', result.wallTime === null ? null : formatDuration(result.wallTime)],
		]),
	];
	if (result.steps.length >= 2) {
		const chart = section('优化过程', energyChart(result.steps.map((energy) => ({ energy, gradientNorm: null }))));
		chart.querySelector('.job-section-title')?.append(element('span', 'job-section-note', ` ${result.optimization?.cycles ?? result.steps.length} 步，${result.optimization?.converged ? '已收敛' : '没有收敛'}`));
		parts.push(chart);
	}
	const structure = qcStructure(result);
	if (result.vibrations.length && result.atoms) {
		const modes = result.vibrations.map((mode, index) => ({ mode: index + 1, frequency: mode.frequency, intensity: mode.intensity ?? 0 }));
		const normal = { atoms: result.atoms, modes: result.vibrations.map((mode) => ({ frequency: mode.frequency, intensity: mode.intensity ?? 0, displacements: mode.displacements })) };
		parts.push(vibrationSection(modes, normal));
	} else if (structure) {
		parts.push(structureSection(result.optimization ? '最后的结构' : '结构', structure));
	}
	if (result.excited.length) {
		const table = element('table', 'qc-excited');
		const head = element('tr');
		for (const name of ['态', '激发能', '波长', '振子强度 f', '对称性']) head.append(element('th', '', name));
		table.append(head);
		for (const state of result.excited) {
			const row = element('tr');
			for (const value of [String(state.state), `${state.energy.toFixed(3)} eV`, `${state.wavelength.toFixed(1)} nm`, state.strength.toFixed(4), state.symmetry ?? '']) row.append(element('td', '', value));
			table.append(row);
		}
		parts.push(section('激发态', table));
	}
	root.replaceChildren(...parts.filter((part): part is HTMLElement => part !== null));
}

/** The output itself: its last lines when long, the whole file a link away. */
export function drawOutput(root: HTMLElement, text: string, url: string, name: string): void {
	const lines = text.split(/\r?\n/u);
	const shown = lines.length > 4000 ? lines.slice(-4000) : lines;
	const head = element('p', 'job-section-note', lines.length > shown.length ? `${name}，最后 ${shown.length} 行（共 ${lines.length} 行）` : `${name}，${lines.length} 行`);
	const link = element('a', 'job-log-link', '打开文件');
	link.href = url;
	link.target = '_blank';
	link.rel = 'noopener';
	head.append(' · ', link);
	root.replaceChildren(head, element('pre', 'job-log-text qc-output', shown.join('\n')));
}

export type QcSheet = { title: string; result: QcOutput | null; text: string | null; url: string; name: string; problem?: string | null; extraTabs?: SheetTab[] };

/** Its sheet: 结果, 输出 (and what the Studio adds: 设置). */
export function openQcSheet(sheet: QcSheet): OpenSheet {
	const { result, text } = sheet;
	return openBlockSheet({
		kind: result ? qcProgramLabel(result) : '计算结果',
		title: sheet.title,
		tabs: [
			{
				key: 'result',
				label: '结果',
				draw: (panel) => {
					if (result) drawResult(panel, result);
					else panel.append(notes('error', [sheet.problem ?? '没有读出结果'])!);
				},
			},
			...(text === null ? [] : [{ key: 'output', label: '输出', draw: (panel: HTMLElement) => drawOutput(panel, text, sheet.url, sheet.name) }]),
			...(sheet.extraTabs ?? []),
		],
	});
}
