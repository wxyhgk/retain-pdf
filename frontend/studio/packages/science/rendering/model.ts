import type { MoleculeBlock, MoleculeView, MoleculeViewerFormat, ScienceResourceRef } from '../model.ts';

export type ReadyMoleculeRenderInput =
	| {
		status: 'ready';
		renderer: 'rdkit';
		source: string;
		label: string;
		block: MoleculeBlock;
	}
	| {
		status: 'ready';
		renderer: '3dmol';
		source: string;
		format: MoleculeViewerFormat;
		label: string;
		block: MoleculeBlock;
	};

export type PendingMoleculeRenderInput = {
	status: 'needs-resource';
	resource: Extract<ScienceResourceRef, { kind: 'file' }>;
	requestedView: MoleculeView;
	block: MoleculeBlock;
};

/** Common input consumed by both the blog adapter and future Studio NodeViews. */
export type MoleculeRenderInput = ReadyMoleculeRenderInput | PendingMoleculeRenderInput;

/** UI-independent actions a renderer host may choose to expose. */
export type ScienceRendererIntent =
	| { type: 'edit-source' }
	| { type: 'retry-render' }
	| { type: 'open-resource'; path: string }
	| { type: 'replace-resource'; path?: string }
	| { type: 'set-molecule-view'; view: Exclude<MoleculeView, 'auto'> };

/** Minimal host seam; neither the parser nor a widget owns persistence. */
export interface ScienceRendererAdapter<Handle = unknown> {
	render(input: ReadyMoleculeRenderInput): Handle | Promise<Handle>;
	dispose?(handle: Handle): void;
}
