import { t } from '@blog/i18n/index.mjs';
import type { Context } from '@blog/kernel/index.mjs';
import type { BlockMenuEntry, StudioBlock } from '@blog/kernel/studio.ts';
import moleculeCss from '@blog/science/browser/molecule-renderer.css?raw';
import { setMoleculeViewContext, type SavedMoleculeView } from '@blog/science/browser/molecule-renderer.ts';
import { setScienceResourceBaseUrl } from '@blog/science/browser/resource-context.ts';
import { createSciencePreview, observeSciencePreviews } from '@blog/science/browser/science-renderer.ts';
import { MOLECULE_LANGUAGES } from '@blog/science/parsers/molecule-block.ts';

import { scienceBlockPlugins } from './crepe-science-block.ts';
import blockCss from './science-block.css?raw';
import { dispatchScienceAction } from './science-block-menu.ts';
import { SCIENCE_FENCE_TYPE, scienceBlockMenuItems } from './science-block.ts';
import { setMoleculeEditor } from './science-sheet.ts';
import sheetCss from './science-sheet.css?raw';
import { scienceSlashEntries } from './science-slash-menu.ts';

/**
 * The Studio: chemistry blocks (crepe-science-block.ts), drawn as the blog
 * draws them, a sheet to change each (science-sheet.ts: 结构 in the
 * structure editor, chem-structura, or in 3D in the molecule editor a
 * plugin offers, ctx.molecules; 源码), their own menu, and a 化学 group in
 * the slash menu. A 3D view turned to is kept for the article
 * (`ctx.studio.views`), and a block that is a file of the article reads it
 * from the Studio.
 */
export const name = 'block-chemistry';
export const description = t('化学块（```smiles、```sdf、```xyz、```cube…）：画出分子结构，平面的用结构编辑器改，三维的用 RetainMol 改；转到的三维视角存在页面里。');
export const inject = ['studio', 'blocks', 'styles', 'molecules'];

/** A chemistry block's own menu: what its kind can become, its source, deleting it; and 复制 from the Studio's. */
function chemistryMenu(node: import('prosemirror-model').Node, _pos: number, standard: BlockMenuEntry[]): BlockMenuEntry[] {
	const entries: BlockMenuEntry[] = scienceBlockMenuItems(node.type.name, String(node.attrs.language ?? '')).map((item) => ({
		key: item.id,
		label: item.label,
		current: item.current,
		danger: item.action.type === 'delete',
		turn: item.section === 'convert',
		run: (view) => dispatchScienceAction(view, item.action),
	}));
	const duplicate = standard.find((entry) => entry.key === 'duplicate');
	if (duplicate) entries.splice(1, 0, duplicate);
	return entries;
}

export function apply(ctx: Context): void {
	ctx.styles.add(moleculeCss + blockCss + sheetCss);
	ctx.effect(() => {
		setMoleculeEditor(() => ctx.molecules.editor());
		return () => setMoleculeEditor(() => null);
	}, 'molecule editor');
	/** What the article shown draws with: its files, its saved views (a 3D view turned to is saved with it). */
	const show = (slug: string) => {
		setScienceResourceBaseUrl(ctx.studio.fileUrl(slug, ''));
		setMoleculeViewContext({
			views: ctx.studio.views.get() as Record<string, SavedMoleculeView>,
			save: (key, format, view, display) => ctx.studio.views.save(key, { format, view, display }),
		});
	};
	const shown = ctx.studio.shown();
	if (shown) show(shown);
	ctx.on('studio/article-showing', show);
	ctx.blocks.register({
		name,
		fence: [...MOLECULE_LANGUAGES],
		milkdown: scienceBlockPlugins,
		menuGroup: { key: 'science', label: t('化学') },
		menu: scienceSlashEntries(),
		blockMenu: { nodes: [SCIENCE_FENCE_TYPE], entries: chemistryMenu },
		drawnWhole: [SCIENCE_FENCE_TYPE],
		codeBlock: { preview: (language, content) => createSciencePreview(language, content) },
		observe: observeSciencePreviews,
		files: { extensions: [...MOLECULE_LANGUAGES, 'smi'], icon: '⬡' },
	} satisfies StudioBlock);
}
