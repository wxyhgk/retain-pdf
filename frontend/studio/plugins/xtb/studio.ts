import { t } from '@blog/i18n/index.mjs';
import type { Context } from '@blog/kernel/index.mjs';
import type {} from '@blog/compute/programs.mjs';

import { xtb } from './program.mjs';
import { xtbView } from './view.ts';

/** The Studio: xtb as a program of ```job blocks, with how its runs are drawn (view.ts). */
export const name = 'program-xtb';
export const description = t('xtb：单点能、结构优化、频率（红外光谱、振动动画），GFN2 / GFN1 / GFN0 / GFN-FF。');
export const inject = ['jobs'];

export function apply(ctx: Context): void {
	ctx.jobs.register({ ...xtb, ...xtbView });
}
