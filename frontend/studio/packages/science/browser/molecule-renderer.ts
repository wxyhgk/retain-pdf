import { parseMoleculeBlock } from '../parsers/index.ts';
import { prepareMoleculeRenderInput } from '../rendering/index.ts';
import { describeRDKitError } from '../rendering/rdkit-messages.ts';
import { moleculeViewKey } from '../view-key.mjs';

export type RDKitMol = {
	is_valid(): boolean;
	get_svg(width: number, height: number): string;
	/** `details` is JSON drawing options, e.g. size and `clearBackground`. */
	get_svg_with_highlights(details: string): string;
	get_smiles(): string;
	get_molblock(): string;
	set_new_coords(useCoordGen?: boolean): boolean;
	delete(): void;
};

type RDKitLogCapture = {
	get_buffer(): string;
	clear_buffer(): void;
	delete?(): void;
};

export type RDKitModule = {
	version(): string;
	/** `details` is JSON, e.g. `{"sanitize":false}` to read a structure without RDKit's chemistry checks. */
	get_mol(source: string, details?: string): RDKitMol | null;
	set_log_capture?(logName: string): RDKitLogCapture | null;
};

/** A structure RDKit read, and why it had to be read as drawn when its chemistry checks refused it. */
export type ReadMolecule = { mol: RDKitMol; problem: string | null };

/**
 * Read a structure. When RDKit refuses it (a hydrogen with two bonds, a
 * pentavalent carbon…), read it again as drawn, without the checks, so the
 * picture still shows what was written, and say why. Throws only when even
 * that fails. The caller deletes `mol`.
 */
export function readMolecule(rdkit: RDKitModule, source: string): ReadMolecule {
	const capture = rdkit.set_log_capture?.('rdApp.error') ?? null;
	try {
		const strict = rdkit.get_mol(source);
		if (strict?.is_valid()) return { mol: strict, problem: null };
		strict?.delete();
		const reason = describeRDKitError(capture?.get_buffer() ?? '');
		const loose = rdkit.get_mol(source, JSON.stringify({ sanitize: false }));
		if (!loose?.is_valid()) {
			loose?.delete();
			throw new Error(reason ? `无法解析分子结构：${reason}` : '无法解析分子结构');
		}
		return { mol: loose, problem: reason || '结构没有通过 RDKit 的化学检查' };
	} finally {
		capture?.clear_buffer();
		capture?.delete?.();
	}
}

export type ThreeDMolViewer = {
	addModel(source: string, format: string): unknown;
	addIsosurface(data: unknown, style: object): unknown;
	removeShape(shape: unknown): void;
	setStyle(selection: object, style: object): void;
	setBackgroundColor(color: string): void;
	getView(): number[];
	setView(view: number[], noLink?: boolean): unknown;
	setViewChangeCallback(callback: ((view: number[]) => void) | null): void;
	zoomTo(): void;
	render(): void;
	resize(): void;
};

type ChemistryWindow = Window & {
	initRDKitModule?: (options: { locateFile: (file: string) => string }) => Promise<RDKitModule>;
	$3Dmol?: {
		createViewer: (element: HTMLElement, config: object) => ThreeDMolViewer;
		VolumeData: new (source: string, format: string) => unknown;
	};
	__rdkitPromise?: Promise<RDKitModule>;
	__threeDMolPromise?: Promise<ChemistryWindow['$3Dmol']>;
};

const moleculeViewMemory = new Map<string, number[]>();

export type SavedMoleculeView = { format: string; view: number[]; display?: unknown };
type MoleculeViewContext = {
	views: Record<string, SavedMoleculeView>;
	save?: (key: string, format: string, view: number[], display?: unknown) => Promise<void>;
};

let moleculeViewContext: MoleculeViewContext = { views: {} };

export function setMoleculeViewContext(context: MoleculeViewContext): void {
	moleculeViewMemory.clear();
	moleculeViewContext = context;
}

export { moleculeViewKey };

export function parseStoredMoleculeView(raw: string | null): number[] | null {
	if (!raw) return null;
	try {
		const view = JSON.parse(raw);
		if (!Array.isArray(view) || view.length < 8 || view.length > 16) return null;
		if (!view.every((value) => typeof value === 'number' && Number.isFinite(value))) return null;
		return view;
	} catch {
		return null;
	}
}

function readMoleculeView(key: string, format: string): number[] | null {
	const memoryView = moleculeViewMemory.get(key);
	if (memoryView) return [...memoryView];
	const saved = moleculeViewContext.views[key];
	if (!saved || saved.format !== format || !parseStoredMoleculeView(JSON.stringify(saved.view))) return null;
	moleculeViewMemory.set(key, [...saved.view]);
	return [...saved.view];
}

export function readSavedMoleculeDisplay(format: string, viewIdentity: string): unknown {
	const saved = moleculeViewContext.views[moleculeViewKey(format, viewIdentity)];
	return saved?.format === format ? saved.display : undefined;
}

function rememberMoleculeView(key: string, view: number[]): void {
	moleculeViewMemory.set(key, [...view]);
}

function clearMoleculeView(key: string): void {
	moleculeViewMemory.delete(key);
}

function viewsEqual(left: number[], right: number[]): boolean {
	return left.length === right.length && left.every((value, index) => Math.abs(value - right[index]) < 1e-9);
}

function loadScript(src: string): Promise<void> {
	const loaded = document.querySelector<HTMLScriptElement>(`script[data-chem-src="${src}"]`);
	if (loaded?.dataset.loaded === 'true') return Promise.resolve();
	return new Promise((resolve, reject) => {
		const script = loaded ?? document.createElement('script');
		script.addEventListener('load', () => {
			script.dataset.loaded = 'true';
			resolve();
		}, { once: true });
		script.addEventListener('error', () => reject(new Error(`无法加载 ${src}`)), { once: true });
		if (!loaded) {
			script.src = src;
			script.dataset.chemSrc = src;
			document.head.append(script);
		}
	});
}

/** The site's own RDKit (`/vendor/rdkit`), loaded once per page. */
export function loadRDKit(): Promise<RDKitModule> {
	const chemistryWindow = window as ChemistryWindow;
	if (!chemistryWindow.__rdkitPromise) {
		chemistryWindow.__rdkitPromise = loadScript('/vendor/rdkit/RDKit_minimal.js').then(() => {
			if (!chemistryWindow.initRDKitModule) throw new Error('RDKit 初始化函数不存在');
			return chemistryWindow.initRDKitModule({
				locateFile: (file) => `/vendor/rdkit/${file}`,
			});
		});
	}
	return chemistryWindow.__rdkitPromise;
}

export function load3Dmol(): Promise<NonNullable<ChemistryWindow['$3Dmol']>> {
	const chemistryWindow = window as ChemistryWindow;
	if (!chemistryWindow.__threeDMolPromise) {
		chemistryWindow.__threeDMolPromise = loadScript('/vendor/3dmol/3Dmol-min.js').then(() => {
			if (!chemistryWindow.$3Dmol) throw new Error('3Dmol.js 初始化失败');
			return chemistryWindow.$3Dmol;
		});
	}
	return chemistryWindow.__threeDMolPromise as Promise<NonNullable<ChemistryWindow['$3Dmol']>>;
}

/** Apply shared camera persistence, controls, resizing, and theme behavior to a 3Dmol viewer. */
export function mount3DMolInteraction(
	figure: HTMLElement,
	stage: HTMLElement,
	viewer: ThreeDMolViewer,
	format: string,
	viewIdentity: string,
	options: { getDisplay?: () => unknown } = {},
): { markDisplayDirty: () => void } {
	viewer.zoomTo();
	const defaultView = viewer.getView();
	const viewKey = moleculeViewKey(format, viewIdentity);
	const storedView = readMoleculeView(viewKey, format);
	if (storedView) viewer.setView(storedView, true);
	viewer.render();
	viewer.resize();

	const controls = document.createElement('div');
	controls.className = 'chem-view-controls';
	const persistence = document.createElement('span');
	persistence.textContent = storedView ? '已载入文章视角' : '使用自动视角';
	const resetView = document.createElement('button');
	resetView.type = 'button';
	resetView.textContent = '重置视角';
	resetView.addEventListener('click', () => {
		clearMoleculeView(viewKey);
		viewer.setView(defaultView, true);
		viewer.render();
		persistence.textContent = moleculeViewContext.save ? '已重置 · 尚未写入文章' : '已重置';
	});
	const buttons = document.createElement('div');
	buttons.className = 'chem-view-buttons';
	buttons.append(resetView);
	if (moleculeViewContext.save) {
		const saveView = document.createElement('button');
		saveView.type = 'button';
		saveView.className = 'primary';
		saveView.textContent = options.getDisplay ? '保存显示与视角' : '保存视角到文章';
		saveView.addEventListener('click', async () => {
			saveView.disabled = true;
			persistence.textContent = '正在写入 article.views.json…';
			try {
				const view = viewer.getView();
				const display = options.getDisplay?.();
				await moleculeViewContext.save?.(viewKey, format, view, display);
				moleculeViewContext.views[viewKey] = { format, view: [...view], display };
				rememberMoleculeView(viewKey, view);
				persistence.textContent = options.getDisplay ? '显示与视角已写入文章配置' : '视角已写入文章配置';
			} catch (error) {
				persistence.textContent = error instanceof Error ? error.message : '视角保存失败';
			} finally {
				saveView.disabled = false;
			}
		});
		buttons.append(saveView);
	}
	controls.append(persistence, buttons);
	stage.after(controls);

	let persistTimer: ReturnType<typeof setTimeout> | undefined;
	let lastObservedView = viewer.getView();
	viewer.setViewChangeCallback((view) => {
		if (!figure.isConnected) {
			viewer.setViewChangeCallback(null);
			if (persistTimer) clearTimeout(persistTimer);
			return;
		}
		if (viewsEqual(view, lastObservedView)) return;
		lastObservedView = [...view];
		if (persistTimer) clearTimeout(persistTimer);
		persistTimer = setTimeout(() => {
			rememberMoleculeView(viewKey, view);
			persistence.textContent = moleculeViewContext.save ? '视角有改动 · 尚未写入文章' : '临时视角';
		}, 180);
	});

	const onThemeChange = (event: Event) => {
		if (!figure.isConnected) {
			window.removeEventListener('themechange', onThemeChange);
			return;
		}
		viewer.setBackgroundColor((event as CustomEvent<string>).detail === 'dark' ? '#181c1b' : '#ffffff');
		viewer.render();
	};
	window.addEventListener('themechange', onThemeChange);
	return {
		markDisplayDirty: () => {
			persistence.textContent = moleculeViewContext.save
				? '显示有改动 · 尚未写入文章'
				: '临时显示参数';
		},
	};
}

function createFigure(kind: string, source: string, loadingText: string): HTMLElement {
	const figure = document.createElement('figure');
	figure.className = `chem-viewer ${kind}`;
	const stage = document.createElement('div');
	stage.className = 'chem-stage';
	stage.setAttribute('role', 'img');
	stage.setAttribute('aria-label', loadingText);
	stage.textContent = loadingText;
	const caption = document.createElement('figcaption');
	caption.textContent = source;
	figure.append(stage, caption);
	return figure;
}

function errorFigure(label: string, message: string): HTMLElement {
	return createFigure('chem-error', label, message);
}

/** Build a sanitizer-safe placeholder for Milkdown or a ready error/resource figure. */
export function createMoleculePreview(language: string, source: string): HTMLElement | null {
	try {
		const block = parseMoleculeBlock(language, source);
		if (!block) return null;
		const renderInput = prepareMoleculeRenderInput(block);
		if (renderInput.status === 'needs-resource') {
			return createFigure('chem-resource', renderInput.resource.path, '文章资源将在文件解析器接入后显示');
		}

		const figure = createFigure(
			renderInput.renderer === 'rdkit' ? 'chem-2d' : 'chem-3d',
			renderInput.label,
			renderInput.renderer === 'rdkit' ? '正在生成二维结构…' : '正在加载三维结构…',
		);
		figure.dataset.sciencePreview = JSON.stringify(renderInput);
		return figure;
	} catch (error) {
		return errorFigure(language.toUpperCase(), error instanceof Error ? error.message : '无法解析科学内容');
	}
}

export async function hydrateMoleculePreview(figure: HTMLElement): Promise<void> {
	const stage = figure.querySelector<HTMLElement>('.chem-stage');
	if (!stage || !figure.dataset.sciencePreview) return;

	try {
		const renderInput = JSON.parse(figure.dataset.sciencePreview) as ReturnType<typeof prepareMoleculeRenderInput>;
		if (renderInput.status !== 'ready') return;

		if (renderInput.renderer === 'rdkit') {
			const RDKit = await loadRDKit();
			if (!figure.isConnected) return;
			const { mol, problem } = readMolecule(RDKit, renderInput.source);
			try {
				// No background: the structure sits on the page itself, light or dark.
				stage.innerHTML = mol.get_svg_with_highlights(JSON.stringify({ width: 720, height: 360, clearBackground: false }));
				stage.setAttribute('aria-label', `${renderInput.block.language} 二维分子结构`);
			} finally {
				mol.delete();
			}
			figure.querySelector('.chem-warning')?.remove();
			if (problem) {
				const warning = document.createElement('p');
				warning.className = 'chem-warning';
				warning.setAttribute('role', 'note');
				warning.textContent = `结构有问题，按原样显示：${problem}`;
				stage.after(warning);
			}
			return;
		}

		const $3Dmol = await load3Dmol();
		if (!figure.isConnected) return;
		stage.textContent = '';
		const viewer = $3Dmol.createViewer(stage, {
			backgroundColor: document.documentElement.dataset.theme === 'dark' ? '#181c1b' : '#ffffff',
		});
		viewer.addModel(renderInput.source, renderInput.format);
		viewer.setStyle({}, { stick: { radius: 0.16 }, sphere: { scale: 0.28 } });
		stage.setAttribute('aria-label', `${renderInput.format} 三维分子结构，可拖动旋转和滚轮缩放`);
		mount3DMolInteraction(figure, stage, viewer, renderInput.format, renderInput.source);
	} catch (error) {
		stage.textContent = error instanceof Error ? error.message : '分子结构渲染失败';
		figure.classList.add('chem-error');
	}
}

export const moleculeSciencePlugin = {
	id: 'molecule',
	priority: 0,
	createPreview: createMoleculePreview,
	hydratePreview: hydrateMoleculePreview,
};
