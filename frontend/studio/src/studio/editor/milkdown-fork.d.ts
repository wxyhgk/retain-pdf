/**
 * What the Studio uses from the Milkdown fork (`third_party/milkdown`) that
 * the npm release the blog is type-checked against does not have yet. In dev
 * the editor runs the fork's source, so these are its signatures, copied;
 * remove one once a release has it.
 */
import type { Ctx, MilkdownPlugin } from '@milkdown/kit/ctx';
import type { NodeSchema } from '@milkdown/kit/transformer';
import type { $NodeSchema } from '@milkdown/kit/utils';

declare module '@milkdown/kit/preset/commonmark' {
	/** packages/plugins/preset-commonmark/src/node/fenced-block.ts */
	export type FencedBlockSpec = Omit<NodeSchema, 'attrs' | 'parseMarkdown' | 'toMarkdown'>;
	export type $FencedBlock<T extends string> = MilkdownPlugin[] & {
		id: T;
		type: $NodeSchema<T>['type'];
		schema: $NodeSchema<T>;
	};
	export function $fencedBlock<T extends string>(
		id: T,
		match: (language: string) => boolean,
		spec?: (ctx: Ctx) => FencedBlockSpec,
	): $FencedBlock<T>;
}
