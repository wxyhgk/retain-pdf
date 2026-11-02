export type ScienceResourceRef =
	| { kind: 'inline'; text: string }
	| { kind: 'file'; path: string };

export type MoleculeView = '2d' | '3d' | 'auto';

/** What fast-mol is given to draw (PDB, mol2 and CIF went with 3Dmol: a reader added to fast-mol brings one back). */
export type MoleculeViewerFormat = 'sdf' | 'xyz' | 'cube';

/** A DOM-free description of a fenced molecular-data block. */
export type MoleculeBlock = {
	type: 'molecule';
	language: string;
	view: MoleculeView;
	resource: ScienceResourceRef;
	viewerFormat?: MoleculeViewerFormat;
};
