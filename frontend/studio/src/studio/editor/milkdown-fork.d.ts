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

declare module '@milkdown/crepe/feature/block-edit' {
	/** packages/crepe/src/feature/block-edit/block-menu/index.ts */
	export type BlockMenuItem = {
		label: string;
		icon?: string;
		current?: boolean;
		danger?: boolean;
		/** The key that does the same, shown at the entry's end. */
		hint?: string;
	};
	export interface BlockMenuTarget {
		node: import('@milkdown/kit/prose/model').Node;
		pos: number;
	}
	export type BlockMenuBuilder = {
		addGroup: (
			key: string,
			label: string,
		) => {
			addItem: (key: string, item: BlockMenuItem & { onRun?: (ctx: Ctx) => void }) => unknown;
		};
	};
	export type BuildBlockMenu = (builder: BlockMenuBuilder, target: BlockMenuTarget) => void;
	export const blockMenuAPI: import('@milkdown/kit/utils').$Ctx<
		{ toggle: (pos: number, anchor: HTMLElement, placement?: 'beside' | 'below') => void; hide: () => void },
		'blockMenuAPICtx'
	>;
	/**
	 * The block edit feature's config, with `buildBlockMenu`, the slash menu's
	 * `triggers` and its items' `keywords` (block-edit/index.ts, menu/utils.ts).
	 */
	export type ForkBlockEditFeatureConfig = Omit<BlockEditFeatureConfig, 'slashMenu'> & {
		buildBlockMenu?: BuildBlockMenu;
		slashMenu?: BlockEditFeatureConfig['slashMenu'] & { triggers?: string[] };
	};
}

declare module '@milkdown/crepe/feature/latex' {
	/** packages/crepe/src/feature/latex/index.ts */
	interface LatexConfig {
		blockPreview: boolean;
	}
}
