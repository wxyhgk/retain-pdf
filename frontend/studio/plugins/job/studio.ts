import { JOB_LANGUAGE } from '@blog/compute/job-fence.mjs';
import { JobPrograms as Programs } from '@blog/compute/programs.mjs';
import { t } from '@blog/i18n/index.mjs';
import type { Context } from '@blog/kernel/index.mjs';
import type { StudioBlock } from '@blog/kernel/studio.ts';

import { jobApi } from './studio/api.ts';
import { createComputeHostsDialog } from './studio/hosts-dialog.ts';
import { insertJob, jobBlockPlugins, jobFilesChanged, jobProgramsChanged, setJobHost, type JobPrograms } from './studio/job-block.ts';

const ICON =
	'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v5L4.5 18a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 8V3"/><path d="M10 15l2-2 2 2"/></svg>';

/**
 * The Studio: ```job blocks in the editor (studio/job-block.ts), in the
 * slash menu as 计算, run through the article open on the machines of
 * 计算机器 (studio/hosts-dialog.ts), their molecules built in the Studio's
 * molecule editor (`ctx.molecules`), their sheets open to other plugins'
 * tabs (`ctx.sheetTabs`, as block-job). The programs are plugins of their
 * own (plugins/xtb, plugins/crest) in `ctx.jobs`, which this one provides.
 */
export const name = 'block-job';
export const description = t('计算块（```job）：在笔记里搭分子、跑计算（程序是各自的插件，如 xtb、CREST），每次运行都留着；计算机器在块的窗口里设置。');
export const inject = ['studio', 'blocks', 'molecules', 'sheetTabs'];

export async function apply(ctx: Context): Promise<void> {
	await ctx.plugin(Programs);
	const programs = ctx.get('jobs') as Programs;
	const api = jobApi(ctx.studio.api);
	const dialog = createComputeHostsDialog(api, () => programs.list());
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
				return slug ? api.start(slug, id, job) : Promise.reject(new Error(t('文章尚未载入')));
			},
			cancel: (id, run) => {
				const slug = ctx.studio.slug();
				return slug ? api.cancel(slug, id, run) : Promise.reject(new Error(t('文章尚未载入')));
			},
			manageHosts: () => dialog.open(),
			programs: () => programs.list() as JobPrograms[],
			program: (program) => programs.get(program) as JobPrograms | null,
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
	// A program's plugin loaded again (or turned off, or on): the blocks are drawn with the programs there are now.
	ctx.on('studio/plugins-changed', () => jobProgramsChanged());
	ctx.blocks.register({
		name,
		fence: JOB_LANGUAGE,
		milkdown: jobBlockPlugins,
		menu: {
			key: 'job',
			// Read when the menu is made: the programs there are then.
			get label() {
				const labels = programs.list().map((program) => program.label);
				return labels.length ? t('计算（{programs}）', { programs: labels.join(' / ') }) : t('计算');
			},
			description: t('在本机或服务器上跑一个计算'),
			hint: '```job',
			icon: ICON,
			keywords: ['job', 'compute', 'calculation', 'xtb', 'crest', 'run', 'jisuan'],
			insert: insertJob,
		},
	} satisfies StudioBlock);
}
