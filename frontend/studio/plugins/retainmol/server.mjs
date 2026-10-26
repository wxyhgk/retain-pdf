import { RetainmolHost } from './retainmol-host.mjs';

/**
 * The Studio's dev server: RetainMol, built from its own checkout (again
 * only when its code changed, retainmol-host.mjs) and served from here, got
 * ready when the server starts so that the first sheet need not wait for it.
 * The browser tests point it at a stand-in (STUDIO_RETAINMOL_URL), and do
 * not build it for nothing.
 *
 *     POST /api/studio/plugins/retainmol/url    its address, once served
 */
export const name = 'server-retainmol';
export const inject = ['server', 'routes'];

export function apply(ctx) {
	const { server } = ctx;
	const host = new RetainmolHost({ projectRoot: server.projectRoot, settingsFile: server.settingsFile, fixedUrl: process.env.STUDIO_RETAINMOL_URL || null });
	ctx.effect(() => {
		if (!server.testing) void host.start().catch((error) => server.logger.warn(`[studio] RetainMol 没有准备好：${error.message}`)); // i18n-ignore: log
		return () => host.close();
	}, 'retainmol host');
	ctx.routes.post('/retainmol/url', async () => ({ url: await host.start() }));
}
