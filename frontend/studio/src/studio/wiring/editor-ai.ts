// The AI in the editor: ⌘J (rewrite or write, reviewed in place), 在终端里问 AI, ⌥↩ (an AI does what the blocks say),
// 识别… (a picture read by the large model), OCR 成子页面 (a PDF read into a page); the task tray, which says when
// the last two are over.
import type { EditorView } from '@milkdown/prose/view';
import { t } from '@blog/i18n/index.mjs';
import { Recognizers, type Recognizer } from '@blog/kernel/ui.ts';
import { aiSettings, askInline, cancelInline, instruct, putBelowImage, recognizeImage, startOcr, warmInline } from '../api/client';
import { chosenAI } from '../ai/ai-panel';
import { createInlineAi } from '../ai/inline-ai';
import { showContextMenu } from '../common/context-menu';
import { showToast } from '../common/toast';
import { SELECTION_END, SELECTION_START, sourceLinesOf } from '@blog/document/source-lines.ts';
import { createTaskTray } from '../panels/task-tray';
import { pluginRecognizers } from '../plugins';
import { aiReady, openAiSettings } from '../shell/dialogs/ask';
import type { Studio } from './studio';

export function createEditorAi(studio: Studio) {
	const { shell, session, editor, articleList } = studio;

	/** The blocks marked as an AI works on them (Alt+Enter), by the task it is: the mark's own name. */
	const instructing = new Map<string, string>();
	/** Tasks over before their mark was known (an AI quicker than the answer that started it); PDFs read before their start was said. */
	const overEarly = new Set<string>();
	createTaskTray(shell.querySelector<HTMLElement>('#task-tray')!, {
		ended(task) {
			const mark = instructing.get(task.id);
			if (mark) {
				instructing.delete(task.id);
				editor.unmarkInstructing(mark);
			} else if (task.kind === 'instruction' || task.kind === 'ocr') overEarly.add(task.id);
			if (task.state === 'failed') showToast(`${task.title}：${task.error ?? t('出错了')}`, true);
			// A PDF read: its page, to open.
			const page = task.kind === 'ocr' && task.state === 'done' ? (task.result as { page?: string } | null)?.page : undefined;
			if (page) {
				void articleList.load();
				showToast(t('已识别成子页面「{title}」', { title: task.title.replace(/^PaddleOCR：/u, '') }), { action: { label: t('打开'), run: () => void session.open(page) } });
			}
		},
	});

	/**
	 * 在终端里问 AI: the article saved, the lines the selected blocks are in, and a question about them typed into the
	 * terminal for the author to finish and send (what 「问 AI」 did before the AI in the editor).
	 */
	async function askInTerminal(): Promise<void> {
		const slug = session.slug;
		const marked = slug ? editor.markSelection() : null;
		if (!slug || !marked) return;
		if (!(await session.flush())) {
			showToast(t('文章还没保存好，保存后再问 AI'), true);
			return;
		}
		const lines = sourceLinesOf(session.current.source, marked);
		if (!lines) {
			showToast(t('没找到选中的内容在文件里的位置'), true);
			return;
		}
		studio.sidePanel.show('terminal');
		studio.terminal.ask(slug, lines);
	}

	/** What the AI in the editor is asked about: the blocks selected (or the empty line), what is before and after, kept for 重试. */
	let inlineAsk: { slug: string; mode: 'rewrite' | 'write'; selected: string; before: string; after: string; source: string } | null = null;
	let inlineId = '';
	const inlineAi = createInlineAi({
		async run(instruction) {
			const asked = inlineAsk;
			if (!asked || session.slug !== asked.slug) throw new Error(t('已经换了文章'));
			const { agent, options } = chosenAI();
			inlineId = crypto.randomUUID();
			const { markdown } = await askInline({ id: inlineId, agent, options, mode: asked.mode, instruction, slug: asked.slug, selected: asked.selected, before: asked.before, after: asked.after });
			if (session.slug !== asked.slug) throw new Error(t('已经换了文章'));
			if (session.current.source !== asked.source || session.hasUnsavedEdits()) throw new Error(t('AI 写的时候文章改过了：再选一次，重新问'));
			// Shown in place, to accept or reject (the review bar); taken, it is saved as any edit.
			void session.reviewProposal([asked.before, markdown.trim(), asked.after].filter((part) => part.trim()).join('\n\n') + '\n');
		},
		stop() {
			if (inlineId) void cancelInline(inlineId).catch(() => {});
		},
		askInTerminal: () => void askInTerminal(),
	});

	/** Where the selection (or the caret) is on screen, for the AI's box to open under. */
	function selectionRect(): DOMRect | null {
		const selection = window.getSelection();
		if (!selection?.rangeCount) return null;
		const range = selection.getRangeAt(0);
		const rect = range.getBoundingClientRect();
		if (rect.width || rect.height) return rect;
		const node = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
		return node?.getBoundingClientRect() ?? null;
	}

	/**
	 * The AI in the editor (⌘J, the toolbar, a block's menu; Space on an empty line), as Notion's: the selected blocks
	 * (or the one the caret is in) rewritten, or something written on the empty line, as the author says in its box;
	 * what it writes comes in place as differences to accept or reject. The article is saved first, so what is asked
	 * about is what is on disk.
	 */
	async function askAI(): Promise<void> {
		const slug = session.slug;
		const marked = slug ? editor.markSelection() : null;
		if (!slug || !marked) return;
		const anchor = selectionRect();
		const start = marked.indexOf(SELECTION_START);
		const end = marked.indexOf(SELECTION_END);
		if (start < 0 || end < start) return;
		if (!(await session.flush())) {
			showToast(t('文章还没保存好，保存后再问 AI'), true);
			return;
		}
		const selected = marked.slice(start + SELECTION_START.length, end).trim();
		const mode = selected && selected !== '<br />' ? 'rewrite' : 'write';
		inlineAsk = {
			slug,
			mode,
			selected,
			before: marked.slice(0, start).trimEnd(),
			after: marked.slice(end + SELECTION_END.length).trimStart(),
			source: session.current.source,
		};
		inlineAi.open(mode, anchor);
		// The AI made ready while the author says what they want.
		void warmInline(chosenAI().agent).catch(() => {});
	}

	/**
	 * OCR 成子页面: a PDF of the open article (`path` in it) read by PaddleOCR into a page under it (server/tasks/pdf-ocr.mjs),
	 * made at once and filled in as a task; from the line linking to the PDF (`view`, `pos`), the page linked on a line under it.
	 */
	async function ocrPdf(path: string, view?: EditorView, pos?: number): Promise<void> {
		const slug = session.slug;
		if (!slug) return;
		try {
			const { task, page } = await startOcr(slug, path);
			void articleList.load();
			// Already read: what says so (with 打开) stays, not covered by this.
			if (!overEarly.delete(task)) showToast(t('正在用 PaddleOCR 识别 {path}，结果写进子页面「{title}」', { path, title: page.title }));
			const at = view && pos !== undefined && !view.isDestroyed ? view.state.doc.nodeAt(pos) : null;
			const link = view?.state.schema.marks.link;
			// Still the line linking to the PDF: the page under it.
			if (view && at?.textContent && at.isTextblock && link) {
				const line = view.state.schema.nodes.paragraph!.create(null, view.state.schema.text(page.title, [link.create({ href: page.href, title: null })]));
				view.dispatch(view.state.tr.insert(pos! + at.nodeSize, line));
			}
		} catch (error) {
			showToast(error instanceof Error ? error.message : t('没能开始识别'), true);
		}
	}

	/** The heading the line `line` (from 1) of `source` is under, skipping what is in code fences; empty for none. */
	function headingAbove(source: string, line: number): string {
		let heading = '';
		let fence: string | null = null;
		for (const text of source.split('\n').slice(0, line - 1)) {
			const opening = /^\s{0,3}(`{3,}|~{3,})/u.exec(text)?.[1];
			if (fence) {
				if (opening && opening[0] === fence[0] && opening.length >= fence.length) fence = null;
			} else if (opening) fence = opening;
			else heading = /^#{1,6}\s+(.*?)\s*#*\s*$/u.exec(text)?.[1] ?? heading;
		}
		return heading;
	}

	let instructions = 0;
	/**
	 * Alt+Enter: what the blocks the caret is in say is done by the AI of AI 助手, by itself, in the article's folder
	 * (server/ai/instructions.mjs); ⇧ as well, in a new talk. The blocks are marked till it is over; what it changes in the
	 * file comes back as a change on disk, to accept or reject where it is.
	 */
	async function instructHere(fresh: boolean): Promise<void> {
		const slug = session.slug;
		const marked = slug ? editor.markSelection() : null;
		if (!slug || !marked) return;
		// Marked at once, where the caret is now, whatever it does meanwhile.
		const mark = `instruction-${++instructions}`;
		editor.markInstructing(mark);
		try {
			if (!(await session.flush())) throw new Error(t('文章还没保存好，保存后再交给 AI'));
			const lines = sourceLinesOf(session.current.source, marked);
			if (!lines?.text.trim()) throw new Error(t('这一行是空的，没有要交给 AI 的事'));
			const id = await instruct(slug, { text: lines.text, start: lines.start, end: lines.end, heading: headingAbove(session.current.source, lines.start) }, fresh);
			if (overEarly.delete(id)) editor.unmarkInstructing(mark);
			else instructing.set(id, mark);
		} catch (error) {
			editor.unmarkInstructing(mark);
			showToast(error instanceof Error ? error.message : t('没能交给 AI'), true);
		}
	}

	/**
	 * 识别…: the picture at `pos` read by the large model of AI 设置, as what the author picks
	 * (`ctx.recognizers`: a formula, text, a table…). What is read is put under the picture on disk,
	 * the article saved first: it comes back as a change to accept or not, the text before it in history.
	 */
	function recognizePicture(view: EditorView, pos: number): void {
		const slug = session.slug;
		const src = String(view.state.doc.nodeAt(pos)?.attrs.src ?? '');
		if (!slug || !src) return;
		const kinds = pluginRecognizers()?.list() ?? [];
		if (!kinds.length) {
			showToast(t('没有可用的识别：插件「recognize」关掉了？'), true);
			return;
		}
		const anchor = view.nodeDOM(pos);
		showContextMenu(
			kinds.map((kind) => ({ label: kind.label, action: () => void readPicture(slug, src, kind) })),
			anchor instanceof HTMLElement ? anchor : { x: innerWidth / 2, y: innerHeight / 3 },
		);
	}

	async function readPicture(slug: string, src: string, kind: Recognizer): Promise<void> {
		let settings = await aiSettings().catch(() => null);
		if (!settings || !aiReady(settings)) settings = await openAiSettings(t('识别图片要用大模型：先选好服务、模型，填上 key。'));
		if (!settings || !aiReady(settings)) return;
		await session.flush();
		showToast(t('正在识别（{label}）…', { label: kind.label }));
		try {
			const answer = await recognizeImage(slug, src, kind.prompt);
			if (!answer.trim()) {
				showToast(t('图里没读出这一类内容'), true);
				return;
			}
			await putBelowImage(slug, src, Recognizers.markdown(kind, answer));
			showToast(t('识别好了，放在图下面：接受或拒绝'));
		} catch (error) {
			showToast(t('没能识别：{error}', { error: error instanceof Error ? error.message : String(error) }), true);
		}
	}

	return { askAI, instructHere, ocrPdf, recognizePicture, retry: () => inlineAi.retry() };
}
