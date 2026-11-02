import { t } from '@blog/i18n/index.mjs';
import { Service } from '@deepseek-ai/cordis';

/**
 * `ctx.routes` (the Studio's dev server): a plugin's API, under
 * `/api/studio/x/<plugin>/…`. The server checks every request first (from
 * this machine, from its own pages, a JSON body declared as such) and
 * answers with what the handler returns, as JSON; an error's `statusCode`
 * (400 when it has none… 500) and message become the answer instead.
 *
 *     ctx.routes.get('/job/articles/:slug/jobs/:id/runs', ({ params }) => runs.list(params.slug, params.id))
 *     ctx.routes.post('/job/hosts/detect', async ({ json }) => detect(await json()))
 *
 * `created(value)` answers 201. Registering is undone with the plugin.
 */
export class Routes extends Service {
	/** @param {import('@deepseek-ai/cordis').Context} ctx */
	constructor(ctx) {
		super(ctx, 'routes');
		/** @type {Array<{ method: string, pattern: RegExp, names: string[], path: string, handler: Function }>} */
		this.entries = [];
	}

	/** Registers `handler` for `method` on `path` (`:name` takes one segment). */
	register(method, path, handler) {
		if (!/^\/[\w\-./:]*$/u.test(path)) throw new TypeError(t('路由 {path} 不对：以 / 开头，段可用 :名字', { path }));
		const names = [];
		const pattern = new RegExp(`^${path.replace(/[.]/gu, '\\.').replace(/:(\w+)/gu, (_, name) => {
			names.push(name);
			return '([^/]+)';
		})}$`, 'u');
		const entry = { method: method.toUpperCase(), pattern, names, path, handler };
		return this.ctx.effect(() => {
			this.entries.push(entry);
			return () => {
				const index = this.entries.indexOf(entry);
				if (index >= 0) this.entries.splice(index, 1);
			};
		}, `routes.${method.toLowerCase()}(${path})`);
	}

	get(path, handler) {
		return this.register('GET', path, handler);
	}

	post(path, handler) {
		return this.register('POST', path, handler);
	}

	put(path, handler) {
		return this.register('PUT', path, handler);
	}

	/** The handler for this request, and the path's named segments (decoded); null when none. */
	match(method, path) {
		for (const entry of this.entries) {
			if (entry.method !== method.toUpperCase()) continue;
			const found = entry.pattern.exec(path);
			if (!found) continue;
			const params = {};
			entry.names.forEach((name, index) => {
				try {
					params[name] = decodeURIComponent(found[index + 1]);
				} catch {
					throw Object.assign(new Error(t('地址的编码不对')), { statusCode: 400 });
				}
			});
			return { handler: entry.handler, params };
		}
		return null;
	}
}

/** An answer with status 201 (something made). */
export function created(value) {
	return { [CREATED]: true, value };
}

const CREATED = Symbol.for('blog.kernel.created');

/** Whether a handler's answer is `created(…)`, and what it holds. */
export function readAnswer(answer) {
	return answer && typeof answer === 'object' && answer[CREATED] ? { status: 201, value: answer.value } : { status: 200, value: answer };
}
