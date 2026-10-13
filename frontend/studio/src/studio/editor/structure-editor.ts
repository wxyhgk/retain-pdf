import { loadRDKit, readMolecule } from '../../science/browser/molecule-renderer.ts';
import { isEmptyMolfile } from './science-block.ts';

/** What a drawn structure becomes in the block: its new source, and its fence info when that has to change. */
export type DrawnStructure = { info: string; source: string };

type Standalone = typeof import('chem-structura/standalone');

let standalone: Promise<Standalone> | null = null;

/**
 * chem-structura is about a megabyte with React inside, so it loads on the
 * first 画结构 only. Its own RDKit stays separate from the site's: it loads
 * from its CDN only if the editor itself reads SMILES.
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

async function smilesToMolfile(smiles: string): Promise<string> {
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

/** Why RDKit refuses a molfile, or null when it reads cleanly. Empty pages have nothing to refuse. */
async function structureProblem(molfile: string): Promise<string | null> {
	if (isEmptyMolfile(molfile)) return null;
	const { mol, problem } = readMolecule(await loadRDKit(), molfile);
	mol.delete();
	return problem;
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
 * Open the structure editor over the page on a block's source. Resolves to
 * the new source, or null when the editor was cancelled. A SMILES block
 * that draws into something SMILES cannot hold (a generic R group, say)
 * becomes an SDF block, so nothing drawn is lost.
 */
export async function drawStructure(
	form: 'smiles' | 'molfile',
	info: string,
	source: string,
	title: string,
): Promise<DrawnStructure | null> {
	const text = source.trim();
	const [chem, molfile] = await Promise.all([
		loadStandalone(),
		form === 'smiles' && text ? smilesToMolfile(text) : Promise.resolve(text || undefined),
	]);
	let saved = await chem.edit({ title, molfile });
	// A structure RDKit refuses still saves, as drawn, but only once the author has seen why.
	while (saved) {
		const problem = await structureProblem(saved.molfile);
		if (!problem) break;
		if (window.confirm(`结构有问题：${problem}。\n\n确定：照这样写入（块里会按原样显示并提示）。\n取消：回到编辑器修改。`)) break;
		saved = await chem.edit({ title, molfile: saved.molfile });
	}
	if (!saved) return null;
	if (isEmptyMolfile(saved.molfile)) return { info, source: '' };
	if (form === 'molfile') return { info, source: saved.molfile.replace(/\s+$/, '') };
	const smiles = await canonicalSmiles(saved.molfile);
	if (!smiles) return { info: 'sdf', source: saved.molfile.replace(/\s+$/, '') };
	// Same molecule: keep the author's own SMILES rather than RDKit's canonical spelling.
	if (text && (await canonicalSmiles(text)) === smiles) return { info, source };
	return { info, source: smiles };
}
