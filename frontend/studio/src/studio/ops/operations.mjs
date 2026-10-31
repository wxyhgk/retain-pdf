// Each operation once: its name (`list_pages`; on the command line `list-pages`), what it does, what it
// takes (a JSON schema, the MCP server's as it is), and how it is done (studio-ops.mjs). The command
// line (bin/studio.mjs) and the MCP server (bin/studio-mcp.mjs) are both read off this.

const slug = { type: 'string', description: '页面的文件夹名（blog/<文件夹名>/），也是它网址的最后一段' }; // i18n-ignore: for the AI
/** A row's values, when the page above is a database. */
const props = { type: 'object', description: '数据库里这一行的值（数据库是一个 type: database 的页面，它下面的页面就是各行）：键是数据库的列名；数字写成数，勾选写 true/false，日期写 YYYY-MM-DD，多选写列表' }; // i18n-ignore: for the AI
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
		description: '列出页面：文件夹名、标题、上级（parent）、顺序（order）、是不是草稿、类型、标签、网址。可以只要某个上级下面的（parent，顶层用空字符串）、某种类型的（kind）、草稿或已发布的（draft）。', // i18n-ignore: for the AI
		input: {
			type: 'object',
			properties: {
				parent: text('只要这个页面（文件夹名）下面的；空字符串是顶层的'), // i18n-ignore: for the AI
				kind: { type: 'string', enum: ['post', 'wiki'], description: '只要博客文章（post）或知识库（wiki）' }, // i18n-ignore: for the AI
				draft: { type: 'boolean', description: 'true 只要草稿，false 只要已发布的' }, // i18n-ignore: for the AI
			},
		},
		run: (ops, args) => ops.listPages(args),
	},
	{
		name: 'page_tree',
		description: '页面树：每个页面和它下面的页面，按 Studio 侧边栏的顺序。', // i18n-ignore: for the AI
		input: { type: 'object', properties: {} },
		run: (ops) => ops.pageTree(),
	},
	{
		name: 'read_page',
		description: '读一个页面：Markdown（含开头的属性）、属性、属性里的问题、总长度。长页面一次只给一部分（4 万字以内），带 next（下一部分从哪开始）和 nextHeading（后面第一个标题）。outline 只要目录（每个标题和它在第几行）；heading 只读那个标题开始的一节；offset/limit 读其中一段。长页面先看目录再按节读。', // i18n-ignore: for the AI
		input: {
			type: 'object',
			properties: {
				slug,
				outline: { type: 'boolean', description: '只要目录' }, // i18n-ignore: for the AI
				heading: text('只读这个标题开始的一节（标题的文字，不含 #）'), // i18n-ignore: for the AI
				offset: { type: 'number', description: '从第几个字符开始读（上一次给的 next）' }, // i18n-ignore: for the AI
				limit: { type: 'number', description: '最多读多少字符（不超过 40000）' }, // i18n-ignore: for the AI
			},
			required: ['slug'],
		},
		run: (ops, args) => ops.readPage(args),
	},
	{
		name: 'search_pages',
		description: '找标题或正文里有这些字的页面，每篇带上出现的几行。', // i18n-ignore: for the AI
		input: { type: 'object', properties: { query: text('要找的字'), limit: { type: 'number', description: '最多几篇，默认 30' } }, required: ['query'] }, // i18n-ignore: for the AI
		run: (ops, args) => ops.searchPages(args),
	},
	{
		name: 'backlinks',
		description: '哪些页面链接到这一页，每处带上前后的话。', // i18n-ignore: for the AI
		input: { type: 'object', properties: { slug }, required: ['slug'] },
		run: (ops, args) => ops.backlinks(args),
	},
	{
		name: 'create_page',
		description: '新建一个草稿页面。给了 parent 就放在那个页面下面，并在上级页面里放一行链到它的页面链接（像 Notion 的子页面块）：默认放在上级正文末尾，link_after 写上级里的一个标题或一句话，就放在那一节末尾或那一段后面；link: false 不放。给了 body 就以它为正文（正文里用到的上级的 ./img/、./assets/ 文件会复制过来）。parent 是数据库（type: database）时，新页面就是它的一行（不放链接），用 props 写这一行的值。文件夹名自动起，发布时按标题改成可读的网址；也可以用 slug 指定。', // i18n-ignore: for the AI
		input: {
			type: 'object',
			properties: {
				title: text('标题'), // i18n-ignore: for the AI
				parent: text('上级页面的文件夹名；不给就放在最上层'), // i18n-ignore: for the AI
				body: text('正文 Markdown（属性之后的全部内容）'), // i18n-ignore: for the AI
				slug: text('指定文件夹名（小写字母、数字、连字符）；一般不用给'), // i18n-ignore: for the AI
				props, // i18n-ignore: for the AI
				link: { type: 'boolean', description: '在上级页面里放链到新页面的链接；默认 true' }, // i18n-ignore: for the AI
				link_after: text('链接放在上级页面的哪里：一个标题（放在那一节末尾）或一句话里的几个字（放在那一段后面）；不给就放在末尾'), // i18n-ignore: for the AI
			},
			required: ['title'],
		},
		run: (ops, args) => ops.createPage(args),
	},
	{
		name: 'edit_page',
		description: '改一篇正文里的一段：old 是正文里的原文（一字不差，要只出现一次，不够就多带几句前后文），new 是改成的样子（空字符串就是删掉）；all: true 把每一处都改。只改属性之后的正文，属性用 update_page 改。改之前的版本存进历史；Studio 里开着这篇时作者会逐处接受或拒绝。返回改在第几行和改完后页面的问题。在命令行里、或手边没有编辑工具时改正文用它；有编辑工具的，直接编辑 index.md 的正文也行（属性不能这样改）。', // i18n-ignore: for the AI
		input: {
			type: 'object',
			properties: {
				slug,
				old: text('正文里要改的原文'), // i18n-ignore: for the AI
				new: text('改成的文字；空字符串是删掉'), // i18n-ignore: for the AI
				all: { type: 'boolean', description: '每一处都改（默认只许有一处）' }, // i18n-ignore: for the AI
			},
			required: ['slug', 'old', 'new'],
		},
		run: (ops, args) => ops.editPage(args),
	},
	{
		name: 'create_database',
		description: '新建一个数据库（像 Notion 的）：它自己是一个页面（type: database），它下面的页面就是各行，再用 create_page（parent 给这个数据库）加行。给了 parent 就放在那个页面下面，并在那一页末尾放一个显示它的块（show: false 就不放，成了一个整页的数据库）。columns 是列：每列 {"name": 列名, "type": text|number|select|multi|date|checkbox|url, "options": [单选/多选的选项]}。', // i18n-ignore: for the AI
		input: {
			type: 'object',
			properties: {
				title: text('数据库的名字'), // i18n-ignore: for the AI
				parent: text('放在哪个页面下面（文件夹名）；不给就放在最上层'), // i18n-ignore: for the AI
				columns: { type: 'array', items: { type: 'object' }, description: '列，按顺序；标题列不用写（每行的标题就是页面标题）' }, // i18n-ignore: for the AI
				show: { type: 'boolean', description: '在 parent 那一页末尾放一个显示它的块；默认 true' }, // i18n-ignore: for the AI
			},
			required: ['title'],
		},
		run: (ops, args) => ops.createDatabase(args),
	},
	{
		name: 'update_page',
		description: '改一个页面：body 换掉整个正文；title、description、tags、icon 改属性；props 改它在数据库里那一行的值。改之前的版本存进它的历史版本；Studio 里开着这篇时，作者会看到改动并逐处接受或拒绝。', // i18n-ignore: for the AI
		input: {
			type: 'object',
			properties: {
				slug,
				body: text('新的正文 Markdown（属性之后的全部内容）'), // i18n-ignore: for the AI
				title: text('标题'), // i18n-ignore: for the AI
				description: text('简介'), // i18n-ignore: for the AI
				tags: { type: 'array', items: { type: 'string' }, description: '标签' }, // i18n-ignore: for the AI
				icon: text('图标，一个 emoji；空字符串去掉'), // i18n-ignore: for the AI
				props: { ...props, description: `${props.description}；只改给出的列，值写 null 去掉这一列的值` }, // i18n-ignore: for the AI
			},
			required: ['slug'],
		},
		run: (ops, args) => ops.updatePage(args),
	},
	{
		name: 'move_page',
		description: '把页面放到另一个页面下面（parent），或放到最上层（parent 为空）；给了 before 或 after（同一个上级下面的页面）就排在它前面或后面。不能放到它自己或它下面的页面下面。', // i18n-ignore: for the AI
		input: {
			type: 'object',
			properties: { slug, parent: text('上级页面的文件夹名；空字符串是最上层'), before: text('排在这一页前面'), after: text('排在这一页后面') }, // i18n-ignore: for the AI
			required: ['slug'],
		},
		run: (ops, args) => ops.movePage(args),
	},
	{
		name: 'rename_page',
		description: '改页面的文件夹名（也就是网址）；别的页面里指向它的链接跟着改。已经发布的页面改名后旧网址会失效。', // i18n-ignore: for the AI
		input: { type: 'object', properties: { slug, to: text('新的文件夹名') }, required: ['slug', 'to'] }, // i18n-ignore: for the AI
		run: (ops, args) => ops.renamePage(args),
	},
	{
		name: 'split_page',
		description: '转成子页面：把某个标题开始的一节（到下一个同级或更高级的标题为止）变成这一页下面的新页面，标题作新页面的标题，用到的图片数据一起复制，原处留一条指向它的链接。', // i18n-ignore: for the AI
		input: { type: 'object', properties: { slug, heading: text('那个标题的文字（不含 #）') }, required: ['slug', 'heading'] }, // i18n-ignore: for the AI
		run: (ops, args) => ops.splitPage(args),
	},
	{
		name: 'merge_page',
		description: '并入上级页面：把这一页的正文作为一节放回上级页面（替换上级里指向它的那条链接，没有就接在末尾），它下面的页面挂到上级下面，指向它的链接改指向上级，它自己移到回收站。', // i18n-ignore: for the AI
		input: { type: 'object', properties: { slug }, required: ['slug'] },
		run: (ops, args) => ops.mergePage(args),
	},
	{
		name: 'delete_page',
		description: '把页面移到回收站（30 天内能用 restore_page 恢复）。children 为 delete（默认）时连同它下面的页面一起；为 lift 时只删这一页，下面的页面挂到它的上级下面。', // i18n-ignore: for the AI
		input: { type: 'object', properties: { slug, children: { type: 'string', enum: ['delete', 'lift'], description: '它下面的页面怎么办' } }, required: ['slug'] }, // i18n-ignore: for the AI
		run: (ops, args) => ops.deletePage(args),
	},
	{
		name: 'list_trash',
		description: '回收站里的页面。', // i18n-ignore: for the AI
		input: { type: 'object', properties: {} },
		run: (ops) => ops.listTrash(),
	},
	{
		name: 'restore_page',
		description: '从回收站恢复一个页面。', // i18n-ignore: for the AI
		input: { type: 'object', properties: { trashed: text('list_trash 或 delete_page 给出的 trashed') }, required: ['trashed'] }, // i18n-ignore: for the AI
		run: (ops, args) => ops.restorePage(args),
	},
	{
		name: 'check_page',
		description: '发布前检查：照现在的样子发布，哪些会让博客构建失败（error），哪些会在页面上显示出错（warning）。ok 为 true 就是能发布（没有 error）；issues 是查出的每一处。', // i18n-ignore: for the AI
		input: { type: 'object', properties: { slug }, required: ['slug'] },
		run: (ops, args) => ops.checkPage(args),
	},
	{
		name: 'preview_page',
		description: '看一个页面显示出来是什么样（你看不到页面时用它，不要自己开浏览器、截图）：逐块说它显示成什么，第几行开始：标题、段落、页面链接（单独一行的、句子里的，各链到哪篇、那篇在不在、是不是草稿）、图（编号、文件在不在）、公式、表格、代码块、交互模块（框多高、运行哪个文件、加载哪些脚本、读哪些数据）。从头看时附上发布前检查查出的问题（issues）。交互模块的脚本运行起来对不对这里看不出，用 check_widgets。长页面一次给 200 块，带 next（下次从第几行看，传给 from）。', // i18n-ignore: for the AI
		input: { type: 'object', properties: { slug, from: { type: 'integer', description: '从这一行开始看（上次给的 next）' } }, required: ['slug'] }, // i18n-ignore: for the AI
		run: (ops, args) => ops.previewPage(args),
	},
	{
		name: 'check_widgets',
		description: '把页面里的交互模块（```widget）在后台的浏览器里真的运行一遍，和 Studio、博客里一样（读文章里的数据文件）：每个模块的报错（errors，line 是模块自己源码的第几行，@file 的就是那个文件的第几行）、控制台里别的错（console）、画出来多高（height）、显示的字（shows.text）、画布几个、其中几个是空的（shows.blankCanvases：一笔没画，多半是脚本在画之前就出错了）、一张截图（picture，png 文件的路径，用读图片的办法看它）。写完或改完交互模块就用它验，不要自己开浏览器、截图、写桩测试；作者说模块空白、不对时也先用它。widget 是第几个（从 1 数），不填就全部。', // i18n-ignore: for the AI
		input: { type: 'object', properties: { slug, widget: { type: 'integer', description: '第几个交互模块（从 1 数），不填就全部' } }, required: ['slug'] }, // i18n-ignore: for the AI
		run: (ops, args) => ops.checkWidgets(args),
	},
	{
		name: 'publish_page',
		description: '发布：先做发布前检查，有 error 就不发布；草稿改成已发布；文件夹名还是自动起的就按标题改成可读的网址（链接跟着改）。推送到 GitHub 之后网站才更新。', // i18n-ignore: for the AI
		input: { type: 'object', properties: { slug }, required: ['slug'] },
		run: (ops, args) => ops.publishPage(args),
	},
	{
		name: 'unpublish_page',
		description: '撤回发布：改回草稿，下次构建后从博客上消失。', // i18n-ignore: for the AI
		input: { type: 'object', properties: { slug }, required: ['slug'] },
		run: (ops, args) => ops.unpublishPage(args),
	},
	{
		name: 'commit_page',
		description: '把这一页的文件夹提交到 git（连同已经删掉的页面的文件夹），不推送。', // i18n-ignore: for the AI
		input: { type: 'object', properties: { slug, message: text('提交说明') }, required: ['slug', 'message'] }, // i18n-ignore: for the AI
		run: (ops, args) => ops.commitPage(args),
	},
	{
		name: 'git_status',
		description: 'git 里还没提交的页面：changed 是有改动的页面（new 为新页面），vanished 是已经删掉的页面。给了 slug 就只说这一页：new、modified、vanished 或 clean（没有改动）。', // i18n-ignore: for the AI
		input: { type: 'object', properties: { slug: text('只看这一页（文件夹名）') } }, // i18n-ignore: for the AI
		run: (ops, args) => ops.gitStatus(args),
	},
	{
		name: 'list_history',
		description: '一个页面存下的历史版本（写作时每 10 分钟自动存的，每次被外部改动前、恢复前存的），新的在前。', // i18n-ignore: for the AI
		input: { type: 'object', properties: { slug }, required: ['slug'] },
		run: (ops, args) => ops.listHistory(args),
	},
	{
		name: 'read_history',
		description: '读一个历史版本的完整 Markdown。', // i18n-ignore: for the AI
		input: { type: 'object', properties: { slug, name: text('list_history 给出的 name') }, required: ['slug', 'name'] }, // i18n-ignore: for the AI
		run: (ops, args) => ops.readHistory(args),
	},
	{
		name: 'search_drive',
		description: '在资料库（作者选的本地文件夹，放论文、数据等）里按文件名和文字找文件；给出资料库的路径和每个文件在里面的路径。', // i18n-ignore: for the AI
		input: { type: 'object', properties: { query: text('要找的字'), limit: { type: 'number', description: '最多几个，默认 30' } }, required: ['query'] }, // i18n-ignore: for the AI
		run: (ops, args) => ops.searchDrive(args),
	},
	{
		name: 'list_apps',
		description: '列出作者的小程序（apps/ 下）：名字、文件夹、是一页网页还是项目（项目的代码在 app.json 或 app.local.json 的 dev.cwd）、它给文章提供的块（```块名）。改小程序照技能 studio-mini-apps。', // i18n-ignore: for the AI
		input: { type: 'object', properties: {} },
		run: (ops) => ops.listApps(),
	},
	{
		name: 'app_status',
		description: '一个小程序现在怎么样：项目型的开发服务器是否在跑、它最近的输出，以及它的页面（窗口里、文章的块里）最近出的错。改完小程序用它看错误清掉没有。要 Studio 开着。', // i18n-ignore: for the AI
		input: { type: 'object', properties: { id: text('小程序的文件夹名（apps/<文件夹名>）') }, required: ['id'] }, // i18n-ignore: for the AI
		run: (ops, args) => ops.appStatus(args),
	},
	{
		name: 'list_repos',
		description: '列出「代码仓库」里的仓库（作者的 git 仓库：Studio 自己的在 repos/，加上作者添加的本机仓库）：id、名字、路径、说明、分支、最近一次提交、没提交的改动数、语言。要在某个仓库里干活，cd 到它的路径（路径里的 ~ 是家目录）。', // i18n-ignore: for the AI
		input: { type: 'object', properties: {} },
		run: (ops) => ops.listRepos(),
	},
	{
		name: 'add_repo',
		description: '把本机已有的一个 git 仓库加进「代码仓库」（只记下它的路径，文件夹不动）。给仓库里任何一个文件夹都行，可以用 ~；不是 git 仓库会说。不知道在哪就先用 found: true 列出常见位置（~/Code 等，往下两层）还没加的仓库。', // i18n-ignore: for the AI
		input: { type: 'object', properties: { path: text('仓库的路径，比如 ~/Code/resume'), found: { type: 'boolean', description: 'true：不加，只列出常见位置里还没加的仓库' } } }, // i18n-ignore: for the AI
		run: (ops, args) => ops.addRepo(args),
	},
	{
		name: 'create_repo',
		description: '在「代码仓库」里新建一个 Studio 自己的仓库：repos/<name>/，带 git、README（写上 description）和第一次提交。之后把代码写进它的路径（list_repos 给出），而不是写进笔记。', // i18n-ignore: for the AI
		input: { type: 'object', properties: { name: text('仓库名：文字、数字和 . _ -'), description: text('一句话说明它是做什么的') }, required: ['name'] }, // i18n-ignore: for the AI
		run: (ops, args) => ops.createRepo(args),
	},
	{
		name: 'remove_repo',
		description: '把一个加进来的本机仓库从「代码仓库」的列表里拿掉（文件夹不动，不删任何东西）。Studio 自己的仓库不能这样删。', // i18n-ignore: for the AI
		input: { type: 'object', properties: { id: text('list_repos 给出的 id') }, required: ['id'] }, // i18n-ignore: for the AI
		run: (ops, args) => ops.removeRepo(args),
	},
];

/** The command-line name of an operation: `list_pages` → `list-pages`. */
export const commandName = (name) => name.replaceAll('_', '-');
