import { t } from '@blog/i18n/index.mjs';
import { Service } from '@deepseek-ai/cordis';

/**
 * `ctx.blocks`: the blocks of an article written as fences (```job, ```xyz),
 * each claimed by one plugin. What a block is depends on the environment its
 * plugin registers it in: in the build, `remark(node, file)` turns its fence
 * into what the page shows, and `rehype(tree, file)` may finish it once the
 * page is HTML and made safe; in the Studio, `milkdown` are its editor nodes,
 * `menu` its slash-menu entries, and so on (@blog/kernel/studio.ts,
 * StudioBlock). The core reads only those fields; a block
 * may carry others for the plugins around it.
 *
 *     ctx.blocks.register({ name: 'block-job', fence: 'job', remark })
 *
 * Registering is undone when the plugin is disposed. A fence claimed twice is
 * refused, naming who has it.
 */
export class Blocks extends Service {
	/** @param {import('@deepseek-ai/cordis').Context} ctx */
	constructor(ctx) {
		super(ctx, 'blocks');
		/** @type {Map<string, any>} fence language → block */
		this.byFence = new Map();
	}

	/**
	 * @param {{ name: string, fence: string | string[], [key: string]: unknown }} block
	 * @returns {() => Promise<void>} what undoes it (also done when the plugin goes)
	 */
	register(block) {
		const fences = [block.fence].flat().map((fence) => String(fence).trim().toLowerCase()).filter(Boolean);
		if (!block?.name || !fences.length) throw new TypeError(t('块要有 name 和 fence'));
		return this.ctx.effect(() => {
			for (const fence of fences) {
				const owner = this.byFence.get(fence);
				if (owner) throw new Error(t('代码块 {fence} 已经由插件 {name} 认领', { fence, name: owner.name }));
			}
			for (const fence of fences) this.byFence.set(fence, block);
			return () => {
				for (const fence of fences) if (this.byFence.get(fence) === block) this.byFence.delete(fence);
			};
		}, `blocks.register(${fences.join(', ')})`);
	}

	/** The block whose fence this is (its language, any case); null when no plugin claims it. */
	get(fence) {
		return this.byFence.get(String(fence ?? '').trim().toLowerCase()) ?? null;
	}

	/** Every block, once each, in the order they were registered. */
	list() {
		return [...new Set(this.byFence.values())];
	}

	/** Every fence language some plugin claims. */
	fences() {
		return [...this.byFence.keys()];
	}
}
