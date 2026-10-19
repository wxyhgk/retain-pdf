import { JOB_LANGUAGE } from '@blog/compute/job-fence.mjs';
import type { Context } from '@blog/kernel/index.mjs';
import type { StudioBlock } from '@blog/kernel/studio.ts';

import { jobApi } from './studio/api.ts';
import { createComputeHostsDialog } from './studio/hosts-dialog.ts';
import { insertJob, jobBlockPlugins, jobFilesChanged, setJobHost } from './studio/job-block.ts';

const ICON =
	'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v5L4.5 18a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 8V3"/><path d="M10 15l2-2 2 2"/></svg>';

/**
 * The Studio: ```job blocks in the editor (studio/job-block.ts), in the
 * slash menu as 计算, run through the article open on the machines of
 * 计算机器 (studio/hosts-dialog.ts), their molecules built in the Studio's
 * molecule editor (`ctx.molecules`), their sheets open to other plugins'
 * tabs (`ctx.sheetTabs`, as block-job).
 */
export const name = 'block-job';
export const description = '计算块（```job）：在笔记里搭分子、跑 xtb / CREST，每次运行都留着；计算机器在块的窗口里设置。';
export const inject = ['studio', 'blocks', 'molecules', 'sheetTabs'];

export function apply(ctx: Context): void {
	const api = jobApi(ctx.studio.api);
	const dialog = createComputeHostsDialog(api);
	ctx.effect(() => {
		setJobHost({
			slug: () => ctx.studio.slug(),
			hosts: api.hosts,
			runs: (id) => {
				const slug = ctx.studio.slug();
				return slug ? api.runs(slug, id) : Promise.resolve([]);
			},
			start: (id, job) => {
				const slug = ctx.studio.slug();
				return slug ? api.start(slug, id, job) : Promise.reject(new Error('文章尚未载入'));
			},
			cancel: (id, run) => {
				const slug = ctx.studio.slug();
				return slug ? api.cancel(slug, id, run) : Promise.reject(new Error('文章尚未载入'));
			},
			manageHosts: () => dialog.open(),
			moleculeEditor: () => ctx.molecules.editor(),
			extraTabs: (detail) => ctx.sheetTabs.for(name, detail),
		});
		return () => {
			setJobHost(null);
			dialog.dispose();
		};
	}, 'job host');
	// The files of a job's runs changed on disk: its block looks again.
	ctx.on('studio/files-changed', (slug, paths) => jobFilesChanged(slug, paths));
	ctx.blocks.register({
		name,
		fence: JOB_LANGUAGE,
		milkdown: jobBlockPlugins,
		menu: { key: 'job', label: '计算（xtb / CREST）', icon: ICON, keywords: ['job', 'compute', 'calculation', 'xtb', 'crest', 'run', 'jisuan'], insert: insertJob },
	} satisfies StudioBlock);
}
