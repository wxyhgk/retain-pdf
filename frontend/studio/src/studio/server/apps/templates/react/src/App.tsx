import { useEffect, useState } from 'react';

/**
 * 一个用 React 写的小程序：Studio 用它自己的开发服务器跑（app.json 的 dev），改了热更新。
 * window.studio 能做什么见技能 studio-mini-apps（类型在 studio.d.ts）。请求自己的文件和接口要以
 * import.meta.env.BASE_URL 开头。要别的 npm 包，在这个文件夹里 npm install。
 */
export function App() {
	const [article, setArticle] = useState('…');
	useEffect(() => {
		window.studio.article().then(
			(shown) => setArticle(`当前文章：${shown.title}`),
			() => setArticle('还没有打开文章'),
		);
	}, []);
	return (
		<main style={{ padding: 16, fontFamily: 'system-ui, sans-serif', color: 'var(--ink)' }}>
			<h1 style={{ margin: '0 0 8px', fontSize: 18 }}>{{name}}</h1>
			<p>{article}</p>
			<button type="button" onClick={() => void window.studio.insert('这是小程序「{{name}}」插进来的一句话。')}>
				插一句话进文章
			</button>
		</main>
	);
}
