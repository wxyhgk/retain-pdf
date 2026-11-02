// 代码仓库 › 仓库: the repositories on this machine as GitHub shows them — the list; one repository's home (its files,
// its README); a file. What is shown is in the address after # (`#repo=…&dir=…`, `#repo=…&file=…`), so ‹ › and a
// link in a README go where they say. Everything comes from the Studio (`studio.repos.*`): this page reads no folder.

const root = document.getElementById('repos');

/** An element: its tag, its attributes (`on…` listeners, `class`, others as they are), what is in it. */
function h(tag, attributes = {}, ...children) {
	const element = document.createElement(tag);
	for (const [name, value] of Object.entries(attributes)) {
		if (value === undefined || value === null || value === false) continue;
		if (name.startsWith('on')) element.addEventListener(name.slice(2), value);
		else if (name === 'class') element.className = value;
		else element.setAttribute(name, value === true ? '' : value);
	}
	element.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
	return element;
}

function when(time) {
	if (!time) return '';
	const minutes = Math.floor((Date.now() - time) / 60000);
	if (minutes < 1) return '刚刚';
	if (minutes < 60) return `${minutes} 分钟前`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} 小时前`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days} 天前`;
	return new Date(time).toISOString().slice(0, 10);
}
const size = (bytes) => (bytes == null ? '' : bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`);
const failed = (error) => h('p', { class: 'r-error' }, error?.message ?? String(error));

/** Where we are, from the address: the list, or a repository at a folder or a file. */
function place() {
	const asked = new URLSearchParams(location.hash.slice(1));
	return { repo: asked.get('repo') ?? '', dir: asked.get('dir') ?? '', file: asked.get('file') ?? '' };
}
function go(to) {
	const asked = new URLSearchParams();
	for (const [key, value] of Object.entries(to)) if (value) asked.set(key, value);
	const hash = asked.toString();
	if (location.hash.slice(1) === hash) draw();
	else location.hash = hash;
}

let repositories = [];
let query = '';
/** The panel open above the list: 新建 or 添加, or none. */
let adding = '';

async function draw() {
	const { repo, dir, file } = place();
	if (!repo) return drawList();
	try {
		if (!repositories.length) repositories = await studio.repos.list();
	} catch {}
	const repository = repositories.find((each) => each.id === repo);
	if (file) return drawFile(repo, repository, file);
	return drawFolder(repo, repository, dir);
}

// ——— The list ———

async function drawList(fresh = true) {
	if (fresh) {
		try {
			repositories = await studio.repos.list();
		} catch (error) {
			root.replaceChildren(h('div', { class: 'r-page' }, failed(error)));
			return;
		}
	}
	const words = query.toLowerCase().split(/\s+/u).filter(Boolean);
	const shown = repositories.filter((each) => words.every((word) => [each.name, each.description, each.path, ...each.languages.map((language) => language.name)].join(' ').toLowerCase().includes(word)));
	const search = h('input', { class: 'r-search', type: 'search', placeholder: '找仓库：名字、说明、语言、路径', value: query, oninput: (event) => {
		query = event.target.value;
		drawList(false);
		const again = root.querySelector('.r-search');
		again.focus();
		again.setSelectionRange(query.length, query.length);
	} });
	const bar = h(
		'div',
		{ class: 'r-bar' },
		h('h2', {}, '仓库'),
		h('span', { class: 'r-muted r-small' }, `${repositories.length} 个`),
		search,
		h('span', { class: 'grow' }),
		h('button', { class: 'r-primary', id: 'repo-new', onclick: () => ((adding = adding === 'new' ? '' : 'new'), drawList(false)) }, '新建仓库'),
		h('button', { id: 'repo-add', onclick: () => ((adding = adding === 'add' ? '' : 'add'), drawList(false)) }, '添加本机仓库'),
		h('button', { title: '重新读一遍（提交过、改过文件之后）', onclick: () => drawList() }, '刷新'),
	);
	const panel = adding === 'new' ? newPanel() : adding === 'add' ? addPanel() : null;
	const list = shown.length
		? h('div', { class: 'r-repos' }, shown.map(repoRow))
		: h('div', { class: 'r-empty' }, repositories.length ? '没有符合的仓库' : '还没有仓库。新建一个，或者把本机已有的 git 仓库（比如 ~/Code 里的）添加进来。');
	root.replaceChildren(h('div', { class: 'r-page' }, bar, panel, list));
}

function repoRow(repository) {
	const languages = repository.languages.map((language) => `${language.name} ${language.share}%`).join(' · ');
	return h(
		'div',
		{ class: 'r-repo', 'data-repo': repository.id },
		h('div', { class: 'r-repo-head' }, h('button', { class: 'r-name', onclick: () => go({ repo: repository.id }) }, repository.name), h('span', { class: 'r-tag' }, repository.own ? 'Studio' : '本机')),
		repository.description ? h('p', { class: 'r-description' }, repository.description) : null,
		repository.problem
			? h('p', { class: 'r-error r-small' }, repository.problem)
			: h(
					'div',
					{ class: 'r-meta' },
					languages ? h('span', {}, languages) : null,
					repository.branch ? h('span', {}, '分支 ', h('strong', {}, repository.branch)) : null,
					repository.commit ? h('span', { title: `${repository.commit.hash} ${repository.commit.author}` }, `${when(repository.commit.time)}提交：${repository.commit.subject}`) : h('span', {}, '还没有提交'),
					repository.changes ? h('span', {}, h('strong', {}, `${repository.changes} 处`), ' 没提交的改动') : null,
				),
		h('div', { class: 'r-path' }, repository.path),
	);
}

function newPanel() {
	const status = h('p', { class: 'r-small r-muted' }, '建在 Studio 的 repos/ 里（不进博客的 git），自带 git 和 README。');
	const name = h('input', { type: 'text', id: 'repo-new-name', placeholder: '仓库名，比如 ts-search', autocomplete: 'off', spellcheck: 'false' });
	const description = h('input', { type: 'text', id: 'repo-new-description', placeholder: '一句话说明它是做什么的（写进 README）' });
	const form = h(
		'form',
		{
			onsubmit: async (event) => {
				event.preventDefault();
				status.className = 'r-small r-muted';
				status.textContent = '正在新建…';
				try {
					const made = await studio.repos.create(name.value.trim(), description.value.trim());
					adding = '';
					repositories = [];
					go({ repo: made.id });
				} catch (error) {
					status.className = 'r-small r-error';
					status.textContent = error.message;
				}
			},
		},
		name,
		description,
		h('div', { class: 'r-row' }, h('button', { type: 'submit', class: 'r-primary' }, '新建'), h('button', { type: 'button', onclick: () => ((adding = ''), drawList(false)) }, '取消')),
	);
	queueMicrotask(() => name.focus());
	return h('div', { class: 'r-panel', id: 'repo-new-panel' }, h('h3', {}, '新建仓库'), form, status);
}

function addPanel() {
	const status = h('p', { class: 'r-small r-muted' }, '在 ~/Code 这些常见的地方找到的、还没加进来的仓库：');
	const found = h('div', { class: 'r-found' }, h('div', { class: 'r-muted r-small' }, '正在找…'));
	const add = async (path) => {
		status.className = 'r-small r-muted';
		status.textContent = `正在添加 ${path}…`;
		try {
			const added = await studio.repos.add(path);
			adding = '';
			repositories = [];
			go({ repo: added.id });
		} catch (error) {
			status.className = 'r-small r-error';
			status.textContent = error.message;
		}
	};
	studio.repos.found().then(
		(list) =>
			found.replaceChildren(
				...(list.length
					? list.map((each) => h('div', {}, h('span', { class: 'grow' }, h('strong', {}, each.name), h('span', { class: 'r-path' }, each.shown)), h('button', { onclick: () => add(each.path) }, '添加')))
					: [h('div', { class: 'r-muted r-small' }, '常见的地方没有找到别的 git 仓库；在下面写它的路径。')]),
			),
		(error) => found.replaceChildren(h('div', {}, failed(error))),
	);
	const path = h('input', { type: 'text', id: 'repo-add-path', class: 'grow', placeholder: '或者写路径：~/Code/项目（里面的任何文件夹都行）', autocomplete: 'off', spellcheck: 'false' });
	const form = h('form', { onsubmit: (event) => (event.preventDefault(), add(path.value.trim())) }, h('div', { class: 'r-row' }, path, h('button', { type: 'submit', class: 'r-primary' }, '添加')));
	return h('div', { class: 'r-panel', id: 'repo-add-panel' }, h('h3', {}, '添加本机仓库'), status, found, form, h('p', { class: 'r-small r-muted' }, '只是在这里显示它，文件夹不动；从列表移除也不会删任何东西。'));
}

// ——— A repository: a folder, a file ———

/** 仓库 / name / folder / … : each part goes there. */
function crumbs(repo, repository, path, last) {
	const parts = path ? path.split('/') : [];
	const bits = [h('button', { onclick: () => go({}) }, '仓库'), h('span', { class: 'sep' }, '/'), h('button', { class: parts.length ? '' : 'here', onclick: () => go({ repo }) }, repository?.name ?? repo)];
	parts.forEach((part, index) => {
		const to = parts.slice(0, index + 1).join('/');
		const isLast = index === parts.length - 1;
		bits.push(h('span', { class: 'sep' }, '/'), h('button', { class: isLast ? 'here' : '', onclick: () => go(isLast && last === 'file' ? { repo, file: to } : { repo, dir: to }) }, part));
	});
	return h('nav', { class: 'r-crumbs' }, bits);
}

function about(repository) {
	if (!repository) return null;
	const copy = () => navigator.clipboard.writeText(repository.path).then(() => studio.toast('已复制路径'));
	return h(
		'div',
		{ class: 'r-about' },
		repository.description ? h('p', { class: 'r-description' }, repository.description) : null,
		h(
			'div',
			{ class: 'r-meta' },
			h('span', { class: 'r-tag' }, repository.own ? 'Studio' : '本机'),
			repository.branch ? h('span', {}, '分支 ', h('strong', {}, repository.branch)) : null,
			repository.commit ? h('span', { title: repository.commit.author }, `${repository.commit.hash} · ${when(repository.commit.time)}：${repository.commit.subject}`) : null,
			repository.changes ? h('span', {}, h('strong', {}, `${repository.changes} 处`), ' 没提交的改动') : null,
			h('span', {}, `${repository.files} 个文件`),
			repository.remote ? h('span', {}, repository.remote) : null,
		),
		h(
			'div',
			{ class: 'r-actions' },
			h('span', { class: 'r-path', style: 'align-self: center' }, repository.path),
			h('button', { onclick: copy }, '复制路径'),
			h('button', { onclick: () => ((repositories = []), draw()) }, '刷新'),
			repository.own
				? null
				: h('button', { id: 'repo-remove', onclick: async () => {
						if (!confirm(`从列表里移除「${repository.name}」？文件夹不会动。`)) return;
						await studio.repos.remove(repository.id);
						repositories = [];
						go({});
					} }, '从列表移除'),
		),
	);
}

async function drawFolder(repo, repository, dir) {
	let tree;
	try {
		tree = await studio.repos.tree(repo, dir);
	} catch (error) {
		root.replaceChildren(h('div', { class: 'r-page' }, crumbs(repo, repository, dir, 'dir'), failed(error)));
		return;
	}
	const rows = [];
	if (dir) rows.push(h('tr', {}, h('td', { class: 'icon' }, '↰'), h('td', {}, h('button', { onclick: () => go({ repo, dir: dir.split('/').slice(0, -1).join('/') }) }, '..')), h('td', { class: 'size' })));
	for (const entry of tree.entries) {
		const open = () => go(entry.kind === 'folder' ? { repo, dir: entry.path } : { repo, file: entry.path });
		rows.push(h('tr', { 'data-path': entry.path }, h('td', { class: 'icon' }, entry.kind === 'folder' ? '▸' : '·'), h('td', {}, h('button', { onclick: open }, entry.name)), h('td', { class: 'size' }, entry.kind === 'folder' ? '' : size(entry.size))));
	}
	const files = h(
		'div',
		{ class: 'r-box' },
		h('div', { class: 'r-box-head' }, h('span', { class: 'grow' }, repository?.commit ? `${repository.commit.subject}` : '文件'), h('span', { class: 'r-muted' }, `${tree.entries.length} 项${tree.truncated ? '（只列出前 3000 个）' : ''}`)),
		tree.entries.length || dir ? h('table', { class: 'r-files' }, h('tbody', {}, rows)) : h('div', { class: 'r-empty' }, '这个仓库还没有文件'),
	);
	const readme = tree.readme ? h('div', { class: 'r-box r-readme' }, h('div', { class: 'r-box-head' }, h('span', { class: 'grow' }, tree.readme.path)), markdown(repo, tree.readme.html)) : null;
	root.replaceChildren(h('div', { class: 'r-page' }, crumbs(repo, repository, dir, 'dir'), dir ? null : about(repository), files, readme));
}

/** README's HTML (made safe by the Studio), its links to the repository's files opened here. */
function markdown(repo, html) {
	const box = h('div', { class: 'r-markdown' });
	box.innerHTML = html;
	box.addEventListener('click', (event) => {
		const link = event.target.closest('a[href^="#file="]');
		if (!link) return;
		event.preventDefault();
		const path = decodeURIComponent(link.getAttribute('href').slice('#file='.length));
		go({ repo, file: path });
	});
	return box;
}

async function drawFile(repo, repository, path) {
	let file;
	try {
		file = await studio.repos.file(repo, path);
	} catch (error) {
		root.replaceChildren(h('div', { class: 'r-page' }, crumbs(repo, repository, path, 'file'), failed(error)));
		return;
	}
	let showSource = !file.html;
	const body = h('div');
	const toggle = file.html ? h('button', { onclick: () => ((showSource = !showSource), fill()) }) : null;
	const fill = () => {
		if (toggle) toggle.textContent = showSource ? '预览' : '源码';
		if (file.kind === 'picture') body.replaceChildren(h('div', { class: 'r-picture' }, h('img', { src: file.raw, alt: path })));
		else if (file.kind === 'binary') body.replaceChildren(h('div', { class: 'r-empty' }, '这不是文本文件。'));
		else if (file.kind === 'large') body.replaceChildren(h('div', { class: 'r-empty' }, `文件太大（${size(file.size)}），不在这里显示。`));
		else if (!showSource) body.replaceChildren(markdown(repo, file.html));
		else body.replaceChildren(codeOf(file));
	};
	fill();
	const lines = file.kind === 'text' ? file.text.replace(/\n$/u, '').split('\n').length : null;
	const head = h(
		'div',
		{ class: 'r-box-head' },
		h('span', { class: 'grow' }, [file.language, lines ? `${lines} 行` : '', size(file.size)].filter(Boolean).join(' · ')),
		toggle,
		file.kind === 'text' ? h('button', { onclick: () => navigator.clipboard.writeText(file.text).then(() => studio.toast('已复制')) }, '复制') : null,
		h('button', { onclick: () => window.open(file.raw, '_blank') }, '原始文件'),
	);
	root.replaceChildren(h('div', { class: 'r-page' }, crumbs(repo, repository, path, 'file'), h('div', { class: 'r-box' }, head, body)));
}

/** The text line by line, numbered; its words drawn by kind (keywords heavier, comments grey) when the Studio read it. */
function codeOf(file) {
	const pre = h('pre', { class: 'r-code' });
	const lines = file.lines ?? file.text.split('\n').map((line) => (line ? [[line, '']] : []));
	// The last line's end is not a line more.
	if (file.text.endsWith('\n') && lines.length && !lines.at(-1).length) lines.pop();
	for (const line of lines) {
		const span = h('span');
		if (!line.length) span.append(' ');
		for (const [text, kind] of line) span.append(kind ? h('span', { class: kind }, text) : text);
		pre.append(span);
	}
	return pre;
}

addEventListener('hashchange', draw);
draw();
