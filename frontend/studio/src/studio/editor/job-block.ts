import { blockMenuAPI } from '@milkdown/crepe/feature/block-edit';
import { $fencedBlock } from '@milkdown/kit/preset/commonmark';
import { $view } from '@milkdown/utils';
import { NodeSelection } from '@milkdown/prose/state';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { EditorView, NodeView } from 'prosemirror-view';

import { createJobCard } from '@blog/compute/browser/job-card.ts';
import { drawOutput, drawRun, formatDuration, isFinished, moleculeStage, runDuration, summarizeRun, type RunRecord, type RunSummary } from '@blog/compute/browser/job-view.ts';
import { JOB_LANGUAGE, RUN_STATE_NAMES, jobFenceMeta, newJobId, parseJobFence, runFolder } from '@blog/compute/job-fence.mjs';
import {
	CREST_METHODS,
	DEFAULT_OPTIONS,
	OPT_LEVELS,
	SOLVENTS,
	XTB_METHODS,
	XTB_TASKS,
	describeJob,
	readJobOptions,
	writeJobArgs,
	type JobOptions,
} from '@blog/compute/job-options.mjs';
import { formulaOf, parseXyzFrames } from '@blog/compute/parsers/xyz-frames.ts';
import { studioFileUrl } from '@blog/markdown/articles/article-references.mjs';
import { openBlockSheet, type OpenSheet, type SheetAction } from '@blog/ui/block-sheet.ts';
import { open3DEditor, type Editor3D } from './molecule-editor-3d.ts';
import './job-block.css';

/**
 * ```job blocks in the editor (@blog/compute): a calculation to run from
 * the page, as in a notebook. In the page it is a card of two lines (its
 * name, how its run went, a few numbers); double-clicking it, or Enter on
 * it, opens its sheet: 结果, 设置 (the form, which writes the command line,
 * or the command line, which the form follows; the structure as text), 结构
 * (the structure edited in 3D, molecule-editor-3d.ts), 输出 and 历史 (every
 * run is kept, job-runs.mjs, to go back to).
 *
 * What the block does on the server goes through `setJobHost`, which the
 * Studio gives: the article open, its API and its machines.
 */

export const JOB_FENCE_TYPE = 'job_block';

export const jobBlockSchema = $fencedBlock(JOB_FENCE_TYPE, (language) => language.trim().toLowerCase() === JOB_LANGUAGE, () => ({
	atom: true,
	isolating: true,
}));

export type ComputeHostChoice = { name: string; label: string; threads: number; scheduler: 'direct' | 'slurm' };

export type JobHost = {
	slug(): string | null;
	hosts(): Promise<ComputeHostChoice[]>;
	runs(id: string): Promise<RunRecord[]>;
	start(id: string, job: { program: string; args: string; host: string; threads: number; body: string }): Promise<RunRecord>;
	cancel(id: string, run: string): Promise<RunRecord>;
	/** Opens the list of machines to change it; resolves once it is closed. */
	manageHosts(): Promise<void>;
};

let jobHost: JobHost | null = null;
/** Each block on the page, by its job's name, told when the files of its runs change. */
const blocks = new Map<string, Set<() => void>>();
/** A block just made opens its sheet on 设置 once drawn. */
const opening = new Set<string>();

export function setJobHost(host: JobHost): void {
	jobHost = host;
}

/** Files changed in the article's folder (disk events): the blocks whose runs they are look again. */
export function jobFilesChanged(slug: string, paths: string[]): void {
	if (jobHost?.slug() !== slug) return;
	for (const path of paths) {
		const match = /^assets\/jobs\/([^/]+)(?:\/|$)/u.exec(path);
		if (match) for (const refresh of blocks.get(match[1]) ?? []) refresh();
	}
}

const PROGRAM_NAMES = { xtb: 'xtb', crest: 'CREST' } as const;
const STARTER = { program: 'xtb', args: '--opt', host: 'local' };

/** A new ```job block where the caret's (empty) block is, its name not one the article has; its sheet opens on its form. */
export function insertJob(view: EditorView): void {
	const { state } = view;
	const type = state.schema.nodes[JOB_FENCE_TYPE];
	if (!type) return;
	const taken: string[] = [];
	state.doc.descendants((node) => {
		if (node.type === type) taken.push(parseJobFence(node.attrs.meta, '').id);
	});
	const id = newJobId(taken);
	opening.add(id);
	const meta = jobFenceMeta({ id, ...STARTER });
	const { $from } = state.selection;
	const block = type.create({ language: JOB_LANGUAGE, meta });
	const tr = state.tr.replaceWith($from.before(), $from.after(), block);
	view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, $from.before())).scrollIntoView());
	view.focus();
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

function field(label: string, control: HTMLElement, className = ''): HTMLLabelElement {
	const wrap = element('label', `job-field ${className}`.trim());
	wrap.append(element('span', 'job-field-name', label), control);
	return wrap;
}

function select(options: Array<[string, string]>): HTMLSelectElement {
	const control = element('select', 'job-input');
	setOptions(control, options);
	return control;
}

function setOptions(control: HTMLSelectElement, options: Array<[string, string]>): void {
	const value = control.value;
	control.replaceChildren(...options.map(([key, text]) => {
		const option = element('option', '', text);
		option.value = key;
		return option;
	}));
	if (options.some(([key]) => key === value)) control.value = value;
}

function numberInput(min: number, max: number): HTMLInputElement {
	const control = element('input', 'job-input is-number');
	control.type = 'number';
	control.min = String(min);
	control.max = String(max);
	control.step = '1';
	return control;
}

const TEXT_WRITE_MS = 300;
const REFRESH_MS = 250;
/** `20261019-153012` as `10/19 15:30`. */
const runTime = (run: string) => run.replace(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2}).*$/u, '$2/$3 $4:$5');

export const jobBlockView = $view(jobBlockSchema.schema.node, (ctx) => {
	return (initial: ProseMirrorNode, view: EditorView, getPos: () => number | undefined): NodeView => {
		let node = initial;
		let fence = parseJobFence(String(node.attrs.meta ?? ''), node.textContent);
		const dom = element('div', 'job-block');
		dom.title = '双击打开';

		// The card: two lines, and on hover running it and the block's menu.
		const card = createJobCard(element('div'));
		const runButton = element('button', 'job-run', '运行');
		runButton.type = 'button';
		const menuButton = element('button', 'job-menu-button', '⋯');
		menuButton.type = 'button';
		menuButton.setAttribute('aria-label', '块操作');
		card.actions.append(runButton, menuButton);
		dom.append(card.root);

		// The form, the command line, the structure: the sheet's 设置.
		const settings = element('div', 'job-settings');
		const title = element('input', 'job-input job-title-input');
		title.placeholder = '未命名计算';
		const program = select([['xtb', 'xtb'], ['crest', 'CREST']]);
		const task = select([]);
		const method = select([]);
		const level = select([['', '默认'], ...OPT_LEVELS.map((name): [string, string] => [name, name])]);
		const charge = numberInput(-20, 20);
		const uhf = numberInput(0, 20);
		const solventModel = select([['', '无（气相）'], ['alpb', 'ALPB'], ['gbsa', 'GBSA']]);
		const solvent = select(Object.entries(SOLVENTS).map(([key, name]): [string, string] => [key, `${name} ${key}`]));
		const ewin = numberInput(0, 100);
		ewin.step = '0.5';
		ewin.placeholder = '默认 6';
		const machine = select([['local', '本机']]);
		const threads = numberInput(1, 1024);
		const levelField = field('优化精度', level);
		const ewinField = field('能量窗口 kcal/mol', ewin);
		const solventField = field('溶剂', solvent);
		const form = element('div', 'job-form');
		form.append(
			field('名称', title, 'is-wide'),
			field('程序', program),
			field('任务', task),
			field('方法', method),
			levelField,
			ewinField,
			field('电荷', charge),
			field('未成对电子', uhf),
			field('溶剂模型', solventModel),
			solventField,
			field('机器', machine),
			field('线程', threads),
		);
		const commandLine = element('input', 'job-input job-args');
		commandLine.spellcheck = false;
		commandLine.setAttribute('aria-label', '命令行参数');
		const commandPrefix = element('span', 'job-command-prefix');
		const command = element('div', 'job-command');
		command.append(commandPrefix, commandLine);
		const structureText = element('textarea', 'job-input job-structure-text');
		structureText.spellcheck = false;
		structureText.rows = 9;
		structureText.placeholder = '3\n水\nO  0.000  0.000  0.117\nH  0.000  0.757 -0.469\nH  0.000 -0.757 -0.469\n\n或 @file ./assets/分子.xyz';
		structureText.setAttribute('aria-label', '起始结构（XYZ）');
		const structureInfo = element('p', 'job-structure-info');
		const structureStage = moleculeStage('起始结构，可拖动旋转');
		const structure = element('div', 'job-structure');
		const structureColumn = element('div', 'job-structure-column');
		structureColumn.append(element('span', 'job-field-name', '起始结构'), structureText, structureInfo);
		structure.append(structureColumn, structureStage.root);
		settings.append(form, field('命令行', command, 'job-command-field'), structure);

		let record: RunRecord | null = null;
		let summary: RunSummary | null = null;
		let runs: RunRecord[] = [];
		let busy = false;
		let sheet: OpenSheet | null = null;
		let ticking: ReturnType<typeof setInterval> | undefined;
		let refreshTimer: ReturnType<typeof setTimeout> | undefined;
		let writeTimer: ReturnType<typeof setTimeout> | undefined;
		let pendingWrite: { meta?: string; body?: string } | null = null;
		let registeredId = '';
		let destroyed = false;
		let summarized = '';

		const slug = () => jobHost?.slug() ?? null;
		const options = (): JobOptions => readJobOptions(fence.program, fence.args);
		const running = () => record !== null && !isFinished(record);
		/** Lines without the spaces around them, and no empty lines at the end: two structures written alike. */
		const sameStructure = (left: string, right: string) => {
			const lines = (text: string) => text.split(/\r?\n/u).map((line) => line.trim()).join('\n').replace(/\n+$/u, '');
			return lines(left) === lines(right);
		};
		/** Shown with a run whose structure is not the block's any more. */
		const stale = () => Boolean(record && isFinished(record) && summary?.input && fence.structure.kind === 'inline' && !sameStructure(summary.input, node.textContent));
		const describe = () => `${PROGRAM_NAMES[fence.program as 'xtb' | 'crest'] ?? fence.program} · ${describeJob(fence.program, options())}${stale() ? ' · 结构改过了，这是改之前的结果' : ''}`;

		/** Writes the fence's meta and text, as one step of undo. */
		const write = (next: { meta?: string; body?: string }) => {
			const pos = getPos();
			if (pos == null) return;
			const current = view.state.doc.nodeAt(pos);
			if (!current || current.type.name !== JOB_FENCE_TYPE) return;
			const meta = next.meta ?? String(current.attrs.meta ?? '');
			const body = next.body ?? current.textContent;
			if (meta === current.attrs.meta && body === current.textContent) return;
			const replacement = current.type.create({ ...current.attrs, meta }, body ? view.state.schema.text(body) : null);
			const tr = view.state.tr.replaceWith(pos, pos + current.nodeSize, replacement);
			view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, pos)));
		};
		const flush = () => {
			clearTimeout(writeTimer);
			writeTimer = undefined;
			const next = pendingWrite;
			pendingWrite = null;
			if (next) write(next);
		};
		/** Typing is written a moment after it stops; a choice at once. */
		const later = (next: { meta?: string; body?: string }, delay = TEXT_WRITE_MS) => {
			pendingWrite = { ...pendingWrite, ...next };
			clearTimeout(writeTimer);
			if (delay) writeTimer = setTimeout(flush, delay);
			else flush();
		};
		const writeMeta = (changes: Partial<typeof fence>, delay = 0) => {
			fence = { ...fence, ...changes };
			later({ meta: jobFenceMeta(fence) }, delay);
			paintCard();
		};
		const writeOptions = (next: JobOptions) => writeMeta({ args: writeJobArgs(fence.program, next) });

		const paintCard = () => {
			card.paint({ title: fence.title, describe: describe(), record, summary });
			runButton.textContent = running() ? '停止' : busy ? '…' : '运行';
			runButton.classList.toggle('is-stop', running());
			runButton.disabled = busy;
			dom.dataset.state = record?.state ?? 'none';
			sheet?.setTitle(fence.title || '未命名计算');
			sheet?.setActions(sheetActions());
		};

		const paintForm = () => {
			const current = options();
			const isCrest = fence.program === 'crest';
			if (document.activeElement !== title) title.value = fence.title;
			program.value = isCrest ? 'crest' : 'xtb';
			setOptions(task, isCrest ? [['conformers', '构象搜索']] : Object.entries(XTB_TASKS).map(([key, value]): [string, string] => [key, value.name]));
			task.value = current.task;
			setOptions(method, Object.entries(isCrest ? CREST_METHODS : XTB_METHODS));
			method.value = current.method;
			level.value = current.level;
			levelField.hidden = isCrest || !['opt', 'ohess'].includes(current.task);
			ewinField.hidden = !isCrest;
			if (document.activeElement !== ewin) ewin.value = current.ewin === null ? '' : String(current.ewin);
			if (document.activeElement !== charge) charge.value = String(current.charge);
			if (document.activeElement !== uhf) uhf.value = String(current.uhf);
			solventModel.value = current.solvent?.model ?? '';
			solventField.hidden = !current.solvent;
			if (current.solvent) {
				if (!SOLVENTS[current.solvent.name]) setOptions(solvent, [[current.solvent.name, current.solvent.name], ...Object.entries(SOLVENTS).map(([key, name]): [string, string] => [key, `${name} ${key}`])]);
				solvent.value = current.solvent.name;
			}
			machine.value = fence.host;
			if (document.activeElement !== threads) threads.value = fence.threads ? String(fence.threads) : '';
			commandPrefix.textContent = `${fence.program} 输入文件`;
			if (document.activeElement !== commandLine) commandLine.value = fence.args;
		};

		let paintedStructure: string | null = null;
		const paintStructure = () => {
			const body = node.textContent;
			if (document.activeElement !== structureText) structureText.value = body;
			if (body === paintedStructure) return;
			paintedStructure = body;
			const structureOf = fence.structure;
			if (structureOf.kind === 'file') {
				structureInfo.textContent = structureOf.path ? `用文章里的文件 ${structureOf.path}` : `${structureOf.written} 不是文章里的文件`;
				const url = structureOf.path && slug() ? studioFileUrl(slug() as string, structureOf.path) : null;
				if (url && /\.xyz$/iu.test(structureOf.path ?? '')) {
					void fetch(url, { cache: 'no-store' }).then((response) => (response.ok ? response.text() : null)).then((text) => (text ? structureStage.show(text) : undefined)).catch(() => {});
				} else {
					structureStage.root.textContent = '这种文件只在运行时读';
				}
				return;
			}
			if (structureOf.kind === 'none') {
				structureInfo.textContent = '写上起始结构：XYZ，或 @file ./assets/分子.xyz';
				structureStage.root.textContent = '还没有结构';
				return;
			}
			const frames = structureOf.format === 'xyz' ? parseXyzFrames(structureOf.text) : [];
			if (frames[0]) {
				structureInfo.textContent = `${formulaOf(frames[0].atoms)} · ${frames[0].atoms.length} 个原子`;
				void structureStage.show(structureOf.text).catch(() => (structureStage.root.textContent = '三维结构画不出来'));
			} else {
				structureInfo.textContent = structureOf.format === 'mol' ? 'MOL 结构' : 'XYZ 读不出来：第一行是原子数，第二行是注释，之后每行一个原子';
				structureStage.root.textContent = '';
			}
		};

		const readFile = (current: RunRecord) => async (name: string) => {
			const article = slug();
			if (!article) return null;
			const response = await fetch(studioFileUrl(article, `${runFolder(current.id, current.run)}/${name}`), { cache: 'no-store' });
			return response.ok ? response.text() : null;
		};
		const fileUrl = (current: RunRecord, name: string) => {
			const article = slug();
			return article ? studioFileUrl(article, `${runFolder(current.id, current.run)}/${name}`) : null;
		};

		/** The card's numbers: read again while a run goes, once when it has ended. */
		const summarize = async () => {
			const current = record;
			if (!current) {
				summary = null;
				summarized = '';
				paintCard();
				return;
			}
			const key = `${current.run}:${current.state}:${current.problem ?? ''}`;
			if (key === summarized && isFinished(current)) return;
			summarized = key;
			const next = await summarizeRun(current, readFile(current)).catch(() => null);
			if (destroyed || record !== current) return;
			summary = next;
			paintCard();
		};

		/** The shown run's time, every second while it goes. */
		const tick = () => {
			clearInterval(ticking);
			ticking = undefined;
			if (!running()) return;
			ticking = setInterval(() => {
				card.tick();
				if (!running()) clearInterval(ticking);
			}, 1000);
		};

		const load = async () => {
			if (!jobHost || !fence.id || !slug()) {
				record = null;
				runs = [];
			} else {
				try {
					runs = await jobHost.runs(fence.id);
				} catch {
					runs = [];
				}
				record = runs.find((run) => run.run === fence.run) ?? null;
			}
			if (destroyed) return;
			paintCard();
			await summarize();
			tick();
			if (sheet?.isOpen()) {
				sheet.redraw('result');
				sheet.redraw('output');
				sheet.redraw('history');
			}
		};
		const refresh = () => {
			clearTimeout(refreshTimer);
			refreshTimer = setTimeout(() => void load(), REFRESH_MS);
		};

		const register = () => {
			if (registeredId === fence.id) return;
			blocks.get(registeredId)?.delete(refresh);
			registeredId = fence.id;
			if (!registeredId) return;
			if (!blocks.has(registeredId)) blocks.set(registeredId, new Set());
			blocks.get(registeredId)?.add(refresh);
		};

		const loadHosts = async () => {
			if (!jobHost) return;
			try {
				const hosts = await jobHost.hosts();
				const choices: Array<[string, string]> = hosts.map((host) => [host.name, `${host.label}${host.scheduler === 'slurm' ? '（Slurm）' : ''}`]);
				if (!hosts.some((host) => host.name === fence.host)) choices.push([fence.host, `${fence.host}（没有这台机器）`]);
				choices.push(['__manage', '管理计算机器…']);
				setOptions(machine, choices);
				machine.value = fence.host;
				threads.placeholder = String(hosts.find((host) => host.name === fence.host)?.threads ?? '');
			} catch {
				// The list is offered again when the machine is chosen.
			}
		};

		/** Runs the job, or stops the run going. */
		const run = async () => {
			if (!jobHost || busy) return;
			flush();
			if (record && running()) {
				busy = true;
				paintCard();
				try {
					record = await jobHost.cancel(record.id, record.run);
				} catch (error) {
					window.alert(error instanceof Error ? error.message : String(error));
				} finally {
					busy = false;
					paintCard();
				}
				return;
			}
			// A name of its own: a block copied from another keeps that one's.
			const pos = getPos();
			const taken: string[] = [];
			view.state.doc.descendants((other, at) => {
				if (other.type.name === JOB_FENCE_TYPE && at !== pos) taken.push(parseJobFence(other.attrs.meta, '').id);
			});
			if (!fence.id || taken.includes(fence.id)) {
				writeMeta({ id: newJobId(taken), run: '' });
				register();
			}
			busy = true;
			paintCard();
			try {
				const started = await jobHost.start(fence.id, { program: fence.program, args: fence.args, host: fence.host, threads: fence.threads, body: node.textContent });
				record = started;
				runs = [started, ...runs];
				summary = null;
				writeMeta({ run: started.run });
				await summarize();
				tick();
				if (sheet?.isOpen()) {
					sheet.redraw('result');
					sheet.redraw('output');
					sheet.redraw('history');
					sheet.select('result');
				}
			} catch (error) {
				window.alert(error instanceof Error ? error.message : String(error));
			} finally {
				busy = false;
				paintCard();
			}
		};

		const sheetActions = (): SheetAction[] => [
			running()
				? { label: '停止', danger: true, disabled: busy, run: () => void run() }
				: { label: busy ? '…' : '运行', title: '⌘↩', primary: true, disabled: busy, run: () => void run() },
		];

		/** Shows another of the runs kept. */
		const show = (name: string) => {
			writeMeta({ run: name });
			record = runs.find((candidate) => candidate.run === name) ?? null;
			summary = null;
			void summarize().then(tick);
			if (sheet?.isOpen()) {
				sheet.redraw('result');
				sheet.redraw('output');
				sheet.redraw('history');
			}
		};

		const drawResult = (panel: HTMLElement) => {
			const current = record;
			if (!current) {
				panel.append(element('p', 'job-empty', '还没有运行。在「设置」里设好，点「运行」（⌘↩），结果会显示在这里；每次运行都会保留。'));
				return;
			}
			const target = element('div', 'job-result-body');
			panel.append(target);
			void drawRun(target, current, readFile(current), { url: (name) => fileUrl(current, name), output: false });
		};
		const drawOutputTab = (panel: HTMLElement) => {
			const current = record;
			if (!current) {
				panel.append(element('p', 'job-empty', '还没有运行。'));
				return;
			}
			void drawOutput(panel, current, readFile(current), fileUrl(current, current.output));
		};
		const drawHistory = (panel: HTMLElement) => {
			if (!runs.length) {
				panel.append(element('p', 'job-empty', '还没有运行过。'));
				return;
			}
			const table = element('table', 'job-runs');
			const head = element('tr');
			for (const name of ['开始时间', '机器', '状态', '用时', '']) head.append(element('th', '', name));
			table.append(element('thead'));
			table.tHead?.append(head);
			const body = element('tbody');
			for (const candidate of runs) {
				const row = element('tr', `job-run-row${candidate.run === fence.run ? ' is-shown' : ''}`);
				const duration = runDuration(candidate);
				row.append(
					element('td', '', runTime(candidate.run)),
					element('td', '', candidate.hostLabel || candidate.host),
					element('td', '', RUN_STATE_NAMES[candidate.state] ?? candidate.state),
					element('td', '', duration === null ? '' : formatDuration(duration)),
					element('td', 'job-run-shown', candidate.run === fence.run ? '文章显示这次' : '显示这次'),
				);
				row.addEventListener('click', () => {
					show(candidate.run);
					sheet?.select('result');
				});
				body.append(row);
			}
			table.append(body);
			panel.append(table, element('p', 'job-section-note', `每次运行都在 assets/jobs/${fence.id}/ 里；文章显示哪次，博客上就是哪次。`));
		};

		/** The 结构 tab: the starting structure in the 3D editor; what is changed there is written into the block. */
		let editingIn3D = false;
		const drawStructureEditor = (panel: HTMLElement) => {
			const host = element('div', 'job-structure-editor');
			const note = element('p', 'job-section-note');
			panel.append(host, note);
			let editor: Editor3D | null = null;
			let closed = false;
			let timer: ReturnType<typeof setTimeout> | undefined;
			const structureOf = fence.structure;
			const sourceOf = async (): Promise<string | null> => {
				if (structureOf.kind === 'inline') return structureOf.text;
				if (structureOf.kind === 'file' && structureOf.path && slug()) {
					const response = await fetch(studioFileUrl(slug() as string, structureOf.path), { cache: 'no-store' });
					return response.ok ? response.text() : null;
				}
				return null;
			};
			note.textContent = structureOf.kind === 'file'
				? `结构来自文件 ${structureOf.written}；在这里改动后会写进块里，不再引用那个文件。`
				: '改动会写进块里（XYZ）；运行时用的就是这里的结构。';
			void sourceOf().then(async (text) => {
				if (closed) return;
				if (!text?.trim()) {
					host.replaceChildren(element('p', 'job-empty', structureOf.kind === 'none' ? '还没有结构：先在「设置」里写上 XYZ，或引用 assets/ 里的结构文件。' : '这个结构文件读不出来。'));
					return;
				}
				try {
					editor = await open3DEditor(host, text, {
						changed: () => {
							clearTimeout(timer);
							timer = setTimeout(() => {
								if (!editor || closed) return;
								editingIn3D = true;
								try {
									later({ body: editor.source('xyz') }, 0);
								} finally {
									editingIn3D = false;
								}
							}, TEXT_WRITE_MS);
						},
					});
					if (closed) editor.dispose();
				} catch (error) {
					host.replaceChildren(element('p', 'job-empty', error instanceof Error ? error.message : String(error)));
				}
			});
			return () => {
				closed = true;
				clearTimeout(timer);
				// What was changed last is written before the editor goes.
				if (editor?.changed()) {
					editingIn3D = true;
					try {
						later({ body: editor.source('xyz') }, 0);
					} finally {
						editingIn3D = false;
					}
				}
				editor?.dispose();
				editor = null;
			};
		};

		const openSheet = (tab?: string) => {
			flush();
			paintForm();
			paintedStructure = null;
			sheet = openBlockSheet({
				kind: '计算',
				title: fence.title || '未命名计算',
				initial: tab ?? (record ? 'result' : 'settings'),
				tabs: [
					{ key: 'result', label: '结果', draw: drawResult },
					{
						key: 'settings',
						label: '设置',
						draw: (panel) => {
							panel.append(settings);
							paintStructure();
							void loadHosts();
						},
					},
					{ key: 'structure', label: '结构', draw: drawStructureEditor },
					{ key: 'output', label: '输出', draw: drawOutputTab },
					{ key: 'history', label: `历史${runs.length > 1 ? ` ${runs.length}` : ''}`, draw: drawHistory },
				],
				actions: sheetActions(),
				onClose: () => {
					flush();
					sheet = null;
					const pos = getPos();
					if (pos != null && !destroyed) {
						view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)).setMeta('addToHistory', false));
						view.focus();
					}
				},
			});
		};

		// The form writes the command line; the command line, written, is read back into the form.
		const changeOptions = (change: (current: JobOptions) => JobOptions) => {
			writeOptions(change(options()));
			paintForm();
		};
		program.addEventListener('change', () => {
			const next = program.value as 'xtb' | 'crest';
			const kept = options();
			const fresh = { ...DEFAULT_OPTIONS[next], charge: kept.charge, uhf: kept.uhf, solvent: kept.solvent, extra: [] };
			fence = { ...fence, program: next };
			writeMeta({ program: next, args: writeJobArgs(next, fresh) });
			paintForm();
		});
		task.addEventListener('change', () => changeOptions((current) => ({ ...current, task: task.value, level: ['opt', 'ohess'].includes(task.value) ? current.level : '' })));
		method.addEventListener('change', () => changeOptions((current) => ({ ...current, method: method.value })));
		level.addEventListener('change', () => changeOptions((current) => ({ ...current, level: level.value })));
		charge.addEventListener('input', () => {
			if (/^-?\d+$/u.test(charge.value)) changeOptions((current) => ({ ...current, charge: Number(charge.value) }));
		});
		uhf.addEventListener('input', () => {
			if (/^\d+$/u.test(uhf.value)) changeOptions((current) => ({ ...current, uhf: Number(uhf.value) }));
		});
		ewin.addEventListener('input', () => {
			if (ewin.value === '' || Number.isFinite(Number(ewin.value))) changeOptions((current) => ({ ...current, ewin: ewin.value === '' ? null : Number(ewin.value) }));
		});
		solventModel.addEventListener('change', () => changeOptions((current) => ({ ...current, solvent: solventModel.value ? { model: solventModel.value as 'alpb' | 'gbsa', name: current.solvent?.name ?? 'water' } : null })));
		solvent.addEventListener('change', () => changeOptions((current) => ({ ...current, solvent: current.solvent ? { ...current.solvent, name: solvent.value } : null })));
		machine.addEventListener('change', async () => {
			if (machine.value === '__manage') {
				machine.value = fence.host;
				await jobHost?.manageHosts();
				await loadHosts();
				return;
			}
			writeMeta({ host: machine.value });
			await loadHosts();
		});
		threads.addEventListener('input', () => {
			if (threads.value === '' || /^\d+$/u.test(threads.value)) writeMeta({ threads: threads.value ? Number(threads.value) : 0 }, TEXT_WRITE_MS);
		});
		commandLine.addEventListener('input', () => {
			fence = { ...fence, args: commandLine.value.replace(/[\r\n]/gu, ' ') };
			later({ meta: jobFenceMeta(fence) });
			paintCard();
		});
		commandLine.addEventListener('change', () => paintForm());
		title.addEventListener('input', () => writeMeta({ title: title.value }, TEXT_WRITE_MS));
		structureText.addEventListener('input', () => later({ body: structureText.value.replace(/\n+$/u, '') }));

		runButton.addEventListener('click', () => void run());
		menuButton.addEventListener('mousedown', (event) => {
			event.preventDefault();
			const pos = getPos();
			if (pos != null) ctx.get(blockMenuAPI.key).toggle(pos, menuButton);
		});
		// A click selects the block, as other blocks are; a double click opens it.
		dom.addEventListener('mousedown', (event) => {
			if ((event.target as Element).closest('button')) return;
			const pos = getPos();
			if (pos == null) return;
			event.preventDefault();
			view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)).setMeta('addToHistory', false));
			view.focus();
		});
		dom.addEventListener('dblclick', (event) => {
			if ((event.target as Element).closest('button')) return;
			event.preventDefault();
			openSheet();
		});

		paintCard();
		register();
		void load();
		if (opening.delete(fence.id)) queueMicrotask(() => openSheet('settings'));

		return {
			dom,
			update: (updated: ProseMirrorNode) => {
				if (updated.type.name !== JOB_FENCE_TYPE) return false;
				const runBefore = fence.run;
				const bodyBefore = node.textContent;
				node = updated;
				// Our own keystrokes still to be written are newer than what the document says.
				if (!pendingWrite) fence = parseJobFence(String(updated.attrs.meta ?? ''), updated.textContent);
				else fence = { ...parseJobFence(String(updated.attrs.meta ?? ''), updated.textContent), args: fence.args, title: fence.title };
				register();
				paintCard();
				if (sheet?.isOpen()) {
					paintForm();
					paintStructure();
					// The structure changed elsewhere (its text, undo): the 3D editor opens it anew.
					if (updated.textContent !== bodyBefore && !editingIn3D) sheet.redraw('structure');
				}
				if (fence.run !== runBefore) {
					record = runs.find((candidate) => candidate.run === fence.run) ?? null;
					refresh();
				}
				return true;
			},
			selectNode: () => dom.classList.add('ProseMirror-selectednode'),
			deselectNode: () => dom.classList.remove('ProseMirror-selectednode'),
			// The caret put inside (Enter on the block): its sheet opens instead.
			setSelection: () => {
				if (!sheet?.isOpen()) openSheet();
			},
			destroy: () => {
				destroyed = true;
				flush();
				clearTimeout(refreshTimer);
				clearInterval(ticking);
				blocks.get(registeredId)?.delete(refresh);
				sheet?.close();
			},
			ignoreMutation: () => true,
			stopEvent: (event) => {
				const target = event.target;
				if (!(target instanceof Element)) return false;
				if (event.type === 'dragstart') return false;
				return Boolean(target.closest('button'));
			},
		};
	};
});

/** Register in `mountEditor` via `crepe.editor.use(...)`. */
export const jobBlockPlugins = [...jobBlockSchema, jobBlockView];
