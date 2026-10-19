import { createSciencePreview, hydrateSciencePreviews } from '@blog/science/browser/science-renderer.ts';
import { openBlockSheet, type OpenSheet, type SheetAction } from '@blog/ui/block-sheet.ts';

import { openRetainmol } from './retainmol-frame.ts';
import './science-sheet.css';
import { parseScienceFence, scienceBlockKindLabel, scienceSourceEditor, structureDrawing } from './science-block.ts';
import { mountStructureEditor, smilesToMolfile } from './structure-editor.ts';

/**
 * A chemistry block's sheet: 结构, the structure edited where it is drawn
 * (a flat one in the structure editor, one in 3D in RetainMol, the author's
 * molecule editor, retainmol-frame.ts), and 源码,
 * its text with what it draws under it. What is changed in either is
 * written into the block a moment later. A flat structure can be made 3D.
 * Formats neither editor writes (GJF, PDB, cube, a file of the article) are
 * shown, and edited as text.
 */

export type ScienceBlockState = { info: string; source: string };

export type ScienceSheetHost = {
	/** The block as it is now. */
	read(): ScienceBlockState | null;
	/** Writes the block: its source, and its language when that changes. */
	write(next: ScienceBlockState): void;
	onClose(): void;
};

/** 3D structures RetainMol reads and writes back as they were: XYZ, and MOL/SDF with coordinates in space. */
function editableIn3D(info: string, source: string): 'xyz' | 'mol' | null {
	const language = info.trim().toLowerCase();
	const descriptor = parseScienceFence(language, source);
	if (!descriptor?.block || descriptor.block.resource.kind !== 'inline' || !source.trim()) return null;
	if (structureDrawing(language, source)) return null;
	if (['xyz', 'xyz-3d'].includes(language)) return 'xyz';
	if (['sdf', 'mol', 'sdf-3d', 'mol-3d'].includes(language)) return 'mol';
	return null;
}

/** Why a block's structure is shown, not edited, in 结构. */
function readOnlyReason(info: string, source: string): string {
	const descriptor = parseScienceFence(info, source);
	if (descriptor?.block?.resource.kind === 'file') return '结构来自文章里的文件：这里只显示；改文件，或在「源码」里换成直接写的结构。';
	if (!source.trim()) return '还没有结构：在「源码」里写上。';
	return `${scienceBlockKindLabel(info)} 只能在「源码」里改；这里显示它画出来的样子。`;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
	const made = document.createElement(tag);
	if (className) made.className = className;
	if (text !== undefined) made.textContent = text;
	return made;
}

/** What the block draws, as the page draws it. */
function preview(host: HTMLElement, state: ScienceBlockState): void {
	const descriptor = parseScienceFence(state.info, state.source);
	const drawn = descriptor?.block && state.source.trim() ? createSciencePreview(descriptor.block.language, state.source) : null;
	host.replaceChildren(drawn ?? element('p', 'science-sheet-empty', descriptor?.problem ? `无法预览：${descriptor.problem}` : state.source.trim() ? '无法预览这段结构' : '还没有结构'));
	hydrateSciencePreviews(host);
}

export function openScienceSheet(host: ScienceSheetHost, initial: 'structure' | 'source' = 'structure'): OpenSheet | null {
	const start = host.read();
	if (!start) return null;
	/** Changes made in the sheet itself, which its own tabs need not be drawn again for. */
	let writingFromTab: string | null = null;
	/** A flat structure (molfile) to be made 3D the next time 结构 is drawn. */
	let flatTo3D: string | null = null;
	let sheet: OpenSheet;

	const write = (tab: string, next: ScienceBlockState) => {
		const before = host.read();
		writingFromTab = tab;
		try {
			host.write(next);
		} finally {
			writingFromTab = null;
		}
		// The other tab shows it anew when it is next shown.
		for (const other of ['structure', 'source']) if (other !== tab) sheet.redraw(other);
		if (before && before.info !== next.info) {
			sheet.setTitle(scienceBlockKindLabel(next.info));
			sheet.setActions(actions());
		}
	};

	const drawStructure = (panel: HTMLElement) => {
		const state = host.read();
		if (!state) return;
		const stage = element('div', 'science-sheet-editor');
		const note = element('p', 'block-sheet-note');
		panel.append(stage, note);
		let closed = false;
		let dispose: (() => void) | null = null;
		const form = structureDrawing(state.info, state.source);
		const in3D = editableIn3D(state.info, state.source);
		// Being made 3D comes first: a flat structure would otherwise go to the structure editor.
		if (form && flatTo3D === null) {
			note.textContent = form === 'smiles' ? '画好的结构会写回成 SMILES；SMILES 写不下的（如通用基团）会改成 SDF 块。' : '画好的结构会写回块里（MOL）。';
			stage.textContent = '正在载入结构编辑器…';
			void mountStructureEditor(stage, form, state, {
				current: () => host.read() ?? state,
				drawn: (next) => write('structure', next),
			}).then((editor) => {
				if (closed) editor.dispose();
				else dispose = () => editor.dispose();
			}).catch((error) => {
				stage.textContent = error instanceof Error ? error.message : String(error);
			});
		} else if (in3D || flatTo3D !== null) {
			// Made 3D from a flat structure: RetainMol gives it coordinates in space, and the block becomes a 3D SDF.
			const making = flatTo3D;
			flatTo3D = null;
			const format = making !== null ? 'mol' : in3D;
			note.textContent = making !== null
				? '正在用 RetainMol 生成三维结构，补上氢；生成后块会变成三维 SDF。'
				: format === 'xyz' ? '在 RetainMol 里改结构，改动写回块里（XYZ）。' : '在 RetainMol 里改结构，改动写回块里（MOL）；SD 文件里的数据字段不会保留。';
			void openRetainmol(stage, {
				text: making ?? state.source,
				report: making !== null,
				changed: (built) => {
					const current = host.read();
					if (!current) return;
					const source = (format === 'xyz' ? built.xyz : built.mol).replace(/\s+$/u, '');
					const info = making !== null ? 'sdf' : current.info;
					if (source !== current.source || info !== current.info) write('structure', { info, source });
					note.textContent = `${built.formula} · ${built.atoms} 个原子，已写回块里。`;
				},
				failed: (message) => {
					note.textContent = `RetainMol 读不了这个结构：${message}`;
				},
			}).then((opened) => {
				if (closed) opened.dispose();
				else dispose = () => opened.dispose();
			}).catch((error) => {
				stage.replaceChildren(element('p', 'science-sheet-empty', error instanceof Error ? error.message : String(error)));
			});
		} else {
			note.textContent = readOnlyReason(state.info, state.source);
			preview(stage, state);
		}
		return () => {
			closed = true;
			dispose?.();
		};
	};

	const drawSource = (panel: HTMLElement) => {
		const state = host.read();
		if (!state) return;
		const editor = scienceSourceEditor(state.info);
		const text = element('textarea', 'science-sheet-source');
		text.value = state.source;
		text.placeholder = editor.placeholder;
		text.spellcheck = false;
		text.rows = editor.inline ? 2 : 14;
		text.setAttribute('aria-label', `${editor.label} 源码`);
		const shown = element('div', 'science-sheet-preview');
		panel.append(text, shown);
		preview(shown, state);
		let timer: ReturnType<typeof setTimeout> | undefined;
		/** Typed into since it was drawn: only then is what it holds the block's. */
		let typed = false;
		text.addEventListener('input', () => {
			typed = true;
			clearTimeout(timer);
			timer = setTimeout(() => {
				const current = host.read();
				if (!current) return;
				const next = { info: current.info, source: text.value.replace(/\s+$/u, '') };
				write('source', next);
				preview(shown, next);
			}, 300);
		});
		queueMicrotask(() => text.focus());
		return () => {
			clearTimeout(timer);
			// Drawn again because the structure changed elsewhere: what it showed is older than the block.
			if (!typed) return;
			const current = host.read();
			const source = text.value.replace(/\s+$/u, '');
			if (current && current.source !== source) write('source', { info: current.info, source });
		};
	};

	/** A flat structure made 3D (an SDF block with coordinates in space, hydrogens added), by RetainMol. */
	const make3D = async () => {
		const state = host.read();
		const form = state ? structureDrawing(state.info, state.source) : null;
		if (!state || !form || !state.source.trim()) return;
		try {
			flatTo3D = form === 'smiles' ? await smilesToMolfile(state.source.trim()) : state.source;
			sheet.redraw('structure');
			sheet.select('structure');
		} catch (error) {
			window.alert(`没能生成三维结构：${error instanceof Error ? error.message : String(error)}`);
		}
	};

	const actions = (): SheetAction[] => {
		const state = host.read();
		if (!state || !structureDrawing(state.info, state.source) || !state.source.trim()) return [];
		return [{ label: '生成三维结构', title: '交给 RetainMol 生成三维构象、补上氢，块变成三维 SDF', run: () => void make3D() }];
	};

	sheet = openBlockSheet({
		kind: '化学',
		title: scienceBlockKindLabel(start.info),
		initial,
		tabs: [
			{ key: 'structure', label: '结构', draw: drawStructure, wide: true },
			{ key: 'source', label: '源码', draw: drawSource },
		],
		actions: actions(),
		onClose: () => host.onClose(),
	});
	return {
		...sheet,
		redraw: (key) => {
			// Changed from outside (undo, the disk): what the tabs show is drawn anew; not for the sheet's own writes.
			if (writingFromTab === null) sheet.redraw(key);
		},
	};
}
