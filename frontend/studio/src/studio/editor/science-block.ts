import { Fragment, Slice, type Node as ProseMirrorNode } from 'prosemirror-model';

import type { MoleculeBlock } from '../../science/model.ts';
import { isMoleculeLanguage, parseMoleculeBlock } from '../../science/parsers/molecule-block.ts';

/**
 * Science fenced-code blocks as first-class editor citizens.
 * Pure and DOM-free: classification, the block menu and its edits live here
 * so Node tests guard them; the Milkdown glue stays thin in
 * `./crepe-science-block.ts`. Reading and writing the fence is Milkdown's
 * (`$fencedBlock`), which keeps its language, meta and fence characters.
 */

/** The node scientific fences become in the editor. Its `language` attr holds the fence's language. */
export const SCIENCE_FENCE_TYPE = 'science-block';

export type ScienceBlockDescriptor = {
	/** Verbatim fence info string, preserved for byte-identical output. */
	info: string;
	/** Verbatim fence body. */
	source: string;
	/** Molecule classification; null when the source cannot be read (see `problem`). */
	block: MoleculeBlock | null;
	/** Why the source cannot be read, e.g. an `@file` outside the article's assets. */
	problem?: string;
};

/**
 * Describe a fence. Returns null when the language is not scientific,
 * so callers keep a single source of truth for recognition. Never throws:
 * a source that cannot be read (a bad `@file` path) is still a science
 * block, with `block: null` and the reason in `problem`.
 */
export function parseScienceFence(infoInput: string, source: string): ScienceBlockDescriptor | null {
	if (!isMoleculeLanguage(infoInput)) return null;
	try {
		return { info: infoInput, source, block: parseMoleculeBlock(infoInput, source) };
	} catch (error) {
		return { info: infoInput, source, block: null, problem: error instanceof Error ? error.message : String(error) };
	}
}

/** Emit the canonical fence for a descriptor. */
export function scienceFenceMarkdown(descriptor: ScienceBlockDescriptor): string {
	return `\`\`\`${descriptor.info}\n${descriptor.source}\n\`\`\``;
}

/** Languages offered by the slash menu and the block menu. */
export const SCIENCE_BLOCK_KINDS = [
	{ key: 'smiles', label: 'SMILES', info: 'smiles' },
	{ key: 'sdf', label: 'SDF', info: 'sdf' },
	{ key: 'xyz', label: 'XYZ', info: 'xyz' },
	{ key: 'gjf', label: 'GJF', info: 'gjf' },
	{ key: 'cube', label: 'Cube', info: 'cube' },
] as const;

export type ScienceBlockAction =
	| { type: 'insert'; info: string }
	| { type: 'convert'; info: string }
	| { type: 'delete' }
	| { type: 'edit' };

export type ScienceBlockEdit = {
	doc: ProseMirrorNode;
	/** Text position to place the cursor in the edited document. Null leaves the selection alone. */
	cursor: number | null;
};

export type ScienceBlockMenuItem = {
	section: '插入' | '转换' | '操作';
	id: string;
	label: string;
	current: boolean;
	action: ScienceBlockAction;
};

/** Short label for the fence info string. Unknown infos stay verbatim. */
export function scienceBlockKindLabel(info: string): string {
	const normalized = info.trim().toLowerCase();
	const kind = SCIENCE_BLOCK_KINDS.find((item) => item.info === normalized);
	return kind?.label ?? (info.trim() || '化学');
}

/**
 * Whether the structure editor can draw this block, and in which form it
 * reads and writes the source. Only 2D structures held in the block itself:
 * the editor is flat, so 3D coordinates would be lost, and an `@file`
 * reference has no text here to edit.
 */
export function structureDrawing(info: string, source: string): 'smiles' | 'molfile' | null {
	const language = info.trim().toLowerCase();
	let block: MoleculeBlock | null;
	try {
		block = parseMoleculeBlock(language, source);
	} catch {
		return null;
	}
	if (!block || block.resource.kind !== 'inline' || block.view !== '2d') return null;
	return language === 'smiles' ? 'smiles' : 'molfile';
}

/** A molfile with no atoms: what the structure editor saves for an empty page. */
export function isEmptyMolfile(molfile: string): boolean {
	const lines = molfile.split(/\r?\n/);
	const counts = lines[3] ?? '';
	if (/V3000/.test(counts)) return /M {2}V30 COUNTS 0 /.test(molfile);
	return !/\S/.test(molfile) || Number.parseInt(counts.slice(0, 3), 10) === 0;
}

export type ScienceSourceEditor = {
	label: string;
	placeholder: string;
	/** One-line sources edit like a formula: the popup covers the block and previews itself. */
	inline: boolean;
};

/**
 * How the source popup edits a block. SMILES is one line, so it mirrors
 * the formula popup. Coordinate and volume files are many lines and render
 * in 3D, so the popup sits below the block and the block itself previews.
 */
export function scienceSourceEditor(info: string): ScienceSourceEditor {
	const label = scienceBlockKindLabel(info);
	const inline = info.trim().toLowerCase() === 'smiles';
	return {
		label,
		placeholder: inline ? '输入 SMILES，例如 CCO' : `粘贴 ${label} 内容，或 @file ./assets/…`,
		inline,
	};
}

/**
 * Actions for the block under the handle. Insert stays on the slash menu
 * and the add button, so this list only changes the selected block.
 */
export function scienceBlockMenuItems(nodeName: string, info: string): ScienceBlockMenuItem[] {
	const items: ScienceBlockMenuItem[] = [];
	if (nodeName === SCIENCE_FENCE_TYPE) {
		items.push({
			section: '操作',
			id: 'edit',
			label: '编辑源码',
			current: false,
			action: { type: 'edit' },
		});
	}
	const currentInfo = info.trim().toLowerCase();
	for (const kind of SCIENCE_BLOCK_KINDS) {
		items.push({
			section: '转换',
			id: `convert-${kind.key}`,
			label: kind.label,
			current: nodeName === SCIENCE_FENCE_TYPE && currentInfo === kind.info,
			action: { type: 'convert', info: kind.info },
		});
	}
	items.push({
		section: '操作',
		id: 'delete',
		label: '删除',
		current: false,
		action: { type: 'delete' },
	});
	return items;
}

/**
 * Top-level block that owns `pos`. A position directly before a block
 * selects that block; a position inside text walks out to depth 1.
 */
export function blockAt(doc: ProseMirrorNode, pos: number): { pos: number; node: ProseMirrorNode } | null {
	const clamped = Math.max(0, Math.min(pos, doc.content.size));
	const direct = doc.nodeAt(clamped);
	if (direct?.isBlock && doc.resolve(clamped).nodeAfter === direct) return { pos: clamped, node: direct };
	const inside = clamped === doc.content.size && clamped > 0 ? clamped - 1 : clamped;
	const $pos = doc.resolve(inside);
	if ($pos.depth < 1) return null;
	return { pos: $pos.before(1), node: $pos.node(1) };
}

/** A fence keeps its meta and fence characters when its language changes; anything else starts a new fence. */
export function scienceAttrs(node: ProseMirrorNode, language: string): Record<string, unknown> {
	return node.type.spec.code ? { ...node.attrs, language } : { language };
}

/** Apply a block-menu action. The returned document keeps every other block's bytes. */
export function transformScienceBlock(doc: ProseMirrorNode, pos: number, action: ScienceBlockAction): ScienceBlockEdit {
	const node = doc.nodeAt(pos);
	if (!node?.isBlock || doc.resolve(pos).nodeAfter !== node) return { doc, cursor: null };
	if (action.type === 'edit') {
		if (node.type.name !== SCIENCE_FENCE_TYPE) return { doc, cursor: null };
		return { doc, cursor: pos + node.nodeSize - 1 };
	}
	if (action.type === 'delete') {
		if (doc.childCount === 1 && doc.firstChild === node) {
			const paragraph = doc.type.schema.nodes.paragraph?.createAndFill();
			if (!paragraph) return { doc, cursor: null };
			return { doc: doc.type.create(null, paragraph), cursor: 1 };
		}
		const next = doc.replace(pos, pos + node.nodeSize, Slice.empty);
		return { doc: next, cursor: Math.min(pos, next.content.size) };
	}
	const type = doc.type.schema.nodes[SCIENCE_FENCE_TYPE];
	if (!type) return { doc, cursor: null };
	if (action.type === 'insert') {
		const created = type.create({ language: action.info });
		const at = pos + node.nodeSize;
		const next = doc.replace(at, at, new Slice(Fragment.from(created), 0, 0));
		return { doc: next, cursor: at + 1 };
	}
	if (node.type === type && node.attrs.language === action.info) return { doc, cursor: null };
	const text = node.textContent;
	const created = type.create(scienceAttrs(node, action.info), text ? doc.type.schema.text(text) : null);
	const next = doc.replace(pos, pos + node.nodeSize, new Slice(Fragment.from(created), 0, 0));
	return { doc: next, cursor: pos + 1 };
}
