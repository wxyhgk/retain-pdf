import { parseCubeBlock } from '../parsers/index.ts';
import {
	CUBE_DISPLAY_DEFAULTS,
	CUBE_ISOVALUE_MAX,
	CUBE_ISOVALUE_MIN,
	CUBE_ISOVALUE_STEP,
	CUBE_OPACITY_MAX,
	CUBE_OPACITY_MIN,
	CUBE_OPACITY_STEP,
	normalizeCubeDisplaySettings,
	type CubeDisplaySettings,
	type CubeMoleculeStyle,
} from '../cube-display.mjs';
import {
	load3Dmol,
	mount3DMolInteraction,
	readSavedMoleculeDisplay,
	type ThreeDMolViewer,
} from './molecule-renderer.ts';
import { resolveScienceResourceUrl } from './resource-context.ts';

const MAX_FETCHED_CUBE_BYTES = 8 * 1024 * 1024;

type CubePreviewPayload =
	| { kind: 'inline'; source: string; label: string }
	| { kind: 'file'; path: string; label: string };

function createCubeFigure(label: string, loadingText: string): HTMLElement {
	const figure = document.createElement('figure');
	figure.className = 'chem-viewer chem-3d cube-volume';
	const stage = document.createElement('div');
	stage.className = 'chem-stage';
	stage.setAttribute('role', 'img');
	stage.setAttribute('aria-label', loadingText);
	stage.textContent = loadingText;
	const caption = document.createElement('figcaption');
	caption.textContent = label;
	figure.append(stage, caption);
	return figure;
}

function errorFigure(label: string, message: string): HTMLElement {
	const figure = createCubeFigure(label, message);
	figure.classList.add('chem-error');
	return figure;
}

export function createCubePreview(language: string, source: string): HTMLElement | null {
	try {
		const block = parseCubeBlock(language, source);
		if (!block) return null;
		const payload: CubePreviewPayload = block.resource.kind === 'file'
			? { kind: 'file', path: block.resource.path, label: block.resource.path }
			: { kind: 'inline', source: block.resource.text, label: 'CUBE · 内联体数据' };
		const figure = createCubeFigure(payload.label, '正在载入 Cube 体数据…');
		// @file previews contain only a small validated bundle path, never the multi-megabyte file.
		figure.dataset.sciencePreview = JSON.stringify(payload);
		return figure;
	} catch (error) {
		return errorFigure('CUBE', error instanceof Error ? error.message : '无法解析 Cube 内容');
	}
}

async function fetchCube(path: string): Promise<string> {
	const url = resolveScienceResourceUrl(path);
	const response = await fetch(url, { credentials: 'same-origin' });
	if (!response.ok) throw new Error(`Cube 文件读取失败（HTTP ${response.status}）`);
	const declaredSize = Number(response.headers.get('content-length'));
	if (Number.isFinite(declaredSize) && declaredSize > MAX_FETCHED_CUBE_BYTES) {
		throw new Error('Cube 文件超过 8 MB 渲染上限');
	}
	const source = await response.text();
	if (source.length > MAX_FETCHED_CUBE_BYTES) throw new Error('Cube 文件超过 8 MB 渲染上限');
	return source;
}

function moleculeStyle(style: CubeMoleculeStyle): object {
	if (style === 'sphere') return { sphere: { scale: 0.34, colorscheme: 'Jmol' } };
	if (style === 'line') return { line: { linewidth: 1.5, colorscheme: 'Jmol' } };
	return {
		stick: { radius: 0.12, colorscheme: 'Jmol' },
		sphere: { scale: 0.2, colorscheme: 'Jmol' },
	};
}

export function cubeSurfaceSpecs(settings: CubeDisplaySettings): Array<{ isoval: number; color: string; opacity: number }> {
	const specs = [];
	if (settings.positive) specs.push({ isoval: settings.isovalue, color: '#2563eb', opacity: settings.opacity });
	if (settings.negative) specs.push({ isoval: -settings.isovalue, color: '#dc2626', opacity: settings.opacity });
	return specs;
}

function applyCubeDisplay(
	figure: HTMLElement,
	viewer: ThreeDMolViewer,
	volumeData: unknown,
	settings: CubeDisplaySettings,
	surfaces: unknown[],
): void {
	for (const surface of surfaces.splice(0)) viewer.removeShape(surface);
	viewer.setStyle({}, moleculeStyle(settings.moleculeStyle));
	const specs = cubeSurfaceSpecs(settings);
	for (const spec of specs) surfaces.push(viewer.addIsosurface(volumeData, spec));
	viewer.render();
	figure.dataset.cubeSurfaceCount = String(specs.length);
	figure.dataset.cubeDisplay = JSON.stringify(settings);
}

function rangeControl(
	labelText: string,
	value: number,
	min: number,
	max: number,
	step: number,
): { field: HTMLLabelElement; input: HTMLInputElement; output: HTMLOutputElement } {
	const field = document.createElement('label');
	field.className = 'cube-control cube-range';
	const label = document.createElement('span');
	label.textContent = labelText;
	const output = document.createElement('output');
	output.value = value.toFixed(3).replace(/0+$/u, '').replace(/\.$/u, '');
	const input = document.createElement('input');
	input.type = 'range';
	input.min = String(min);
	input.max = String(max);
	input.step = String(step);
	input.value = String(value);
	input.setAttribute('aria-label', labelText);
	field.append(label, output, input);
	return { field, input, output };
}

function createCubeControls(
	settings: CubeDisplaySettings,
	apply: () => void,
): HTMLElement {
	const panel = document.createElement('fieldset');
	panel.className = 'cube-controls';
	const legend = document.createElement('legend');
	legend.textContent = 'Cube 显示';
	const grid = document.createElement('div');
	grid.className = 'cube-control-grid';

	const iso = rangeControl('等值面 |ψ|', settings.isovalue, CUBE_ISOVALUE_MIN, CUBE_ISOVALUE_MAX, CUBE_ISOVALUE_STEP);
	const opacity = rangeControl('表面透明度', settings.opacity, CUBE_OPACITY_MIN, CUBE_OPACITY_MAX, CUBE_OPACITY_STEP);
	const syncRangeOutput = (control: ReturnType<typeof rangeControl>, digits: number) => {
		control.output.value = Number(control.input.value).toFixed(digits).replace(/0+$/u, '').replace(/\.$/u, '');
	};
	iso.input.addEventListener('input', () => syncRangeOutput(iso, 3));
	opacity.input.addEventListener('input', () => syncRangeOutput(opacity, 2));
	iso.input.addEventListener('change', () => { settings.isovalue = Number(iso.input.value); apply(); });
	opacity.input.addEventListener('change', () => { settings.opacity = Number(opacity.input.value); apply(); });

	const phaseGroup = document.createElement('div');
	phaseGroup.className = 'cube-control cube-phase-control';
	const phaseLabel = document.createElement('span');
	phaseLabel.textContent = '等值面相位';
	const phaseOptions = document.createElement('div');
	for (const [key, text, className] of [
		['positive', '正相位', 'positive'],
		['negative', '负相位', 'negative'],
	] as const) {
		const label = document.createElement('label');
		const input = document.createElement('input');
		input.type = 'checkbox';
		input.checked = settings[key];
		input.setAttribute('aria-label', `显示${text}`);
		input.addEventListener('change', () => { settings[key] = input.checked; apply(); });
		const swatch = document.createElement('i');
		swatch.className = className;
		label.append(input, swatch, document.createTextNode(text));
		phaseOptions.append(label);
	}
	phaseGroup.append(phaseLabel, phaseOptions);

	const styleField = document.createElement('label');
	styleField.className = 'cube-control';
	const styleLabel = document.createElement('span');
	styleLabel.textContent = '分子骨架';
	const styleSelect = document.createElement('select');
	styleSelect.setAttribute('aria-label', '分子骨架显示方式');
	for (const [value, text] of [['stick', 'Stick'], ['sphere', 'Sphere'], ['line', 'Line']] as const) {
		const option = document.createElement('option');
		option.value = value;
		option.textContent = text;
		option.selected = value === settings.moleculeStyle;
		styleSelect.append(option);
	}
	styleSelect.addEventListener('change', () => { settings.moleculeStyle = styleSelect.value as CubeMoleculeStyle; apply(); });
	styleField.append(styleLabel, styleSelect);

	const reset = document.createElement('button');
	reset.type = 'button';
	reset.className = 'cube-reset-display';
	reset.textContent = '恢复默认显示';
	reset.setAttribute('aria-label', '恢复 Cube 默认显示参数');
	reset.addEventListener('click', () => {
		Object.assign(settings, CUBE_DISPLAY_DEFAULTS);
		iso.input.value = String(settings.isovalue);
		opacity.input.value = String(settings.opacity);
		syncRangeOutput(iso, 3);
		syncRangeOutput(opacity, 2);
		const checkboxes = phaseOptions.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
		checkboxes[0]!.checked = settings.positive;
		checkboxes[1]!.checked = settings.negative;
		styleSelect.value = settings.moleculeStyle;
		apply();
	});

	grid.append(iso.field, opacity.field, phaseGroup, styleField);
	panel.append(legend, grid, reset);
	return panel;
}

export async function hydrateCubePreview(figure: HTMLElement): Promise<void> {
	const stage = figure.querySelector<HTMLElement>('.chem-stage');
	if (!stage || !figure.dataset.sciencePreview) return;
	try {
		const payload = JSON.parse(figure.dataset.sciencePreview) as CubePreviewPayload;
		const source = payload.kind === 'file' ? await fetchCube(payload.path) : payload.source;
		const $3Dmol = await load3Dmol();
		if (!figure.isConnected) return;
		stage.textContent = '';
		const viewer = $3Dmol.createViewer(stage, {
			backgroundColor: document.documentElement.dataset.theme === 'dark' ? '#181c1b' : '#ffffff',
		});
		const viewIdentity = payload.kind === 'file' ? payload.path : source;
		const settings = normalizeCubeDisplaySettings(readSavedMoleculeDisplay('cube', viewIdentity));
		const volumeData = new $3Dmol.VolumeData(source, 'cube');
		const surfaces: unknown[] = [];
		viewer.addModel(source, 'cube');
		applyCubeDisplay(figure, viewer, volumeData, settings, surfaces);
		stage.setAttribute('aria-label', 'Cube 分子轨道：分子骨架与正负等值面，可拖动旋转和滚轮缩放');
		const interaction = mount3DMolInteraction(
			figure,
			stage,
			viewer,
			'cube',
			viewIdentity,
			{ getDisplay: () => ({ ...settings }) },
		);
		stage.after(createCubeControls(settings, () => {
			applyCubeDisplay(figure, viewer, volumeData, settings, surfaces);
			interaction.markDisplayDirty();
		}));
	} catch (error) {
		stage.textContent = error instanceof Error ? error.message : 'Cube 体数据渲染失败';
		figure.classList.add('chem-error');
	}
}

export const cubeSciencePlugin = {
	id: 'cube-volume',
	priority: 100,
	createPreview: createCubePreview,
	hydratePreview: hydrateCubePreview,
};
