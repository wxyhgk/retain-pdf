import { blockMenuAPI } from '@milkdown/crepe/feature/block-edit';
import { $fencedBlock } from '@milkdown/kit/preset/commonmark';
import { $view } from '@milkdown/utils';
import { NodeSelection } from '@milkdown/prose/state';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { EditorView, NodeView } from 'prosemirror-view';

import { drawRun, isFinished, moleculeStage, runFacts, type RunRecord } from '@blog/compute/browser/job-view.ts';
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
import './job-block.css';

/**
 * ```job blocks in the editor (@blog/compute): a calculation to run from
 * the page, as in a notebook. Its head names it and runs it; its form writes
 * the command line (or the command line is written, and the form follows);
 * its structure is the fence's text; under them, the run it shows, followed
 * while it goes. Every run is kept (job-runs.mjs), to go back to.
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

/** A new ```job block where the caret's (empty) block is, its name not one the article has. */
export function insertJob(view: EditorView): void {
	const { state } = view;
	const type = state.schema.nodes[JOB_FENCE_TYPE];
	if (!type) return;
	const taken: string[] = [];
	state.doc.descendants((node) => {
		if (node.type === type) taken.push(parseJobFence(node.attrs.meta, '').id);
	});
	const meta = jobFenceMeta({ id: newJobId(taken), ...STARTER });
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

export const jobBlockView = $view(jobBlockSchema.schema.node, (ctx) => {
	return (initial: ProseMirrorNode, view: EditorView, getPos: () => number | undefined): NodeView => {
		let node = initial;
		let fence = parseJobFence(String(node.attrs.meta ?? ''), node.textContent);
		const dom = element('div', 'job-block');

		// The head: what it is, its name, what it does, running it.
		const head = element('div', 'job-head');
		const kind = element('span', 'job-kind', '计算');
		const title = element('input', 'job-title');
		title.placeholder = '未命名计算';
		title.setAttribute('aria-label', '计算的名字');
		const summary = element('span', 'job-summary');
		const runButton = element('button', 'job-run', '运行');
		runButton.type = 'button';
		const history = element('select', 'job-history');
		history.setAttribute('aria-label', '运行记录');
		const settingsButton = element('button', 'job-settings-button', '设置');
		settingsButton.type = 'button';
		settingsButton.setAttribute('aria-expanded', 'false');
		const menuButton = element('button', 'job-menu-button', '⋯');
		menuButton.type = 'button';
		menuButton.setAttribute('aria-label', '块操作');
		const actions = element('span', 'job-actions');
		actions.append(history, settingsButton, runButton, menuButton);
		head.append(kind, title, summary, actions);

		// The form, the command line, the structure.
		const settings = element('div', 'job-settings');
		settings.hidden = true;
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
		structureText.rows = 7;
		structureText.placeholder = '3\n水\nO  0.000  0.000  0.117\nH  0.000  0.757 -0.469\nH  0.000 -0.757 -0.469\n\n或 @file ./assets/分子.xyz';
		structureText.setAttribute('aria-label', '起始结构（XYZ）');
		const structureInfo = element('p', 'job-structure-info');
		const structureStage = moleculeStage('起始结构，可拖动旋转');
		const structure = element('div', 'job-structure');
		const structureColumn = element('div', 'job-structure-column');
		structureColumn.append(structureText, structureInfo);
		structure.append(structureColumn, structureStage.root);
		settings.append(form, command, structure);

		const result = element('div', 'job-result');
		const empty = element('p', 'job-empty', '还没有运行。设好之后点「运行」，结果会显示在这里，每次运行都会保留。');
		dom.append(head, settings, result);

		let record: RunRecord | null = null;
		let runs: RunRecord[] = [];
		let drawnKey = '';
		let busy = false;
		let ticking: ReturnType<typeof setInterval> | undefined;
		let refreshTimer: ReturnType<typeof setTimeout> | undefined;
		let writeTimer: ReturnType<typeof setTimeout> | undefined;
		let pendingWrite: { meta?: string; body?: string } | null = null;
		let registeredId = '';
		let destroyed = false;

		const slug = () => jobHost?.slug() ?? null;
		const options = (): JobOptions => readJobOptions(fence.program, fence.args);

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
			paintHead();
		};
		const writeOptions = (next: JobOptions) => writeMeta({ args: writeJobArgs(fence.program, next) });

		const paintHead = () => {
			if (document.activeElement !== title) title.value = fence.title;
			summary.textContent = `${PROGRAM_NAMES[fence.program as 'xtb' | 'crest'] ?? fence.program} · ${describeJob(fence.program, options())}`;
			const running = record !== null && !isFinished(record);
			runButton.textContent = running ? '停止' : busy ? '…' : '运行';
			runButton.classList.toggle('is-stop', running);
			runButton.disabled = busy;
			dom.dataset.state = record?.state ?? 'none';
		};

		const paintForm = () => {
			const current = options();
			const isCrest = fence.program === 'crest';
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

		let paintedStructure = '';
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

		const paintHistory = () => {
			const options: Array<[string, string]> = runs.map((run) => [run.run, `${run.run.replace(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2}).*$/u, '$2/$3 $4:$5')} · ${RUN_STATE_NAMES[run.state] ?? run.state}`]);
			history.hidden = runs.length < 2;
			setOptions(history, options);
			history.value = fence.run;
			history.title = `共 ${runs.length} 次运行，都保留在 assets/jobs/${fence.id}/`;
		};

		const readFile = (current: RunRecord) => async (name: string) => {
			const article = slug();
			if (!article) return null;
			const response = await fetch(studioFileUrl(article, `${runFolder(current.id, current.run)}/${name}`), { cache: 'no-store' });
			return response.ok ? response.text() : null;
		};

		const paintResult = async () => {
			if (!record) {
				result.replaceChildren(empty);
				drawnKey = '';
				return;
			}
			const current = record;
			const article = slug();
			// Finished runs are drawn once; a run going is drawn again as its files grow.
			const key = `${current.run}:${current.state}:${current.problem ?? ''}`;
			if (key === drawnKey && isFinished(current)) return;
			drawnKey = key;
			const target = element('div', 'job-result-body');
			await drawRun(target, current, readFile(current), {
				url: (name) => (article ? studioFileUrl(article, `${runFolder(current.id, current.run)}/${name}`) : null),
				followOutput: true,
			});
			if (destroyed || record !== current) return;
			result.replaceChildren(target);
		};

		/** The shown run's facts, every second while it goes. */
		const tick = () => {
			clearInterval(ticking);
			ticking = undefined;
			if (!record || isFinished(record)) return;
			ticking = setInterval(() => {
				const facts = result.querySelector('.job-facts');
				if (record && facts) facts.replaceWith(runFacts(record, null));
				if (!record || isFinished(record)) clearInterval(ticking);
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
			paintHead();
			paintHistory();
			await paintResult();
			tick();
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

		const run = async () => {
			if (!jobHost || busy) return;
			flush();
			if (record && !isFinished(record)) {
				busy = true;
				paintHead();
				try {
					record = await jobHost.cancel(record.id, record.run);
				} catch (error) {
					window.alert(error instanceof Error ? error.message : String(error));
				} finally {
					busy = false;
					paintHead();
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
			paintHead();
			try {
				const started = await jobHost.start(fence.id, { program: fence.program, args: fence.args, host: fence.host, threads: fence.threads, body: node.textContent });
				record = started;
				runs = [started, ...runs];
				writeMeta({ run: started.run });
				settings.hidden = true;
				settingsButton.setAttribute('aria-expanded', 'false');
				drawnKey = '';
				await paintResult();
				paintHistory();
				tick();
			} catch (error) {
				window.alert(error instanceof Error ? error.message : String(error));
			} finally {
				busy = false;
				paintHead();
			}
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
			paintHead();
		});
		commandLine.addEventListener('change', () => paintForm());
		title.addEventListener('input', () => writeMeta({ title: title.value }, TEXT_WRITE_MS));
		title.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				title.blur();
			}
		});
		structureText.addEventListener('input', () => later({ body: structureText.value.replace(/\n+$/u, '') }));
		settingsButton.addEventListener('click', () => {
			settings.hidden = !settings.hidden;
			settingsButton.setAttribute('aria-expanded', String(!settings.hidden));
			if (!settings.hidden) {
				paintedStructure = '';
				paintStructure();
				void loadHosts();
			}
		});
		runButton.addEventListener('click', () => void run());
		history.addEventListener('change', () => {
			writeMeta({ run: history.value });
			record = runs.find((candidate) => candidate.run === history.value) ?? null;
			drawnKey = '';
			void paintResult().then(tick);
			paintHead();
		});
		menuButton.addEventListener('mousedown', (event) => {
			event.preventDefault();
			const pos = getPos();
			if (pos != null) ctx.get(blockMenuAPI.key).toggle(pos, menuButton);
		});
		// A click on the block outside its controls selects it, as other blocks are.
		dom.addEventListener('mousedown', (event) => {
			const target = event.target as Element;
			if (target.closest('input, select, textarea, button, a, summary, canvas, .job-stage, .job-log-text, .job-modes, .job-conformers, svg')) return;
			const pos = getPos();
			if (pos == null) return;
			event.preventDefault();
			view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)).setMeta('addToHistory', false));
			view.focus();
		});

		paintHead();
		paintForm();
		register();
		// A new block opens on its form.
		if (!fence.run) {
			settings.hidden = false;
			settingsButton.setAttribute('aria-expanded', 'true');
			queueMicrotask(() => {
				paintStructure();
				void loadHosts();
			});
		}
		void load();

		return {
			dom,
			update: (updated: ProseMirrorNode) => {
				if (updated.type.name !== JOB_FENCE_TYPE) return false;
				const runBefore = fence.run;
				node = updated;
				// Our own keystrokes still to be written are newer than what the document says.
				if (!pendingWrite) fence = parseJobFence(String(updated.attrs.meta ?? ''), updated.textContent);
				else fence = { ...parseJobFence(String(updated.attrs.meta ?? ''), updated.textContent), args: fence.args, title: fence.title };
				register();
				paintHead();
				paintForm();
				if (!settings.hidden) paintStructure();
				if (fence.run !== runBefore) {
					record = runs.find((candidate) => candidate.run === fence.run) ?? null;
					refresh();
				}
				return true;
			},
			selectNode: () => dom.classList.add('ProseMirror-selectednode'),
			deselectNode: () => dom.classList.remove('ProseMirror-selectednode'),
			setSelection: () => {
				// The caret is put inside (Enter on the block): its form opens instead.
				settings.hidden = false;
				settingsButton.setAttribute('aria-expanded', 'true');
				paintStructure();
				const pos = getPos();
				if (pos != null) queueMicrotask(() => view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)).setMeta('addToHistory', false)));
			},
			destroy: () => {
				destroyed = true;
				flush();
				clearTimeout(refreshTimer);
				clearInterval(ticking);
				blocks.get(registeredId)?.delete(refresh);
			},
			ignoreMutation: () => true,
			stopEvent: (event) => {
				const target = event.target;
				if (!(target instanceof Element)) return false;
				// Typing, choosing and clicking in the block are its own; dragging it by its head is the editor's.
				if (event.type === 'dragstart') return false;
				return Boolean(target.closest('input, select, textarea, button, details, .job-stage, .job-chart-svg, .job-modes, .job-conformers, .job-log-text'));
			},
		};
	};
});

/** Register in `mountEditor` via `crepe.editor.use(...)`. */
export const jobBlockPlugins = [...jobBlockSchema, jobBlockView];
