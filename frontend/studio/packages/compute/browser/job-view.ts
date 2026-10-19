import { load3Dmol, type ThreeDMolViewer } from '@blog/science/browser/molecule-renderer.ts';
import { RUN_STATE_NAMES } from '../job-fence.mjs';
import { ensembleTable, HARTREE_IN_KCAL, parseCrestOutput } from '../parsers/crest.ts';
import { modeToXyz, parseG98Modes, parseVibSpectrum, parseXtbOutput, type VibrationalMode } from '../parsers/xtb.ts';
import { formulaOf, frameToXyz, parseXyzFrames, type XyzFrame } from '../parsers/xyz-frames.ts';
import './job-view.css';

/**
 * A run of a job drawn as its results, on the blog and in the Studio alike:
 * what it is doing or how it ended, its numbers, the structure it ends at,
 * the optimization's energy step by step, the IR spectrum with each mode to
 * watch vibrate, CREST's conformers, and the end of its output. Everything
 * is read from the run's files, through `read` (a name in the run's folder).
 */

export type RunRecord = {
	format: number;
	id: string;
	run: string;
	program: 'xtb' | 'crest';
	args: string;
	command: string;
	host: string;
	hostLabel?: string;
	scheduler?: 'direct' | 'slurm';
	threads?: number;
	input: string;
	output: string;
	state: 'preparing' | 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'lost';
	created: string;
	started: string | null;
	finished: string | null;
	exitCode: number | null;
	error: string | null;
	problem?: string | null;
	files: string[];
};

export type ReadRunFile = (name: string) => Promise<string | null>;

const FINISHED = new Set(['done', 'failed', 'cancelled', 'lost']);

export function isFinished(record: RunRecord): boolean {
	return FINISHED.has(record.state);
}

/** `1 分 05 秒`, `2 时 03 分`, `0.4 秒`. */
export function formatDuration(seconds: number): string {
	if (seconds < 10) return `${Number(seconds.toFixed(1))} 秒`;
	if (seconds < 60) return `${Math.round(seconds)} 秒`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes} 分 ${String(Math.round(seconds % 60)).padStart(2, '0')} 秒`;
	return `${Math.floor(minutes / 60)} 时 ${String(minutes % 60).padStart(2, '0')} 分`;
}

/** How long it has run or ran, from run.json's times. */
export function runDuration(record: RunRecord, now = Date.now()): number | null {
	if (!record.started) return null;
	const end = record.finished ? Date.parse(record.finished) : now;
	return Math.max(0, (end - Date.parse(record.started)) / 1000);
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

const SVG = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
	const node = document.createElementNS(SVG, tag);
	for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
	return node;
}

/** The line under the block's head: state, machine, time, version. */
export function runFacts(record: RunRecord, version: string | null): HTMLElement {
	const facts = element('div', 'job-facts');
	const state = element('span', 'job-state', RUN_STATE_NAMES[record.state] ?? record.state);
	state.dataset.state = record.state;
	facts.append(state);
	const parts = [record.hostLabel || record.host];
	if (record.scheduler === 'slurm') parts[0] += '（Slurm）';
	const duration = runDuration(record);
	if (duration !== null) parts.push(isFinished(record) ? `用时 ${formatDuration(duration)}` : `已运行 ${formatDuration(duration)}`);
	if (record.threads) parts.push(`${record.threads} 线程`);
	if (version) parts.push(`${record.program} ${version}`);
	parts.push(record.run.replace(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2}).*$/u, '$1/$2/$3 $4:$5'));
	facts.append(element('span', 'job-fact', parts.join(' · ')));
	return facts;
}

function numbers(rows: Array<[string, string | null]>): HTMLElement | null {
	const shown = rows.filter((row): row is [string, string] => row[1] !== null);
	if (!shown.length) return null;
	const list = element('dl', 'job-numbers');
	for (const [name, value] of shown) {
		const item = element('div', 'job-number');
		item.append(element('dt', '', name), element('dd', '', value));
		list.append(item);
	}
	return list;
}

const fixed = (value: number | null, digits: number, unit: string) => (value === null ? null : `${value.toFixed(digits)} ${unit}`);

function notes(kind: 'error' | 'warning', lines: string[]): HTMLElement | null {
	if (!lines.length) return null;
	const box = element('div', `job-note is-${kind}`);
	box.setAttribute('role', kind === 'error' ? 'alert' : 'note');
	for (const line of lines) box.append(element('p', '', line));
	return box;
}

/** A 3D view of a structure, which `show` changes: another frame, or a mode vibrating. */
export function moleculeStage(label: string): { root: HTMLElement; show(xyz: string, options?: { vibrate?: boolean }): Promise<void> } {
	const root = element('div', 'job-stage');
	root.setAttribute('role', 'img');
	root.setAttribute('aria-label', label);
	let viewer: ThreeDMolViewer | null = null;
	let view: number[] | null = null;
	return {
		root,
		async show(xyz, { vibrate = false } = {}) {
			const $3Dmol = await load3Dmol();
			if (!root.isConnected) return;
			if (!viewer) {
				root.textContent = '';
				viewer = $3Dmol.createViewer(root, { backgroundColor: document.documentElement.dataset.theme === 'dark' ? '#181c1b' : '#ffffff' });
				const theme = (event: Event) => {
					if (!root.isConnected) return window.removeEventListener('themechange', theme);
					viewer?.setBackgroundColor((event as CustomEvent<string>).detail === 'dark' ? '#181c1b' : '#ffffff');
					viewer?.render();
				};
				window.addEventListener('themechange', theme);
			} else {
				view = viewer.getView();
			}
			const extended = viewer as ThreeDMolViewer & { clear(): void; stopAnimate(): void; animate(options: object): void; addModel(source: string, format: string, options?: object): unknown };
			extended.stopAnimate();
			extended.clear();
			extended.addModel(xyz, 'xyz', vibrate ? { vibrate: { frames: 12, amplitude: 1.2 } } : undefined);
			viewer.setStyle({}, { stick: { radius: 0.16 }, sphere: { scale: 0.28 } });
			if (view) viewer.setView(view, true);
			else viewer.zoomTo();
			if (vibrate) extended.animate({ loop: 'backAndForth', interval: 60 });
			viewer.render();
			viewer.resize();
		},
	};
}

/** Energies step by step, kcal/mol above the last, with the gradient's norm under them. */
export function energyChart(points: Array<{ energy: number; gradientNorm: number | null }>, { live = false } = {}): HTMLElement {
	const figure = element('figure', 'job-chart');
	const width = 560;
	const height = 200;
	const pad = { left: 52, right: 12, top: 12, bottom: 30 };
	const last = points.at(-1)?.energy ?? 0;
	const values = points.map((point) => (point.energy - last) * HARTREE_IN_KCAL);
	const top = Math.max(...values, 1e-6);
	const bottom = Math.min(...values, 0);
	const x = (index: number) => pad.left + (points.length > 1 ? (index / (points.length - 1)) * (width - pad.left - pad.right) : 0);
	const y = (value: number) => pad.top + ((top - value) / (top - bottom || 1)) * (height - pad.top - pad.bottom);
	const chart = svg('svg', { viewBox: `0 0 ${width} ${height}`, class: 'job-chart-svg', role: 'img', 'aria-label': `优化过程：${points.length} 步的能量` });
	for (const tick of [top, (top + bottom) / 2, bottom]) {
		chart.append(svg('line', { x1: pad.left, x2: width - pad.right, y1: y(tick), y2: y(tick), class: 'job-grid' }));
		const label = svg('text', { x: pad.left - 6, y: y(tick) + 4, class: 'job-axis', 'text-anchor': 'end' });
		label.textContent = tick.toFixed(tick >= 10 ? 1 : 2);
		chart.append(label);
	}
	chart.append(svg('polyline', { points: values.map((value, index) => `${x(index)},${y(value)}`).join(' '), class: 'job-line' }));
	values.forEach((value, index) => chart.append(svg('circle', { cx: x(index), cy: y(value), r: 2.4, class: 'job-dot' })));
	const axis = svg('text', { x: (width + pad.left) / 2, y: height - 6, class: 'job-axis', 'text-anchor': 'middle' });
	axis.textContent = `步数（共 ${points.length} 步${live ? '，还在算' : ''}）`;
	chart.append(axis);
	const unit = svg('text', { x: 12, y: (height - pad.bottom) / 2, class: 'job-axis', 'text-anchor': 'middle', transform: `rotate(-90 12 ${(height - pad.bottom) / 2})` });
	unit.textContent = 'ΔE / kcal·mol⁻¹';
	chart.append(unit);
	const caption = element('figcaption', '', '结构优化：每一步的能量（相对最后一步）');
	figure.append(chart, caption);
	return figure;
}

/** An IR spectrum: each mode a stick, under the curve they make broadened (Lorentzian, 20 cm⁻¹ wide). */
export function irSpectrum(modes: VibrationalMode[], { selected = -1, pick }: { selected?: number; pick?: (index: number) => void } = {}): SVGSVGElement {
	const width = 560;
	const height = 190;
	const pad = { left: 14, right: 14, top: 10, bottom: 30 };
	const from = 4000;
	const to = 400;
	const strongest = Math.max(...modes.map((mode) => mode.intensity), 1e-9);
	const x = (wavenumber: number) => pad.left + ((from - wavenumber) / (from - to)) * (width - pad.left - pad.right);
	const base = height - pad.bottom;
	const chart = svg('svg', { viewBox: `0 0 ${width} ${height}`, class: 'job-chart-svg', role: 'img', 'aria-label': `红外光谱：${modes.length} 个振动` });
	const half = 10;
	const curve: number[] = [];
	for (let wavenumber = from; wavenumber >= to; wavenumber -= 4) {
		curve.push(modes.reduce((sum, mode) => sum + (mode.intensity * half * half) / ((wavenumber - mode.frequency) ** 2 + half * half), 0));
	}
	const peak = Math.max(...curve, 1e-9);
	chart.append(svg('polyline', { points: curve.map((value, index) => `${x(from - index * 4)},${base - (value / peak) * (base - pad.top)}`).join(' '), class: 'job-line is-soft' }));
	modes.forEach((mode, index) => {
		if (mode.frequency < to || mode.frequency > from) return;
		const stick = svg('line', { x1: x(mode.frequency), x2: x(mode.frequency), y1: base, y2: base - (mode.intensity / strongest) * (base - pad.top), class: `job-stick${index === selected ? ' is-selected' : ''}` });
		if (pick) {
			stick.addEventListener('click', () => pick(index));
			const hit = svg('rect', { x: x(mode.frequency) - 4, y: pad.top, width: 8, height: base - pad.top, class: 'job-hit' });
			const title = svg('title');
			title.textContent = `${mode.frequency.toFixed(1)} cm⁻¹ · ${mode.intensity.toFixed(1)} km/mol`;
			hit.append(title);
			hit.addEventListener('click', () => pick(index));
			chart.append(hit);
		}
		chart.append(stick);
	});
	chart.append(svg('line', { x1: pad.left, x2: width - pad.right, y1: base, y2: base, class: 'job-grid' }));
	for (const tick of [4000, 3000, 2000, 1500, 1000, 500]) {
		const label = svg('text', { x: x(tick), y: height - 10, class: 'job-axis', 'text-anchor': 'middle' });
		label.textContent = String(tick);
		chart.append(label);
	}
	return chart;
}

function section(title: string, ...children: Array<Node | null>): HTMLElement {
	const part = element('section', 'job-section');
	part.append(element('p', 'job-section-title', title), ...children.filter((child): child is Node => child !== null));
	return part;
}

function outputTail(record: RunRecord, text: string | null, url: string | null, open: boolean): HTMLElement | null {
	if (text === null) return null;
	const details = element('details', 'job-log');
	details.open = open;
	const summary = element('summary', '', `输出 ${record.output}`);
	details.append(summary);
	const lines = text.split(/\r?\n/u);
	const tail = lines.slice(-200).join('\n');
	const pre = element('pre', 'job-log-text', tail);
	details.append(pre);
	if (url) {
		const link = element('a', 'job-log-link', lines.length > 200 ? `完整文件（${lines.length} 行）` : '打开文件');
		link.href = url;
		link.target = '_blank';
		link.rel = 'noopener';
		details.append(link);
	}
	// Following a run: the newest lines in view.
	if (open) queueMicrotask(() => (pre.scrollTop = pre.scrollHeight));
	return details;
}

export type DrawOptions = {
	/** The URL a file of the run is at, for links to open it. */
	url?: (name: string) => string | null;
	/** Show the output open (the Studio does while a run goes). */
	followOutput?: boolean;
};

/**
 * Draws a run into `root`, replacing what was there. Resolves when the
 * files it needs are read; 3D views fill in after.
 */
export async function drawRun(root: HTMLElement, record: RunRecord, read: ReadRunFile, options: DrawOptions = {}): Promise<void> {
	const has = (name: string) => record.files.includes(name) || !isFinished(record);
	const optional = (name: string) => (has(name) ? read(name).catch(() => null) : Promise.resolve(null));
	const [output, steps, final, spectrum, modes, conformers] = await Promise.all([
		optional(record.output),
		record.program === 'xtb' ? optional('xtbopt.log') : Promise.resolve(null),
		record.program === 'xtb' ? optional('xtbopt.xyz') : optional('crest_best.xyz'),
		record.program === 'xtb' && isFinished(record) ? optional('vibspectrum') : Promise.resolve(null),
		record.program === 'xtb' && isFinished(record) ? optional('g98.out') : Promise.resolve(null),
		record.program === 'crest' && isFinished(record) ? optional('crest_conformers.xyz') : Promise.resolve(null),
	]);
	const input = await read(record.input).catch(() => null);
	const parts: Array<HTMLElement | null> = [];
	const finished = isFinished(record);

	if (record.program === 'crest') {
		const out = output ? parseCrestOutput(output) : null;
		parts.push(runFacts(record, out?.version ?? null));
		parts.push(notes('error', [record.error, record.problem, ...(finished && record.state !== 'done' ? out?.errors ?? [] : [])].filter((line): line is string => Boolean(line))));
		const ensemble = conformers ? parseXyzFrames(conformers) : [];
		const table = ensembleTable(ensemble);
		parts.push(numbers([
			['构象数', table.length ? String(table.length) : out?.conformers !== null && out?.conformers !== undefined ? String(out.conformers) : null],
			['最低能量', fixed(table[0] ? Math.min(...table.map((row) => row.energy)) : out?.lowest ?? null, 6, 'Eh')],
			['最低构象占比', table.length ? `${(Math.max(...table.map((row) => row.population)) * 100).toFixed(1)} %` : null],
		]));
		if (table.length) parts.push(conformerSection(ensemble, table));
		else if (final) parts.push(structureSection('最低能量构象', final));
	} else {
		const out = output ? parseXtbOutput(output) : null;
		parts.push(runFacts(record, out?.version ?? null));
		const errors = [record.error, record.problem, ...(finished && record.state !== 'done' ? out?.errors ?? [] : [])].filter((line): line is string => Boolean(line));
		parts.push(notes('error', errors));
		parts.push(notes('warning', finished ? out?.warnings ?? [] : []));
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
	}
	parts.push(outputTail(record, output, options.url?.(record.output) ?? null, Boolean(options.followOutput) && !finished));
	root.replaceChildren(...parts.filter((part): part is HTMLElement => part !== null));
}

function structureSection(title: string, xyz: string): HTMLElement {
	const frames = parseXyzFrames(xyz);
	const stage = moleculeStage(`${title}，可拖动旋转`);
	const part = section(title, stage.root);
	if (frames[0]) part.querySelector('.job-section-title')?.append(element('span', 'job-section-note', ` ${formulaOf(frames[0].atoms)} · ${frames[0].atoms.length} 个原子`));
	queueMicrotask(() => void stage.show(frames[0] ? frameToXyz(frames[0]) : xyz).catch(() => (stage.root.textContent = '三维结构画不出来')));
	return part;
}

function vibrationSection(modes: VibrationalMode[], normal: ReturnType<typeof parseG98Modes>): HTMLElement {
	const stage = moleculeStage('振动，可拖动旋转');
	const spectrum = element('div', 'job-spectrum');
	const list = element('ol', 'job-modes');
	const label = element('p', 'job-mode-label');
	const pick = (index: number) => {
		spectrum.replaceChildren(irSpectrum(modes, { selected: index, pick }));
		for (const [position, row] of [...list.children].entries()) row.classList.toggle('is-selected', position === index);
		const mode = modes[index];
		label.textContent = index < 0 ? '最终结构' : `第 ${mode.mode} 个振动：${mode.frequency.toFixed(1)} cm⁻¹${mode.frequency < 0 ? '（虚频）' : ''}，强度 ${mode.intensity.toFixed(1)} km/mol`;
		// g98.out lists the same modes as vibspectrum, without translations and rotations.
		const xyz = normal && index >= 0 && normal.modes[index] ? modeToXyz(normal, index) : normal ? modeToXyz({ atoms: normal.atoms, modes: [] }, 0) : null;
		if (xyz) void stage.show(xyz, { vibrate: index >= 0 }).catch(() => (stage.root.textContent = '三维结构画不出来'));
	};
	modes.forEach((mode, index) => {
		const row = element('li', `job-mode${mode.frequency < 0 ? ' is-imaginary' : ''}`);
		const button = element('button', '', `${mode.frequency.toFixed(1)}`);
		button.type = 'button';
		button.title = `${mode.intensity.toFixed(1)} km/mol`;
		button.addEventListener('click', () => pick(index));
		row.append(button);
		list.append(row);
	});
	const body = element('div', 'job-vibrations');
	const view = element('div', 'job-vibration-view');
	view.append(stage.root, label);
	body.append(view, list);
	const part = section('振动与红外光谱', spectrum, body);
	part.querySelector('.job-section-title')?.append(element('span', 'job-section-note', ` 点谱线或频率看它怎么振动 · cm⁻¹`));
	queueMicrotask(() => pick(-1));
	return part;
}

function conformerSection(frames: XyzFrame[], table: ReturnType<typeof ensembleTable>): HTMLElement {
	const stage = moleculeStage('构象，可拖动旋转');
	const grid = element('table', 'job-conformers');
	const head = element('thead');
	const headRow = element('tr');
	for (const [name, title] of [['#', ''], ['ΔE', '比最低的高多少，kcal/mol'], ['占比', '298.15 K 下的玻尔兹曼分布']]) {
		const cell = element('th', '', name);
		if (title) cell.title = title;
		headRow.append(cell);
	}
	head.append(headRow);
	const rows = element('tbody');
	const show = (index: number) => {
		for (const [position, row] of [...rows.children].entries()) row.classList.toggle('is-selected', position === index);
		void stage.show(frameToXyz(frames[index])).catch(() => (stage.root.textContent = '三维结构画不出来'));
	};
	table.slice(0, 50).forEach((conformer, index) => {
		const row = element('tr', 'job-conformer');
		row.tabIndex = 0;
		row.append(element('td', '', String(conformer.index)), element('td', '', conformer.relative.toFixed(2)), element('td', '', `${(conformer.population * 100).toFixed(1)} %`));
		row.addEventListener('click', () => show(index));
		row.addEventListener('keydown', (event) => event.key === 'Enter' && show(index));
		rows.append(row);
	});
	grid.append(head, rows);
	const body = element('div', 'job-vibrations');
	const list = element('div', 'job-conformer-list');
	list.append(grid);
	list.append(element('p', 'job-section-note', `ΔE 单位 kcal/mol，占比按 298 K 玻尔兹曼分布${table.length > 50 ? `；只列出前 50 个，共 ${table.length} 个` : ''}`));
	body.append(stage.root, list);
	const part = section('构象', body);
	queueMicrotask(() => show(0));
	return part;
}
