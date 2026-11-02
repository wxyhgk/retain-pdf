# @blog/i18n

Studio 的多语言。代码里写中文原文，交给 `t()`：

```ts
import { t } from '@blog/i18n/index.mjs';

t('保存');
t('已移动到 {path}', { path });
```

- `index.mjs`：`t()`、选语言、登记语言。页面和服务器都用它。
- `page.ts`：页面开头调用一次，按 `<html data-studio-locale>` 定语言，并设 cookie 让服务器知道。
- `server.mjs`：`inRequestLocale(request, answer)`，服务器在请求的语言里处理它。
- `locales/`：别的语言的翻译表（中文是原文，不需要表）。`npm run i18n:strings -- --locale en` 生成或更新 `en.json`，再在 `locales/index.mjs` 里登记。
- `scan.mjs`、`sources.mjs`、`strings.mjs`：找出交给 `t()` 的文字，和还没交给它的中文。
