import type { Context } from '@blog/kernel/index.mjs';
import type {} from '@blog/kernel/page.ts';

import './energy.css';

/** The blog's pages: the diagrams build.mjs drew are styled (energy.css); nothing else to do. */
export const name = 'page-energy';
export const inject = ['page'];

export function apply(_ctx: Context): void {}
