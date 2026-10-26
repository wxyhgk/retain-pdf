import { t } from '@blog/i18n/index.mjs';
import type { Context } from '@blog/kernel/index.mjs';
import type {} from '@blog/compute/programs.mjs';

import { crest } from './program.mjs';
import { crestView } from './view.ts';

/** The Studio: CREST as a program of ```job blocks, with how its runs are drawn (view.ts). */
export const name = 'program-crest';
export const description = t('CREST：构象搜索，结果是构象表和玻尔兹曼占比；它会调用 xtb。');
export const inject = ['jobs'];

export function apply(ctx: Context): void {
	ctx.jobs.register({ ...crest, ...crestView });
}
