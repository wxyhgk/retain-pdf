import { t } from '@blog/i18n/index.mjs';
import type { Context } from '@blog/kernel/index.mjs';
import type { StudioBlock } from '@blog/kernel/studio.ts';

import { qcProgram } from '@blog/compute/parsers/qc/qc.mjs';
import { QC_EXTENSIONS, QC_LANGUAGE, qcMarkdown } from './qc-card.mjs';
import { insertQc, qcBlockPlugins, qcFilesChanged, QC_TYPE, setQcHost } from './qc-block.ts';
import qcCss from './qc.css?raw';

const ICON =
	'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="M9 17v-3M12 17v-6M15 17v-2"/></svg>';

/** The editor's own part: the empty block, the sheet's 设置. */
const EDITOR_CSS = `
.qc-block { margin: 6px 0; }
.qc-block.ProseMirror-selectednode .job-card { border-color: rgb(var(--gray-dark)); }
.qc-block .job-card { cursor: default; }
.qc-block-empty { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px dashed rgb(var(--gray-light)); border-radius: 6px; background: var(--surface-soft); color: rgb(var(--gray)); font-size: 14px; }
.qc-block-empty button, .qc-settings button { flex: none; margin-left: auto; border: 1px solid rgb(var(--gray-light)); border-radius: 4px; background: var(--surface); color: rgb(var(--gray-dark)); font-size: 12px; padding: 2px 8px; cursor: pointer; }
.qc-settings { display: grid; gap: 10px; max-width: 520px; }
.qc-settings button { justify-self: start; margin-left: 0; }
.qc-settings label { display: flex; align-items: center; gap: 8px; color: rgb(var(--gray)); font-size: 13px; }
.qc-settings-title { flex: 1; padding: 4px 8px; border: 1px solid rgb(var(--gray-light)); border-radius: 4px; background: var(--surface); color: rgb(var(--gray-dark)); font: inherit; }
`;

/**
 * The Studio: ```qc blocks (qc-block.ts), the card of a Gaussian or ORCA
 * output of the article; an output dropped into the article becomes one (its
 * start tells it from another `.log`), and the slash menu's 化学 has 计算结果.
 */
export const name = 'block-qc';
export const description = t('计算结果（```qc）：Gaussian 的 .log、ORCA 的 .out 显示成卡片——能量、自由能、虚频、激发态，双击看优化过程、红外光谱和振动、结构和输出；拖进正文就行。');
export const inject = ['studio', 'blocks', 'styles'];

export function apply(ctx: Context): void {
	ctx.styles.add(qcCss + EDITOR_CSS);
	ctx.effect(() => {
		setQcHost({
			fileUrl: (path) => {
				const slug = ctx.studio.shown();
				return slug ? ctx.studio.fileUrl(slug, path) : path;
			},
			upload: async (folder, file) => {
				const slug = ctx.studio.shown();
				if (!slug) throw new Error(t('没有打开页面'));
				return (await ctx.studio.upload(slug, folder, file)).path;
			},
			toast: (message, error) => ctx.studio.toast(message, error),
		});
		return () => setQcHost(null);
	}, 'qc host');
	ctx.on('studio/files-changed', (_slug, paths) => qcFilesChanged(paths));
	ctx.blocks.register({
		name,
		fence: QC_LANGUAGE,
		milkdown: qcBlockPlugins,
		drawnWhole: [QC_TYPE],
		files: { extensions: QC_EXTENSIONS, icon: '⚛', markdown: qcMarkdown, sniff: (head) => qcProgram(head) !== null },
		menuGroup: { key: 'science', label: t('化学') },
		menu: {
			key: 'qc',
			label: t('计算结果'),
			description: t('从输出文件里挑出能量、频率'),
			hint: '```qc',
			icon: ICON,
			keywords: ['gaussian', 'orca', 'log', 'out', 'output', 'result', 'qc', 'jisuanjieguo', 'jsjg', '高斯'], // i18n-ignore: matched against what is typed
			insert: insertQc,
		},
	} satisfies StudioBlock);
}
