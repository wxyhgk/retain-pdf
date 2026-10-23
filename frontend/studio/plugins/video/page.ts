import type { Context } from '@blog/kernel/index.mjs';
import type {} from '@blog/kernel/page.ts';

import './video.css';

/** The blog's pages: the videos build.mjs drew are styled (video.css); the players are Bilibili's and YouTube's own. */
export const name = 'page-video';
export const inject = ['page'];

export function apply(_ctx: Context): void {}
