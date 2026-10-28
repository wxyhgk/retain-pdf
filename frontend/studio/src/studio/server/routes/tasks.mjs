import { proxyFetch } from '../apps/mini-apps.mjs';
import { runProgram } from '../tasks/tasks.mjs';
import { refuse, reply, sendEvents } from '../api.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * The background tasks (the list, each one's log, and as events while they
 * go; one cancelled), and the 小程序 (the list; what one may do beyond its
 * frame, if its app.json asks for it: net, run).
 * @param {import('../api.mjs').StudioApi} api
 * @param {import('./index.mjs').Studio} studio
 */
export function taskRoutes(api, { projectRoot, tasks, miniApps, projectApps, programEnv, articleFolder }) {
	api.get('/tasks/events', ({ request, response }) => sendEvents(request, response, (send) => {
		send({ type: 'all', tasks: tasks.list() });
		return tasks.subscribe((event) => {
			// A page that reads slower than a program writes: its log is skipped (the task keeps it whole), not piled up here.
			if (event.type === 'log' && response.writableLength > 1024 * 1024) return;
			send(event);
		});
	}), { streams: true });
	api.get('/tasks/:id', ({ params }) => {
		const task = tasks.get(params.id);
		if (!task) throw refuse(404, t('没有这个任务'));
		return task;
	});
	api.post('/tasks/:id/cancel', ({ params }) => ({ cancelled: tasks.cancel(params.id) }));

	api.get('/apps', async () => ({ apps: await miniApps.list() }));
	/** The app `id` (every app may do all it asks: they are the author's own tools). */
	const known = async (id) => {
		const app = await miniApps.get(id);
		if (!app) throw refuse(404, t('没有这个小程序'));
		return app;
	};
	// A project app's development server (docs/apps-design.md): started (resolved once it answers), stopped, how it is.
	const project = async (id) => {
		await known(id);
		const dev = await miniApps.dev(id);
		if (!dev) throw refuse(400, t('这个小程序不是项目（app.json 里没有 dev）'));
		return dev;
	};
	const statusOf = (id) => ({ ...projectApps.status(id), log: projectApps.log(id) });
	api.post('/apps/:id/start', async ({ params }) => {
		const dev = await project(params.id);
		try {
			await projectApps.start(params.id, dev);
		} catch {
			// Its state says why.
		}
		return statusOf(params.id);
	});
	api.post('/apps/:id/restart', async ({ params }) => {
		const dev = await project(params.id);
		projectApps.stop(params.id);
		try {
			await projectApps.start(params.id, dev);
		} catch {
			// Its state says why.
		}
		return statusOf(params.id);
	});
	api.post('/apps/:id/stop', async ({ params }) => {
		await project(params.id);
		projectApps.stop(params.id);
		return statusOf(params.id);
	});
	api.get('/apps/:id/status', async ({ params }) => {
		await known(params.id);
		return statusOf(params.id);
	});
	api.post('/apps/:id/fetch', async ({ params, json }) => {
		await known(params.id);
		return proxyFetch(await json());
	});
	api.post('/apps/:id/run', async ({ params, json }) => {
		const app = await known(params.id);
		const asked = await json();
		const argv = Array.isArray(asked.argv) ? asked.argv.map(String) : [];
		if (!argv.length) throw refuse(400, t('要给出运行的命令（argv）'));
		const slug = typeof asked.slug === 'string' && asked.slug ? asked.slug : null;
		const cwd = slug ? articleFolder(slug) : projectRoot;
		const task = tasks.start({ kind: 'app', title: `${app.name}：${argv.join(' ').slice(0, 60)}`, slug }, ({ log, signal }) => runProgram(argv, { cwd, env: programEnv(slug, null), log, signal }));
		return reply(202, { id: task.id });
	});
}
