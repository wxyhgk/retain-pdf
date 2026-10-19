import './molecule-editor-3d.css';

/**
 * A structure edited in 3D: RetainMol's editor (@retainmol/viewer, React and
 * three.js, third_party/retainmol) in a panel of the Studio, under a bar of
 * the Studio's own (撤销, 重做, how it is drawn, labels, delete, fit). It
 * builds as RetainMol does: a click on a hydrogen grows the chain there, on
 * a bond fuses a ring, a right click changes an atom, Esc goes to selecting;
 * dragging turns the view. What it holds comes out as XYZ or MOL.
 *
 * Loaded when first opened: React, three.js and the editor are a few
 * megabytes the Studio does not need until then, and the blog never does.
 */

export type StructureFormat = 'xyz' | 'mol';

export type Editor3D = {
	/** What it holds now, written as `format`. */
	source(format: StructureFormat): string;
	/** Atoms, and the formula. */
	describe(): { atoms: number; formula: string };
	/** Whether anything was changed since it opened. */
	changed(): boolean;
	dispose(): void;
};

type Modules = {
	React: typeof import('react');
	ReactDOM: typeof import('react-dom/client');
	viewer: typeof import('@retainmol/viewer/viewer');
	runtime: typeof import('@retainmol/viewer/runtime');
	io: typeof import('@retainmol/core/io');
};

let loading: Promise<Modules> | null = null;

function load(): Promise<Modules> {
	loading ??= Promise.all([
		import('react'),
		import('react-dom/client'),
		import('@retainmol/viewer/viewer'),
		import('@retainmol/viewer/runtime'),
		import('@retainmol/core/io'),
		// The utilities its overlays are written with (Tailwind's, without its reset of the page).
		import('../../../third_party/retainmol/viewer.css'),
	]).then(([React, ReactDOM, viewer, runtime, io]) => ({ React, ReactDOM, viewer, runtime, io }));
	loading.catch(() => {
		loading = null;
	});
	return loading;
}

type Molecule = import('@retainmol/core/io').Molecule;

/** A molecule as XYZ: its atoms where they are, the formula as the comment. */
export function moleculeToXyz(molecule: Molecule): string {
	const rows = molecule.atoms.map((atom) => `${atom.symbol.padEnd(2)} ${[atom.x, atom.y, atom.z].map((value) => value.toFixed(6).padStart(12)).join(' ')}`);
	return [String(molecule.atoms.length), formulaOf(molecule), ...rows].join('\n');
}

/** Hill order: C, H, then the rest by symbol. */
export function formulaOf(molecule: Pick<Molecule, 'atoms'>): string {
	const counts = new Map<string, number>();
	for (const { symbol } of molecule.atoms) counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
	const order = counts.has('C') ? ['C', 'H'].filter((name) => counts.has(name)) : [];
	const names = [...order, ...[...counts.keys()].filter((name) => !order.includes(name)).sort()];
	return names.map((name) => `${name}${counts.get(name) === 1 ? '' : counts.get(name)}`).join('');
}

function button(label: string, title: string): HTMLButtonElement {
	const made = document.createElement('button');
	made.type = 'button';
	made.className = 'm3d-button';
	made.textContent = label;
	made.title = title;
	return made;
}

const isDark = () => document.documentElement.dataset.theme === 'dark';

/**
 * Opens `source` (XYZ, MOL or SDF) in the editor inside `host`, which it
 * fills; `changed` is told after every edit.
 */
export async function open3DEditor(host: HTMLElement, source: string, { changed }: { changed?: () => void } = {}): Promise<Editor3D> {
	host.classList.add('m3d');
	const bar = document.createElement('div');
	bar.className = 'm3d-bar';
	const stage = document.createElement('div');
	stage.className = 'm3d-stage';
	stage.textContent = '正在载入三维编辑器…';
	const status = document.createElement('p');
	status.className = 'm3d-status';
	host.replaceChildren(bar, stage, status);

	const { React, ReactDOM, viewer, runtime: runtimes, io } = await load();
	const parsed = io.parseClipboard(source);
	if (parsed.format === 'unknown' || !parsed.molecule.atoms.length) throw new Error('这段结构读不出来：要 XYZ、MOL 或 SDF');

	const runtime = runtimes.createViewerRuntime();
	const api = runtimes.getViewerApi(runtime);
	api.setMolecule(parsed.molecule);
	api.history.clear();
	const start = api.getSnapshot().molecule;

	const undo = button('撤销', '撤销（⌘Z）');
	const redo = button('重做', '重做（⇧⌘Z）');
	const remove = button('删除选中', '删除选中的原子和键');
	const fit = button('适配', '让整个分子进入视野');
	const labels = document.createElement('label');
	labels.className = 'm3d-check';
	const labelsBox = document.createElement('input');
	labelsBox.type = 'checkbox';
	labels.append(labelsBox, '原子标签');
	const mode = document.createElement('select');
	mode.className = 'm3d-select';
	mode.setAttribute('aria-label', '显示方式');
	for (const [value, text] of [['ball-stick', '球棍'], ['stick', '棍状'], ['spacefill', '空间填充'], ['wireframe', '线框']]) {
		const option = document.createElement('option');
		option.value = value;
		option.textContent = text;
		mode.append(option);
	}
	const space = document.createElement('span');
	space.className = 'm3d-space';
	bar.append(undo, redo, remove, space, mode, labels, fit);

	const paint = () => {
		const snapshot = api.getSnapshot();
		undo.disabled = !snapshot.history.canUndo;
		redo.disabled = !snapshot.history.canRedo;
		remove.disabled = !snapshot.selectedAtomIds.length && !snapshot.selectedBondIds.length;
		mode.value = snapshot.displayMode;
		labelsBox.checked = snapshot.showAtomLabels;
		const selected = snapshot.selectedAtomIds.length;
		// How to edit, the editor says itself, at the bottom of its view.
		status.textContent = `${formulaOf(snapshot.molecule)} · ${snapshot.molecule.atoms.length} 个原子${selected ? ` · 选中 ${selected} 个` : ''}`;
	};
	let lastMolecule = start;
	const stop = api.subscribe(() => {
		paint();
		const molecule = api.getSnapshot().molecule;
		if (molecule !== lastMolecule) {
			lastMolecule = molecule;
			changed?.();
		}
	});
	const run = (action: () => void) => () => {
		try {
			action();
		} catch (error) {
			status.textContent = `没能做到：${error instanceof Error ? error.message : String(error)}`;
		}
	};
	undo.addEventListener('click', run(() => api.history.undo()));
	redo.addEventListener('click', run(() => api.history.redo()));
	remove.addEventListener('click', run(() => api.edit.removeSelected()));
	fit.addEventListener('click', () => api.view.fit());
	mode.addEventListener('change', () => api.view.setDisplayMode(mode.value as Parameters<typeof api.view.setDisplayMode>[0]));
	labelsBox.addEventListener('change', () => api.view.setShowAtomLabels(labelsBox.checked));

	stage.textContent = '';
	const root = ReactDOM.createRoot(stage);
	// Its props are optional, which createElement's types do not follow: named here.
	const MolViewer = viewer.MolViewer as (props: import('@retainmol/viewer/viewer').MolViewerProps) => ReturnType<typeof viewer.MolViewer>;
	const draw = () => root.render(React.createElement(MolViewer, { runtime, interactionMode: 'edit', appearance: isDark() ? 'night' : 'day', style: { width: '100%', height: '100%' } }));
	draw();
	window.addEventListener('themechange', draw);
	paint();

	return {
		source: (format) => {
			const molecule = api.getSnapshot().molecule;
			return format === 'mol' ? io.exportMol(molecule) : moleculeToXyz(molecule);
		},
		describe: () => {
			const molecule = api.getSnapshot().molecule;
			return { atoms: molecule.atoms.length, formula: formulaOf(molecule) };
		},
		changed: () => api.getSnapshot().molecule !== start,
		dispose: () => {
			window.removeEventListener('themechange', draw);
			stop();
			root.unmount();
			runtime.dispose();
			host.classList.remove('m3d');
		},
	};
}
