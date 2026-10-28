import type { Node as ProseNode } from '@milkdown/prose/model';
import type { EditorView } from '@milkdown/prose/view';

import { t } from '@blog/i18n/index.mjs';
import type { Context } from '@blog/kernel/index.mjs';
import type { BlockMenuEntry, StudioBlock } from '@blog/kernel/studio.ts';
import type {} from '@blog/kernel/ui.ts';

import { RESULT_FENCE, RESULT_TITLE, isResult, runnerOf } from './run-blocks.mjs';

/**
 * The Studio: a code block run where it is, as org-babel's are in Emacs (C-c C-c): from its block menu (运行), or by
 * ⌘⇧↵ in it (and so from ⌘K's `>` too). It runs in the article's folder on this machine (server.mjs); what it wrote goes
 * under it as an ```output block, which a run again replaces.
 */
export const name = 'run-blocks';
export const description = t('能运行的代码块：python、sh、js、R、julia 的代码块可以直接运行（块菜单里的「运行」或 ⌘⇧↵），在文章的文件夹里跑，输出写在它下面的「运行结果」里，像 Emacs 的 org-babel。');
export const inject = ['studio', 'blocks', 'commands'];

type Ran = { output: string; exitCode: number | null; signal: string | null; seconds: number };

/** The code block at `pos`, or the one holding the selection; null when there is none that runs. */
function runnable(view: EditorView, pos?: number): { node: ProseNode; pos: number } | null {
	if (pos !== undefined) {
		const node = view.state.doc.nodeAt(pos);
		return node?.type.name === 'code_block' && runnerOf(node.attrs.language) ? { node, pos } : null;
	}
	const { $from } = view.state.selection;
	for (let depth = $from.depth; depth >= 0; depth -= 1) {
		const node = $from.node(depth);
		if (node.type.name === 'code_block') return runnerOf(node.attrs.language) ? { node, pos: depth ? $from.before(depth) : 0 } : null;
	}
	const node = view.state.doc.nodeAt($from.pos);
	return node?.type.name === 'code_block' && runnerOf(node.attrs.language) ? { node, pos: $from.pos } : null;
}

/** Where the block that ran is now (the article may have changed meanwhile): the one like it nearest where it was. */
function foundAgain(view: EditorView, language: string, code: string, near: number): { node: ProseNode; pos: number } | null {
	let best: { node: ProseNode; pos: number } | null = null;
	view.state.doc.descendants((node, pos) => {
		if (node.type.name !== 'code_block') return true;
		if (node.attrs.language === language && node.textContent === code && (!best || Math.abs(pos - near) < Math.abs(best.pos - near))) best = { node, pos };
		return false;
	});
	return best;
}

/** What a run says: its output, and how it ended when that is not plainly. */
function resultText(ran: Ran): string {
	const said = ran.output.replace(/\s+$/u, '');
	const ending = ran.signal
		? t('（被停下了：{signal}，用了 {seconds} 秒）', { signal: ran.signal, seconds: ran.seconds })
		: ran.exitCode
			? t('（退出码 {code}，用了 {seconds} 秒）', { code: ran.exitCode, seconds: ran.seconds })
			: '';
	return [said || t('（没有输出）'), ending].filter(Boolean).join('\n');
}

export function apply(ctx: Context): void {
	const running = new Set<string>();

	async function run(view: EditorView, at?: number): Promise<void> {
		const block = runnable(view, at);
		const slug = ctx.studio.slug();
		if (!block || !slug) return ctx.studio.toast(t('光标不在能运行的代码块里（python、sh、js、R、julia）'));
		const language = String(block.node.attrs.language);
		const code = block.node.textContent;
		const key = `${slug}\n${block.pos}`;
		if (running.has(key)) return;
		running.add(key);
		ctx.studio.toast(t('正在运行 {language} 代码块…', { language }));
		try {
			const ran = await ctx.studio.api.post<Ran>(`/run-blocks/articles/${encodeURIComponent(slug)}/run`, { language, code });
			const now = ctx.studio.editor.view();
			const again = now && ctx.studio.slug() === slug ? foundAgain(now, language, code, block.pos) : null;
			if (!now || !again) return ctx.studio.toast(t('运行完了，但代码块已经改了或不在了：结果没写进去'), true);
			const after = again.pos + again.node.nodeSize;
			const next = now.state.doc.nodeAt(after);
			const { schema } = now.state;
			const result = schema.nodes.code_block.create({ language: RESULT_FENCE, meta: `title="${RESULT_TITLE}"` }, schema.text(resultText(ran)));
			const tr = next && next.type.name === 'code_block' && isResult(next.attrs.language, next.attrs.meta)
				? now.state.tr.replaceWith(after, after + next.nodeSize, result)
				: now.state.tr.insert(after, result);
			now.dispatch(tr);
			ctx.studio.toast(ran.exitCode === 0 ? t('运行完了（{seconds} 秒）', { seconds: ran.seconds }) : t('运行结束，有错：看「运行结果」'), ran.exitCode !== 0);
		} catch (error) {
			ctx.studio.toast(error instanceof Error ? error.message : String(error), true);
		} finally {
			running.delete(key);
		}
	}

	ctx.blocks.register({
		name,
		fence: [],
		blockMenu: {
			nodes: ['code_block'],
			entries: (node: ProseNode, pos: number, standard: BlockMenuEntry[]): BlockMenuEntry[] =>
				runnerOf(node.attrs.language) ? [{ key: 'run-block', label: t('运行（结果写在下面）'), hint: '⌘⇧↵', run: (view) => void run(view as EditorView, pos) }, ...standard] : standard,
		},
	} satisfies StudioBlock);
	// In a code block, its code editor takes ⌘⇧↵ before the Studio's keys are asked: heard first, for that block.
	ctx.effect(() => {
		const heard = (event: KeyboardEvent) => {
			if (event.key !== 'Enter' || !event.shiftKey || !(event.metaKey || event.ctrlKey) || event.altKey || event.isComposing) return;
			const view = ctx.studio.editor.view();
			const block = (event.target as Element | null)?.closest?.('.milkdown-code-block');
			if (!view || !block || !view.dom.contains(block)) return;
			const pos = view.posAtDOM(block, 0) - 1;
			const at = [pos, pos + 1].find((candidate) => candidate >= 0 && view.state.doc.nodeAt(candidate)?.type.name === 'code_block');
			if (at === undefined || !runnerOf(view.state.doc.nodeAt(at)?.attrs.language)) return;
			event.preventDefault();
			event.stopPropagation();
			void run(view, at);
		};
		document.addEventListener('keydown', heard, true);
		return () => document.removeEventListener('keydown', heard, true);
	}, 'run-blocks keys');
	ctx.commands.register({
		id: 'run-blocks.run',
		label: t('运行光标所在的代码块'),
		icon: '▶',
		keys: 'Mod-Shift-Enter',
		run() {
			const view = ctx.studio.editor.view();
			if (view) void run(view);
		},
	});
}
