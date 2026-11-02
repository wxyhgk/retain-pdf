import { JobPrograms } from '@blog/compute/programs.mjs';
import { created } from '@blog/kernel/routes.mjs';

import { ComputeHosts, detectHost, readHost } from './server/compute-hosts.mjs';
import { JobShell } from './server/job-shell.mjs';
import { JobRuns } from './server/job-runs.mjs';

/**
 * The Studio's dev server: the machines jobs run on (计算机器, kept in the
 * Studio's settings), and the runs going on them, taken up again from where
 * the last server left them (`.studio-jobs.json`). Under
 * /api/studio/plugins/job/:
 *
 *     GET  hosts                                    the machines
 *     PUT  hosts                                    kept as given
 *     POST hosts/detect                             what one of them has
 *     GET  articles/:slug/jobs/:id/runs             a job's runs, newest first
 *     POST articles/:slug/jobs/:id/runs             a new run
 *     POST articles/:slug/jobs/:id/runs/:run/cancel one stopped
 *     GET  programs                                 the programs there are (ctx.jobs: plugins/xtb, plugins/crest…)
 */
export const name = 'server-job';
export const inject = ['server', 'routes'];

export async function apply(ctx) {
	await ctx.plugin(JobPrograms);
	const programs = ctx.get('jobs');
	const { server } = ctx;
	const hosts = new ComputeHosts(server.settingsFile);
	const runs = new JobRuns(server.files, { programs, hosts, stateFile: server.privateFile('.studio-jobs.json') });
	ctx.effect(() => {
		void runs.resume();
		return () => runs.close();
	}, 'job runs');

	ctx.routes.get('/job/hosts', async () => ({ hosts: await hosts.list() }));
	ctx.routes.put('/job/hosts', async ({ json }) => ({ hosts: await hosts.save((await json()).hosts) }));
	ctx.routes.post('/job/hosts/detect', async ({ json }) => detectHost(new JobShell(readHost((await json()).host)), programs.list()));
	ctx.routes.get('/job/programs', () => ({ programs: programs.list().map(({ name, label }) => ({ name, label })) }));
	ctx.routes.get('/job/articles/:slug/jobs/:id/runs', async ({ params }) => ({ runs: await runs.list(params.slug, params.id) }));
	ctx.routes.post('/job/articles/:slug/jobs/:id/runs', async ({ params, json }) => created({ run: await runs.start(params.slug, { ...(await json()), id: params.id }) }));
	ctx.routes.post('/job/articles/:slug/jobs/:id/runs/:run/cancel', async ({ params }) => ({ run: await runs.cancel(params.slug, params.id, params.run) }));
}
