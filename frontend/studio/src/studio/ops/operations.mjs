// Each operation once: its name (`list_pages`; on the command line `list-pages`), what it does, what it
// takes (a JSON schema, the MCP server's as it is), and how it is done (studio-ops.mjs). The command
// line (bin/studio.mjs) and the MCP server (bin/studio-mcp.mjs) are both read off this.

const slug = { type: 'string', description: '页面的文件夹名（blog/<文件夹名>/），也是它网址的最后一段' };
const text = (description) => ({ type: 'string', description });

/**
 * @typedef {object} Operation
 * @property {string} name
 * @property {string} description
 * @property {{ type: 'object', properties: Record<string, any>, required?: string[] }} input
 * @property {(ops: ReturnType<typeof import('./studio-ops.mjs').createStudioOps>, args: any) => Promise<unknown>} run
 */

/** @type {Operation[]} */
export const OPERATIONS = [
	{
		name: 'list_pages',
		description: '列出所有页面：文件夹名、标题、上级（parent）、顺序（order）、是不是草稿、类型、标签、网址。',
		input: { type: 'object', properties: {} },
		run: (ops) => ops.listPages(),
	},
	{
		name: 'page_tree',
		description: '页面树：每个页面和它下面的页面，按 Studio 侧边栏的顺序。',
		input: { type: 'object', properties: {} },
		run: (ops) => ops.pageTree(),
	},
	{
		name: 'read_page',
		description: '读一个页面：完整的 Markdown（含开头的属性）、属性、属性里的问题。',
		input: { type: 'object', properties: { slug }, required: ['slug'] },
		run: (ops, args) => ops.readPage(args),
	},
	{
		name: 'search_pages',
		description: '找标题或正文里有这些字的页面，每篇带上出现的几行。',
		input: { type: 'object', properties: { query: text('要找的字'), limit: { type: 'number', description: '最多几篇，默认 30' } }, required: ['query'] },
		run: (ops, args) => ops.searchPages(args),
	},
	{
		name: 'backlinks',
		description: '哪些页面链接到这一页，每处带上前后的话。',
		input: { type: 'object', properties: { slug }, required: ['slug'] },
		run: (ops, args) => ops.backlinks(args),
	},
	{
		name: 'create_page',
		description: '新建一个草稿页面。给了 parent 就放在那个页面下面；给了 body 就以它为正文（正文里用到的上级的 ./img/、./assets/ 文件会复制过来）。文件夹名自动起，发布时按标题改成可读的网址；也可以用 slug 指定。',
		input: {
			type: 'object',
			properties: {
				title: text('标题'),
				parent: text('上级页面的文件夹名；不给就放在最上层'),
				body: text('正文 Markdown（属性之后的全部内容）'),
				slug: text('指定文件夹名（小写字母、数字、连字符）；一般不用给'),
			},
			required: ['title'],
		},
		run: (ops, args) => ops.createPage(args),
	},
	{
		name: 'update_page',
		description: '改一个页面：body 换掉整个正文；title、description、tags、icon 改属性。改之前的版本存进它的历史版本；Studio 里开着这篇时，作者会看到改动并逐处接受或拒绝。',
		input: {
			type: 'object',
			properties: {
				slug,
				body: text('新的正文 Markdown（属性之后的全部内容）'),
				title: text('标题'),
				description: text('简介'),
				tags: { type: 'array', items: { type: 'string' }, description: '标签' },
				icon: text('图标，一个 emoji；空字符串去掉'),
			},
			required: ['slug'],
		},
		run: (ops, args) => ops.updatePage(args),
	},
	{
		name: 'move_page',
		description: '把页面放到另一个页面下面（parent），或放到最上层（parent 为空）；给了 before 或 after（同一个上级下面的页面）就排在它前面或后面。不能放到它自己或它下面的页面下面。',
		input: {
			type: 'object',
			properties: { slug, parent: text('上级页面的文件夹名；空字符串是最上层'), before: text('排在这一页前面'), after: text('排在这一页后面') },
			required: ['slug'],
		},
		run: (ops, args) => ops.movePage(args),
	},
	{
		name: 'rename_page',
		description: '改页面的文件夹名（也就是网址）；别的页面里指向它的链接跟着改。已经发布的页面改名后旧网址会失效。',
		input: { type: 'object', properties: { slug, to: text('新的文件夹名') }, required: ['slug', 'to'] },
		run: (ops, args) => ops.renamePage(args),
	},
	{
		name: 'split_page',
		description: '转成子页面：把某个标题开始的一节（到下一个同级或更高级的标题为止）变成这一页下面的新页面，标题作新页面的标题，用到的图片数据一起复制，原处留一条指向它的链接。',
		input: { type: 'object', properties: { slug, heading: text('那个标题的文字（不含 #）') }, required: ['slug', 'heading'] },
		run: (ops, args) => ops.splitPage(args),
	},
	{
		name: 'merge_page',
		description: '并入上级页面：把这一页的正文作为一节放回上级页面（替换上级里指向它的那条链接，没有就接在末尾），它下面的页面挂到上级下面，指向它的链接改指向上级，它自己移到回收站。',
		input: { type: 'object', properties: { slug }, required: ['slug'] },
		run: (ops, args) => ops.mergePage(args),
	},
	{
		name: 'delete_page',
		description: '把页面移到回收站（30 天内能用 restore_page 恢复）。children 为 delete（默认）时连同它下面的页面一起；为 lift 时只删这一页，下面的页面挂到它的上级下面。',
		input: { type: 'object', properties: { slug, children: { type: 'string', enum: ['delete', 'lift'], description: '它下面的页面怎么办' } }, required: ['slug'] },
		run: (ops, args) => ops.deletePage(args),
	},
	{
		name: 'list_trash',
		description: '回收站里的页面。',
		input: { type: 'object', properties: {} },
		run: (ops) => ops.listTrash(),
	},
	{
		name: 'restore_page',
		description: '从回收站恢复一个页面。',
		input: { type: 'object', properties: { trashed: text('list_trash 或 delete_page 给出的 trashed') }, required: ['trashed'] },
		run: (ops, args) => ops.restorePage(args),
	},
	{
		name: 'check_page',
		description: '发布前检查：照现在的样子发布，哪些会让博客构建失败（error），哪些会在页面上显示出错（warning）。',
		input: { type: 'object', properties: { slug }, required: ['slug'] },
		run: (ops, args) => ops.checkPage(args),
	},
	{
		name: 'publish_page',
		description: '发布：先做发布前检查，有 error 就不发布；草稿改成已发布；文件夹名还是自动起的就按标题改成可读的网址（链接跟着改）。推送到 GitHub 之后网站才更新。',
		input: { type: 'object', properties: { slug }, required: ['slug'] },
		run: (ops, args) => ops.publishPage(args),
	},
	{
		name: 'unpublish_page',
		description: '撤回发布：改回草稿，下次构建后从博客上消失。',
		input: { type: 'object', properties: { slug }, required: ['slug'] },
		run: (ops, args) => ops.unpublishPage(args),
	},
	{
		name: 'commit_page',
		description: '把这一页的文件夹提交到 git（连同已经删掉的页面的文件夹），不推送。',
		input: { type: 'object', properties: { slug, message: text('提交说明') }, required: ['slug', 'message'] },
		run: (ops, args) => ops.commitPage(args),
	},
	{
		name: 'git_status',
		description: 'git 里还没提交的页面：changed 是有改动的页面（new 为新页面），vanished 是已经删掉的页面。',
		input: { type: 'object', properties: {} },
		run: (ops) => ops.gitStatus(),
	},
	{
		name: 'list_history',
		description: '一个页面存下的历史版本（每次被外部改动前、恢复前存的），新的在前。',
		input: { type: 'object', properties: { slug }, required: ['slug'] },
		run: (ops, args) => ops.listHistory(args),
	},
	{
		name: 'read_history',
		description: '读一个历史版本的完整 Markdown。',
		input: { type: 'object', properties: { slug, name: text('list_history 给出的 name') }, required: ['slug', 'name'] },
		run: (ops, args) => ops.readHistory(args),
	},
	{
		name: 'search_drive',
		description: '在资料库（作者选的本地文件夹，放论文、数据等）里按文件名和文字找文件；给出资料库的路径和每个文件在里面的路径。',
		input: { type: 'object', properties: { query: text('要找的字'), limit: { type: 'number', description: '最多几个，默认 30' } }, required: ['query'] },
		run: (ops, args) => ops.searchDrive(args),
	},
];

/** The command-line name of an operation: `list_pages` → `list-pages`. */
export const commandName = (name) => name.replaceAll('_', '-');
