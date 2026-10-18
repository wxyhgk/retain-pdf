import type { MoleculeBlock, MoleculeView } from '../model.ts';
import { gaussianToXyz } from '../parsers/gaussian.ts';
import { sdfHas3DCoordinates } from '../parsers/sdf.ts';
import type { MoleculeRenderInput } from './model.ts';

function resolvedView(block: MoleculeBlock, source: string): MoleculeView {
	if (block.view !== 'auto') return block.view;
	return sdfHas3DCoordinates(source) ? '3d' : '2d';
}

/**
 * Prepare a parsed molecule block for a renderer without accessing the DOM or filesystem.
 * Hosts may provide `resolvedFileSource` after resolving an `@file` reference themselves.
 */
export function prepareMoleculeRenderInput(
	block: MoleculeBlock,
	resolvedFileSource?: string,
): MoleculeRenderInput {
	if (block.resource.kind === 'file' && resolvedFileSource === undefined) {
		return {
			status: 'needs-resource',
			resource: block.resource,
			requestedView: block.view,
			block,
		};
	}

	const source = block.resource.kind === 'inline' ? block.resource.text : resolvedFileSource!;
	const view = resolvedView(block, source);
	const label = block.resource.kind === 'file'
		? block.resource.path
		: block.language === 'smiles'
			? `SMILES · ${source}`
			: block.language.toUpperCase();

	if (view === '2d') {
		return { status: 'ready', renderer: 'rdkit', source, label, block };
	}

	if (!block.viewerFormat) {
		throw new Error(`三维格式 ${block.language} 缺少 viewerFormat`);
	}
	return {
		status: 'ready',
		renderer: '3dmol',
		source: block.language === 'gjf' || block.language === 'com' ? gaussianToXyz(source) : source,
		format: block.viewerFormat,
		label,
		block,
	};
}
