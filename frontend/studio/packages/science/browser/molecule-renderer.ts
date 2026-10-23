import { parseMoleculeBlock } from '../parsers/index.ts';
import { prepareMoleculeRenderInput } from '../rendering/index.ts';
import { describeRDKitError } from '../rendering/rdkit-messages.ts';
import { moleculeViewKey } from '../view-key.mjs';
import { isFastMolView } from '../view-state.mjs';
import { createMoleculeViewer, type FastMolViewer } from './fast-mol.ts';

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

type ChemistryWindow = Window & {
	initRDKitModule?: (options: { locateFile: (file: string) => string }) => Promise<RDKitModule>;
	__rdkitPromise?: Promise<RDKitModule>;
};

/** Views turned to on this page, not saved: a block drawn again shows the molecule as it was left. */
const moleculeViewMemory = new Map<string, unknown>();

/** A saved view (view-state.mjs): fast-mol's; one 3Dmol saved before is kept in the file but not read. */
export type SavedMoleculeView = { format: string; view: unknown; display?: unknown };
type MoleculeViewContext = {
	views: Record<string, SavedMoleculeView>;
	save?: (key: string, format: string, view: unknown, display?: unknown) => Promise<void>;
};

let moleculeViewContext: MoleculeViewContext = { views: {} };

export function setMoleculeViewContext(context: MoleculeViewContext): void {
	moleculeViewMemory.clear();
	moleculeViewContext = context;
}

export { moleculeViewKey };

/** The view turned to on this page, or else the one saved, when `control`'s viewer keeps that kind. */
function readMoleculeView<View>(key: string, format: string, control: ViewControl<View>): View | null {
	const remembered = moleculeViewMemory.get(key);
	if (control.accepts(remembered)) return structuredClone(remembered);
	const saved = moleculeViewContext.views[key];
	if (!saved || saved.format !== format || !control.accepts(saved.view)) return null;
	return structuredClone(saved.view);
}

export function readSavedMoleculeDisplay(format: string, viewIdentity: string): unknown {
	const saved = moleculeViewContext.views[moleculeViewKey(format, viewIdentity)];
	return saved?.format === format ? saved.display : undefined;
}

function rememberMoleculeView(key: string, view: unknown): void {
	moleculeViewMemory.set(key, structuredClone(view));
}

function clearMoleculeView(key: string): void {
	moleculeViewMemory.delete(key);
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

/**
 * What the view controls do to a viewer: read and set how it is turned (`View`, the kind it keeps),
 * go back to the view it chose itself, and say when it was turned (returns what stops listening).
 */
export type ViewControl<View> = {
	accepts(view: unknown): view is View;
	get(): View;
	set(view: View): void;
	reset(): void;
	onTurn(listener: () => void): () => void;
};

/** A fast-mol viewer's view: turned by dragging, zoomed by the wheel, both read when they end. */
export function fastMolViewControl(viewer: FastMolViewer): ViewControl<unknown> {
	return {
		accepts: (view): view is unknown => isFastMolView(view),
		get: () => structuredClone(viewer.view),
		set: (view) => {
			viewer.view = structuredClone(view);
		},
		reset: () => viewer.resetView(),
		onTurn(listener) {
			const canvas = viewer.canvas;
			let last = JSON.stringify(viewer.view);
			let timer: ReturnType<typeof setTimeout> | undefined;
			const check = () => {
				clearTimeout(timer);
				timer = setTimeout(() => {
					const now = JSON.stringify(viewer.view);
					if (now === last) return;
					last = now;
					listener();
				}, 180);
			};
			const events = ['pointerup', 'wheel', 'keyup'] as const;
			for (const name of events) canvas.addEventListener(name, check, { passive: true });
			return () => {
				clearTimeout(timer);
				for (const name of events) canvas.removeEventListener(name, check);
			};
		},
	};
}

/**
 * The controls under a 3D molecule: the view the article saved (or the one turned to on this page)
 * shown first, 重置视角, and in the Studio 保存视角到文章 (with the display, when `getDisplay` says
 * what it is: a cube's surfaces).
 */
export function mountViewControls<View>(
	figure: HTMLElement,
	stage: HTMLElement,
	control: ViewControl<View>,
	format: string,
	viewIdentity: string,
	options: { getDisplay?: () => unknown } = {},
): { markDisplayDirty: () => void } {
	const viewKey = moleculeViewKey(format, viewIdentity);
	const storedView = readMoleculeView(viewKey, format, control);
	if (storedView) control.set(storedView);
	/** The view last loaded, saved or reset to: a turn noticed late (after a save) that ends there changes nothing. */
	let settled = JSON.stringify(control.get());

	const controls = document.createElement('div');
	controls.className = 'chem-view-controls';
	const persistence = document.createElement('span');
	persistence.textContent = storedView ? '已载入文章视角' : '使用自动视角';
	const resetView = document.createElement('button');
	resetView.type = 'button';
	resetView.textContent = '重置视角';
	resetView.addEventListener('click', () => {
		clearMoleculeView(viewKey);
		control.reset();
		settled = JSON.stringify(control.get());
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
				const view = control.get();
				const display = options.getDisplay?.();
				await moleculeViewContext.save?.(viewKey, format, view, display);
				moleculeViewContext.views[viewKey] = { format, view: structuredClone(view), display };
				rememberMoleculeView(viewKey, view);
				settled = JSON.stringify(view);
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

	const stop = control.onTurn(() => {
		if (!figure.isConnected) {
			stop();
			return;
		}
		const view = control.get();
		if (JSON.stringify(view) === settled) return;
		rememberMoleculeView(viewKey, view);
		persistence.textContent = moleculeViewContext.save ? '视角有改动 · 尚未写入文章' : '临时视角';
	});
	return {
		markDisplayDirty: () => {
			persistence.textContent = moleculeViewContext.save ? '显示有改动 · 尚未写入文章' : '临时显示参数';
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

		stage.textContent = '';
		const viewer = await createMoleculeViewer(stage);
		if (!figure.isConnected) return viewer.dispose();
		viewer.loadText(renderInput.source, renderInput.format);
		stage.setAttribute('aria-label', `${renderInput.format} 三维分子结构，可拖动旋转和滚轮缩放`);
		mountViewControls(figure, stage, fastMolViewControl(viewer), renderInput.format, renderInput.source);
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
