export type ScienceResourceRef =
	| { kind: 'inline'; text: string }
	| { kind: 'file'; path: string };

export type MoleculeView = '2d' | '3d' | 'auto';

export type MoleculeViewerFormat = 'sdf' | 'xyz' | 'pdb' | 'mol2' | 'cif' | 'cube';

/** A DOM-free description of a fenced molecular-data block. */
export type MoleculeBlock = {
	type: 'molecule';
	language: string;
	view: MoleculeView;
	resource: ScienceResourceRef;
	viewerFormat?: MoleculeViewerFormat;
};
