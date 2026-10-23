import { $fencedBlock } from '@milkdown/kit/preset/commonmark';
import { NodeSelection } from '@milkdown/prose/state';
import type { Node as ProseNode } from '@milkdown/prose/model';
import type { EditorView, NodeView } from '@milkdown/prose/view';
import { $view } from '@milkdown/utils';

import { parseQcOutput, type QcOutput } from '@blog/compute/parsers/qc/qc.mjs';
import type { OpenSheet } from '@blog/ui/block-sheet.ts';

import { QC_EXTENSIONS, QC_LANGUAGE, parseQcFence, qcCard, qcFilePath, writeQcFence, type QcFence } from './qc-card.mjs';
import { openQcSheet, paintPicture } from './qc-sheet.ts';

/**
 * A ```qc fence in the editor (qc-card.mjs): the card the blog shows, read
 * from the output it names (again when that file changes); a double click,
 * or ↩ on it, opens its sheet, whose 设置 changes its title or its file.
 * Empty, it asks for an output to put in the article's assets/.
 */

export const QC_TYPE = 'qc_block';

export const qcSchema = $fencedBlock(QC_TYPE, (language) => language.trim().toLowerCase() === QC_LANGUAGE, () => ({
	atom: true,
	isolating: true,
}));

/** What the block needs from the plugin: the article's files, a word to the writer. */
export type QcHost = {
	/** Where a file of the article shown is served (`assets/co2.log`). */
	fileUrl(path: string): string;
	/** Puts a file into a folder of the article shown; its path in it. */
	upload(folder: string, file: File): Promise<string>;
	toast(message: string, error?: boolean): void;
};

let host: QcHost | null = null;
export function setQcHost(next: QcHost | null): void {
	host = next;
}

/** The blocks showing each file, read again when it changes. */
const watching = new Map<string, Set<() => void>>();
export function qcFilesChanged(paths: readonly string[]): void {
	for (const path of paths) for (const reload of watching.get(path) ?? []) reload();
}

/** A new, empty result where the caret's (empty) block is. */
export function insertQc(view: EditorView): void {
	const { state } = view;
	const type = state.schema.nodes[QC_TYPE];
	if (!type) return;
	const { $from } = state.selection;
	const tr = state.tr.replaceWith($from.before(), $from.after(), type.create({ language: QC_LANGUAGE }));
	view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, $from.before())).scrollIntoView());
}

type Hast = { type: 'element'; tagName: string; properties: Record<string, unknown>; children: (Hast | { type: 'text'; value: string })[] };

function toDom(node: Hast): HTMLElement {
	const element = document.createElement(node.tagName);
	for (const [key, value] of Object.entries(node.properties)) {
		if (key === 'className') element.className = (value as string[]).join(' ');
		else if (key.startsWith('data')) element.dataset[key[4].toLowerCase() + key.slice(5)] = String(value);
		else element.setAttribute(key, String(value));
	}
	for (const child of node.children) element.append(child.type === 'text' ? document.createTextNode(child.value) : toDom(child));
	return element;
}

function button(label: string, action: () => void, title = ''): HTMLButtonElement {
	const element = document.createElement('button');
	element.type = 'button';
	element.textContent = label;
	if (title) element.title = title;
	element.addEventListener('mousedown', (event) => event.preventDefault());
	element.addEventListener('click', (event) => {
		event.preventDefault();
		action();
	});
	return element;
}

const ACCEPT = QC_EXTENSIONS.map((extension) => `.${extension}`).join(',');

export const qcView = $view(qcSchema.schema.node, () => (initial: ProseNode, view: EditorView, getPos: () => number | undefined): NodeView => {
	let node = initial;
	let fence = parseQcFence(node.textContent);
	let read: { path: string; text: string | null; result: QcOutput | null } | null = null;
	let busy = '';
	let sheet: OpenSheet | null = null;
	let watched: string | null = null;
	let destroyed = false;
	const dom = document.createElement('div');
	dom.className = 'qc-block';
	dom.contentEditable = 'false';

	/** Writes the fence anew, the block staying selected. */
	const write = (next: QcFence) => {
		const pos = getPos();
		if (pos == null) return;
		const current = view.state.doc.nodeAt(pos);
		if (!current) return;
		const text = writeQcFence(next);
		if (text === current.textContent) return;
		const block = current.type.create(current.attrs, text ? view.state.schema.text(text) : null);
		const tr = view.state.tr.replaceWith(pos, pos + current.nodeSize, block);
		view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, pos)));
	};

	const chooseFile = () => {
		const picker = document.createElement('input');
		picker.type = 'file';
		picker.accept = ACCEPT;
		picker.addEventListener('change', () => {
			const file = picker.files?.[0];
			if (file) void useFile(file);
		});
		picker.click();
	};

	/** An output of this machine, put into the article's assets/. */
	const useFile = async (file: File) => {
		if (!host) return;
		busy = `正在放入 ${file.name}…`;
		paint();
		try {
			const path = await host.upload('assets', file);
			busy = '';
			// Written, the block reads it when the document comes back with it (update).
			write({ ...fence, file: `./${path}` });
			paint();
		} catch (error) {
			busy = '';
			paint();
			host.toast(`没能放入 ${file.name}：${error instanceof Error ? error.message : String(error)}`, true);
		}
	};

	/** The output read (again), then the card drawn from it. */
	const load = async () => {
		const path = qcFilePath(fence.file);
		if (watched !== path) {
			if (watched) watching.get(watched)?.delete(reload);
			watched = path;
			if (path) {
				if (!watching.has(path)) watching.set(path, new Set());
				watching.get(path)!.add(reload);
			}
		}
		if (!path || !host) {
			read = null;
			paint();
			return;
		}
		let text: string | null = null;
		try {
			const response = await fetch(`${host.fileUrl(path)}?${Date.now()}`);
			text = response.ok ? await response.text() : null;
		} catch {
			text = null;
		}
		if (destroyed || qcFilePath(fence.file) !== path) return;
		read = { path, text, result: text === null ? null : parseQcOutput(text) };
		paint();
		if (sheet?.isOpen()) openSheet(sheet.current());
	};
	const reload = () => void load();

	const problem = () => {
		if (!fence.file) return null;
		const path = qcFilePath(fence.file);
		if (!path) return `${fence.file} 不在文章的 img/ 或 assets/ 里`;
		if (!read || read.path !== path) return null;
		if (read.text === null) return `找不到 ./${path}`;
		if (!read.result) return `./${path} 认不出是 Gaussian 或 ORCA 的输出`;
		return null;
	};

	const paint = () => {
		if (busy || !fence.file) {
			const empty = document.createElement('div');
			empty.className = 'qc-block-empty';
			if (busy) empty.textContent = busy;
			else {
				empty.append(
					Object.assign(document.createElement('span'), { textContent: 'Gaussian 的 .log 或 ORCA 的 .out，也可以直接拖进正文' }),
					button('选择输出文件…', chooseFile, '放进文章的 assets/'),
				);
			}
			dom.replaceChildren(empty);
			return;
		}
		const path = qcFilePath(fence.file);
		const reading = Boolean(path && (!read || read.path !== path));
		const card = toDom(qcCard(fence, { result: reading ? null : (read?.result ?? null), problem: problem() }) as Hast);
		if (reading) card.querySelector('.job-card-line')!.textContent = '正在读取结果…';
		paintPicture(card);
		dom.replaceChildren(card);
	};

	/** 设置: its title, its file. */
	const settings = (panel: HTMLElement) => {
		const form = document.createElement('div');
		form.className = 'qc-settings';
		const title = document.createElement('input');
		title.className = 'qc-settings-title';
		title.placeholder = fence.file.replace(/^.*\//u, '') || '计算结果';
		title.value = fence.title;
		title.setAttribute('aria-label', '标题');
		title.addEventListener('change', () => {
			fence = { ...fence, title: title.value };
			write(fence);
			sheet?.setTitle(fence.title || title.placeholder);
		});
		const file = document.createElement('p');
		file.className = 'job-section-note';
		file.textContent = `输出文件：${fence.file || '还没有'}`;
		const label = document.createElement('label');
		label.append('标题 ', title);
		form.append(label, file, button('换文件…', chooseFile, '另一个 Gaussian 或 ORCA 的输出，放进文章的 assets/'));
		panel.append(form);
	};

	const openSheet = (tab?: string) => {
		if (!fence.file) return;
		const path = qcFilePath(fence.file) ?? fence.file;
		sheet = openQcSheet({
			title: fence.title || path.replace(/^.*\//u, ''),
			result: read?.result ?? null,
			text: read?.text ?? null,
			url: host?.fileUrl(path) ?? path,
			name: path.replace(/^.*\//u, ''),
			problem: problem() ?? '正在读取结果…',
			extraTabs: [{ key: 'settings', label: '设置', draw: settings }],
		});
		if (tab) sheet.select(tab);
	};

	// A click selects the block, as other blocks are; a double click opens it.
	dom.addEventListener('mousedown', (event) => {
		if ((event.target as Element).closest('button')) return;
		const pos = getPos();
		if (pos == null) return;
		event.preventDefault();
		view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)).setMeta('addToHistory', false));
		view.focus();
	});
	dom.addEventListener('dblclick', (event) => {
		if ((event.target as Element).closest('button')) return;
		event.preventDefault();
		openSheet();
	});

	paint();
	void load();
	return {
		dom,
		update: (updated) => {
			if (updated.type !== initial.type) return false;
			if (updated === node) return true;
			node = updated;
			const before = fence;
			fence = parseQcFence(node.textContent);
			if (fence.file !== before.file) void load();
			paint();
			return true;
		},
		selectNode: () => dom.classList.add('ProseMirror-selectednode'),
		deselectNode: () => dom.classList.remove('ProseMirror-selectednode'),
		// The caret put inside (↩ on the block): its sheet opens instead.
		setSelection: () => {
			if (!sheet?.isOpen()) openSheet();
		},
		destroy: () => {
			destroyed = true;
			if (watched) watching.get(watched)?.delete(reload);
			sheet?.close();
		},
		ignoreMutation: () => true,
		stopEvent: (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return false;
			if (event.type === 'dragstart') return false;
			return Boolean(target.closest('button, input'));
		},
	};
});

export const qcBlockPlugins = [...qcSchema, qcView];
