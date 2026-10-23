import { HARTREE_IN_EV, formulaOf } from '@blog/compute/parsers/qc/qc.mjs';
import { PUBLISHED_FOLDERS } from '@blog/markdown/articles/rules.mjs';

/**
 * A calculation's result, written in the article as a fence naming its
 * output (a Gaussian `.log`, an ORCA `.out`, in the article's assets/), and
 * a title of its own if it has one:
 *
 *     ```qc
 *     @file ./assets/co2-opt.log
 *     title: CO₂ 的优化和频率
 *     ```
 *
 * Shown as a card of two lines (what it found, and how it was done), its
 * details in a sheet: the same card in the Studio and on the blog. The output
 * is read by packages/compute/parsers/qc.
 */

export const QC_LANGUAGE = 'qc';
/** The files such a block shows, when their start says Gaussian or ORCA wrote them. */
export const QC_EXTENSIONS = ['log', 'out'];

/** @typedef {import('@blog/compute/parsers/qc/qc.mjs').QcOutput} QcOutput */
/** @typedef {{ file: string, title: string }} QcFence */

/** @returns {QcFence} */
export function parseQcFence(text) {
	const fence = { file: '', title: '' };
	for (const raw of String(text ?? '').split('\n')) {
		const line = raw.trim();
		const file = /^@file\s+(\S+)/u.exec(line);
		const title = /^title\s*[:：]\s*(.*)$/iu.exec(line);
		if (file) fence.file = file[1];
		else if (title) fence.title = title[1].trim();
	}
	return fence;
}

export function writeQcFence(/** @type {QcFence} */ fence) {
	return [fence.file ? `@file ${fence.file}` : '', fence.title ? `title: ${fence.title.replace(/\s+/gu, ' ').trim()}` : ''].filter(Boolean).join('\n');
}

/** The fence for a file of the article (`assets/co2.log`). */
export function qcMarkdown(/** @type {string} */ path) {
	return `\`\`\`${QC_LANGUAGE}\n@file ./${path}\n\`\`\``;
}

/** Where the fence's file is in the article (`assets/co2.log`); null when it is not one it publishes. */
export function qcFilePath(/** @type {string} */ file) {
	const path = file.replace(/^\.\//u, '');
	const [root, ...rest] = path.split('/');
	return PUBLISHED_FOLDERS.includes(root) && rest.length && !rest.includes('..') ? path : null;
}

const minus = (/** @type {string} */ text) => text.replace(/^-/u, '−');
/** CO2 → CO₂. */
const subscripts = (/** @type {string} */ formula) => formula.replace(/\d/gu, (digit) => '₀₁₂₃₄₅₆₇₈₉'[Number(digit)]);
const signed = (/** @type {number} */ value, /** @type {number} */ digits) => minus(value.toFixed(digits));

const JOB_NAMES = /** @type {Record<string, string>} */ ({ sp: '单点', opt: '优化', freq: '频率', td: '激发态', irc: 'IRC', scan: '扫描' });
const SPINS = ['', '单重态', '双重态', '三重态', '四重态', '五重态', '六重态'];

/** The program as the card names it: Gaussian 16, ORCA 6.0.1. */
export function qcProgramLabel(/** @type {QcOutput} */ result) {
	if (result.program === 'gaussian') return `Gaussian ${result.version?.split(' ')[0] ?? ''}`.trim();
	return `ORCA ${result.version ?? ''}`.trim();
}

/** What was done: B3LYP/def2-SVP · 优化＋频率 · CO₂ · 电荷 0 · 单重态. */
export function qcDescribe(/** @type {QcOutput} */ result) {
	const jobs = result.jobs.filter((job) => job !== 'ts').map((job) => (job === 'opt' && result.jobs.includes('ts') ? '过渡态优化' : JOB_NAMES[job] ?? job));
	const spin = result.multiplicity === null ? null : (SPINS[result.multiplicity] ?? `${result.multiplicity} 重态`);
	return [
		result.method && result.basis ? `${result.reference === 'U' ? 'U' : result.reference === 'RO' ? 'RO' : ''}${result.method}/${result.basis}` : result.method,
		jobs.join('＋'),
		result.atoms ? subscripts(formulaOf(result.atoms)) : null,
		result.charge === null ? null : `电荷 ${minus(String(result.charge))}`,
		spin,
	]
		.filter(Boolean)
		.join(' · ');
}

/** What went wrong, when something did: the optimization did not end, the program stopped on an error. */
export function qcProblem(/** @type {QcOutput} */ result) {
	if (result.optimization && !result.optimization.converged) {
		return result.terminated || result.errors.length ? `优化没有收敛（走了 ${result.optimization.cycles} 步就停了）` : `优化还没结束（第 ${result.optimization.cycles} 步）：输出不完整，可能还在算或被中断了`;
	}
	if (!result.terminated) return result.errors.length ? `出错结束：${result.errors.at(-1)}` : '没有正常结束：输出不完整，可能还在算或被中断了';
	if (result.errors.length) return result.errors[0];
	return null;
}

/** Its numbers on the card: energy, free energy, imaginary frequencies, ⟨S²⟩, excited states. */
export function qcFacts(/** @type {QcOutput} */ result) {
	const facts = [];
	if (result.energy !== null) facts.push(`E ${signed(result.energy, 6)} Eh`);
	if (result.thermo?.freeEnergy != null) facts.push(`G ${signed(result.thermo.freeEnergy, 6)} Eh`);
	if (result.imaginary === 0) facts.push('无虚频');
	else if (result.imaginary) {
		const imaginary = result.vibrations.filter((mode) => mode.frequency < 0).map((mode) => `${signed(mode.frequency, 1)}`);
		facts.push(`${result.imaginary} 个虚频（${imaginary.join('、')} cm⁻¹）`);
	}
	if (result.reference !== 'R' && result.s2 !== null) facts.push(`⟨S²⟩ ${result.s2.toFixed(4)}`);
	if (result.excited.length) {
		const lowest = result.excited[0];
		facts.push(`${result.excited.length} 个激发态，最低 ${lowest.energy.toFixed(2)} eV（${Math.round(lowest.wavelength)} nm）`);
	}
	if (!facts.length && result.homo !== null && result.lumo !== null) facts.push(`能隙 ${((result.lumo - result.homo) * HARTREE_IN_EV).toFixed(2)} eV`);
	return facts;
}

/** The final structure as XYZ (for its picture); null without one. */
export function qcStructure(/** @type {QcOutput} */ result) {
	if (!result.atoms?.length) return null;
	const rows = result.atoms.map((atom) => `${atom.symbol} ${atom.x.toFixed(6)} ${atom.y.toFixed(6)} ${atom.z.toFixed(6)}`);
	return `${result.atoms.length}\n${formulaOf(result.atoms)}\n${rows.join('\n')}\n`;
}

const el = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });
const txt = (value) => ({ type: 'text', value });

/**
 * The card (HAST): its kind (the program), its title (or the file's name), how it ended; what it
 * found, or what went wrong (`problem`, also when the output is not there or not one it reads);
 * how it was done. Its picture is drawn in the page (`.job-card-picture`, from `data-structure`).
 * @param {QcFence} fence
 * @param {{ result: QcOutput | null, problem?: string | null }} read
 */
export function qcCard(fence, { result, problem = null }) {
	const name = fence.title || fence.file.replace(/^.*\//u, '') || '计算结果';
	const trouble = problem ?? (result ? qcProblem(result) : null);
	const state = !result ? null : trouble ? (result.optimization && !result.optimization.converged ? '没收敛' : '出错') : '正常结束';
	const structure = result ? qcStructure(result) : null;
	return el('figure', { className: ['note-qc', 'job-card'], dataState: trouble ? 'failed' : 'done', ...(fence.file ? { dataFile: qcFilePath(fence.file) ?? fence.file } : {}), ...(structure ? { dataStructure: structure } : {}) }, [
		el('div', { className: ['job-card-head'] }, [
			el('span', { className: ['job-kind'] }, [txt(result ? qcProgramLabel(result) : '计算结果')]),
			el('span', { className: ['job-card-title'] }, [txt(name)]),
			...(state ? [el('span', { className: ['job-state'], dataState: trouble ? 'failed' : 'done' }, [txt(state)])] : []),
		]),
		el('div', { className: ['job-card-body'] }, [
			el('div', { className: ['job-card-picture'] }),
			el('div', { className: ['job-card-text'] }, [
				el('p', { className: ['job-card-line', ...(trouble ? ['is-problem'] : [])] }, [txt(trouble ?? (result ? qcFacts(result).join('  ·  ') || '没有读出结果' : ''))]),
				...(result ? [el('p', { className: ['job-card-describe'] }, [txt(qcDescribe(result))])] : []),
			]),
		]),
	]);
}

/** A server path left in an output (`/home/someone/…`), which publishing it would show; null when there is none. */
export function privatePath(/** @type {string} */ text) {
	return /(?:\/home|\/Users)\/[A-Za-z0-9._-]+/u.exec(text)?.[0] ?? null;
}
