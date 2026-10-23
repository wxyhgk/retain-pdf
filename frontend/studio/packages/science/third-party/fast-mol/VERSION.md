fast-mol 只读单文件版（`dist/fast-mol-viewer.js`，ESM），构建自 https://github.com/wxyhgk/fast-mol 的提交 8f17919。

换版本：在 fast-mol 里 `git archive <提交> | tar -x` 到一个空目录，`npm ci && npm run build`，把 `dist/fast-mol-viewer.js` 拷到这里（博客的代码从 `packages/science/browser/fast-mol.ts` 导入它，Vite 把它打成单独的一块，第一次画分子时才加载），改上面的提交号，再跑博客的测试。
