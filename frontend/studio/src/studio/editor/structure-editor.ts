import { loadRDKit } from '@blog/science/browser/molecule-renderer.ts';
import { isEmptyMolfile } from './science-block.ts';

/** What a drawn structure becomes in the block: its new source, and its fence info when that has to change. */
export type DrawnStructure = { info: string; source: string };

type Standalone = typeof import('chem-structura/standalone');

let standalone: Promise<Standalone> | null = null;

/**
 * chem-structura is about a megabyte, so it loads when a structure is first
 * drawn. Its own RDKit stays separate from the site's: it loads from its CDN
 * only if the editor itself reads SMILES.
 */
function loadStandalone(): Promise<Standalone> {
	standalone ??= Promise.all([import('chem-structura/standalone'), import('chem-structura/style.css')]).then(
		([module]) => module,
	);
	standalone.catch(() => {
		standalone = null;
	});
	return standalone;
}

/** A SMILES as a molfile with 2D coordinates, as the structure editor reads it. */
export async function smilesToMolfile(smiles: string): Promise<string> {
	const rdkit = await loadRDKit();
	const mol = rdkit.get_mol(smiles);
	if (!mol?.is_valid()) {
		mol?.delete();
		throw new Error('这段 SMILES 读不出来，先在源码里改对再画');
	}
	try {
		mol.set_new_coords(true);
		return mol.get_molblock();
	} finally {
		mol.delete();
	}
}

/** Canonical SMILES of a molfile or a SMILES string, or null when RDKit cannot read it. */
async function canonicalSmiles(source: string): Promise<string | null> {
	const rdkit = await loadRDKit();
	const mol = rdkit.get_mol(source);
	try {
		return mol?.is_valid() ? mol.get_smiles() : null;
	} finally {
		mol?.delete();
	}
}

/**
 * What a drawing becomes in the block: a molfile for a molfile block; for a
 * SMILES block its SMILES (the author's own spelling when it is the same
 * molecule), or an SDF block when SMILES cannot hold what was drawn.
 */
async function drawnSource(form: 'smiles' | 'molfile', info: string, source: string, molfile: string): Promise<DrawnStructure> {
	if (isEmptyMolfile(molfile)) return { info, source: '' };
	if (form === 'molfile') return { info, source: molfile.replace(/\s+$/, '') };
	const smiles = await canonicalSmiles(molfile);
	if (!smiles) return { info: 'sdf', source: molfile.replace(/\s+$/, '') };
	// Same molecule: keep the author's own SMILES rather than RDKit's canonical spelling.
	const text = source.trim();
	if (text && (await canonicalSmiles(text)) === smiles) return { info, source };
	return { info, source: smiles };
}

/**
 * The structure editor in `host` (which it fills), on a block's structure;
 * what is drawn is handed to `drawn` as the block's new fence a moment after
 * each change. `current` is the block as it is then (a SMILES block's own
 * spelling is kept against it); `dismiss`, an Esc the editor had no use for.
 * Resolves once the editor is on the page.
 */
export async function mountStructureEditor(
	host: HTMLElement,
	form: 'smiles' | 'molfile',
	start: { info: string; source: string },
	{ current, drawn, dismiss }: { current: () => { info: string; source: string }; drawn: (structure: DrawnStructure) => void; dismiss?: () => void },
): Promise<{ dispose(): void }> {
	const text = start.source.trim();
	const [chem, molfile] = await Promise.all([
		loadStandalone(),
		form === 'smiles' && text ? smilesToMolfile(text) : Promise.resolve(text || undefined),
	]);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let latest: string | null = null;
	const write = async () => {
		if (latest === null) return;
		const molfileNow = latest;
		latest = null;
		const block = current();
		// A SMILES block that became SDF is a molfile block from then on.
		drawn(await drawnSource(block.info.trim().toLowerCase() === 'smiles' ? 'smiles' : 'molfile', block.info, block.source, molfileNow));
	};
	const editor = chem.mount(host, {
		initialMolfile: molfile,
		onChange: (changed) => {
			latest = changed;
			clearTimeout(timer);
			timer = setTimeout(() => void write(), 500);
		},
		// Esc once the editor has no use for it (nothing to stop or unselect, the lasso in hand).
		...(dismiss ? { onDismiss: dismiss } : {}),
	});
	// The editor takes keys (⌫, ⌘Z, a letter for an element) only when they come from inside it; in the
	// sheet they would go to the sheet itself. Focusable, it is focused, and a click anywhere in it focuses it.
	const app = host.querySelector<HTMLElement>('.chem-app');
	if (app) {
		app.tabIndex = -1;
		const typing = document.activeElement?.closest('input, textarea, [contenteditable]:not([contenteditable="false"])');
		if (host.isConnected && !typing) app.focus({ preventScroll: true });
	}
	return {
		dispose: () => {
			clearTimeout(timer);
			// What was drawn last is written before the editor goes.
			void write();
			editor.unmount();
		},
	};
}
