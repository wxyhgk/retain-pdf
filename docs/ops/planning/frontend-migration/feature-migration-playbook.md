# 单个功能迁入 src/features 的施工手册

配套 [按产品功能重组目录的施工蓝图](./feature-layout-blueprint.md)。
本文是**可重复执行的操作手册**，由 app-update 试点（提交 `04e29ccf`）提炼而来。
每迁移一个功能就完整走一遍本文，不要跳步。

执行位置：`frontend/web/`。

## 0. 前提（已完成，不要重做）

- `src/features/` 目录与 `src/features/app-update/` 参考实现已存在。
- `tests/architecture/architecture-boundaries.test.mjs` 的防回弹扫描根已含
  `src/features`，且已把 `features/*/domain/` 认定为合法的基础设施出口。
- `tests/contracts/event-name-contracts.test.mjs` 的 `SCAN_ROOTS` 已含 `src/features`。

**不要再改这两处门禁的扫描范围**，除非你迁移的功能暴露了新的边界问题。

## 1. 目标形态

```text
src/features/<feature>/
├── ui/         只放 React：组件(.tsx)、hooks、DOM id/class 契约
├── domain/     其余全部：store、状态枚举、规则、HTTP 调用、纯逻辑
└── index.ts    对外唯一出口
```

判定标准非常机械：

> **文件里没有 JSX、也不 import react ⇒ 归 domain/，无论它叫什么名字。**

试点在这里踩过坑：`app-update-store.ts` 名字像视图层，实际零 React，
被门禁抓出来后归入 `domain/`。**先按这条判定，再动手移动。**

`ui/` 可以 import 同功能的 `domain/`；`domain/` **不得** import `ui/`，
不得 import react。若某个常量文件两边都要用（如既有 DOM id 又有状态枚举），
按性质拆成两个文件，分别放 `ui/` 和 `domain/`。

## 2. 操作步骤

### 2.1 盘点

```sh
# 功能的两半在哪
ls src/pages/home/features/<feature>/ src/js/features/<feature>/ 2>/dev/null
# 谁引用它（这份清单决定第 2.4 步要改哪些文件）
grep -rn "<feature>" src tests scripts --include="*.ts" --include="*.tsx" --include="*.mjs" \
  | grep -v "^src/pages/home/features/<feature>/\|^src/js/features/<feature>/"
```

### 2.2 移动

用 `git mv` 保留改名历史，不要用 `cp` + `rm`。
按第 1 节的判定标准分配到 `ui/` 与 `domain/`。
移完后删掉空的原目录。

### 2.3 修内部 import

移动后相对路径会失效。跨目录一律改用 `@/` 别名（`@` 指向 `src/`），
不要写 `../../../` 这类深层相对路径。

功能内部：`ui/` 引用 `domain/` 用 `../domain/x.js`，同目录用 `./x.js`。

**扩展名保持写 `.js`/`.jsx`**（TS bundler 约定 + `jsToTsResolvePlugin` 映射），
不要改成 `.ts`/`.tsx`。

### 2.4 解除对页面的反向依赖

功能**不得** import `src/pages/**` 下的任何东西。常见的三种情况与做法：

1. **组件用 `useHomeServices()` 自取依赖**
   → 改为 props 注入；在 `src/pages/home/HomeApp.tsx` 里加一个小的
   `<Feature>Slot` 组件做绑定（参考 `AppUpdateBannerSlot`）。

2. **从 `composition/types.js` 或 `composition/external.js` 取类型**
   → 若是通用类型（如 `HandlersBag` 这种索引签名），在功能内自定义一份；
   若真值在底层（如 `Store` 来自 `js/app-framework/store.js`），直接从底层取。

3. **装配层的类型比功能自己的弱**（如 `ReadOnlyStore<unknown>`）
   → 修改 `src/pages/home/composition/types-split/*.ts`，改为 import 功能
   导出的类型。依赖方向必须是 app → features，不能反过来。

### 2.5 写 index.ts

导出所有外部调用方需要的符号（用 2.1 的清单核对），并写明 ui/domain 的分工。
**不要**用 `export *` 无差别转出内部符号。

### 2.6 收缩网关

在 `src/pages/home/composition/external/features.ts`（或其他 `external/*.ts`）
里删掉该功能的转发，原调用方改为直接 `from "@/features/<feature>/index.js"`。
在删掉的位置留一行注释说明该功能已迁移。

**不要**新建一个全局 barrel 取代网关——那只是把问题换个位置。

### 2.7 更新测试路径

测试允许直接 import 内部模块（`tests/README.md` 明文例外），
把旧路径改成新路径即可，不要为此改动测试的断言逻辑。

注意还有以路径字符串（而非 import）引用源码的测试，例如
`tests/contracts/event-name-contracts.test.mjs` 用 `join(ROOT, "...")` 定位文件。
用 `grep -rn "<feature>" tests/` 一并找出来。

## 3. 验收（每一步都必须做）

```sh
cd frontend/web
npx tsc --noEmit -p tsconfig.json      # 必须零错误
npm test                                # 必须 0 失败
```

再从仓库根执行：

```sh
cd frontend/desktop && npm test && npm run smoke:frontend-bundle
cd .. && git diff --check
```

### 3.1 门禁反证（不可省略）

测试全绿不等于门禁有效。迁移完成后，向新功能的 `ui/` 里临时插入一行：

```ts
import { $ } from "@/js/dom/query.js"; void $;
```

重跑 `tests/architecture/architecture-boundaries.test.mjs`，**必须**看到它报错
并指名该文件；然后移除这行，确认恢复绿灯。

若插入后测试仍然通过，说明门禁没覆盖到新路径，这是比测试失败更严重的问题，
必须先修门禁再继续。

## 4. 硬性约束

- **不要 `git commit`**，也不要 `git push`。改动留在工作区，由人工审阅后提交。
- 不要改动 `frontend/packages/**`（reader 等 workspace 包）。
- 不要改 `tsconfig.json`、`components.json`、esbuild 配置——本阶段用不到。
- 不要改动 `src/js/` 里不属于本功能的任何文件。
- 不要顺手"优化"业务逻辑。本次只搬位置与解耦，**行为必须逐字节不变**。
  唯一允许的删除是：确认零引用的死导出（用 grep 全仓核实后再删）。
- 不要重建构建产物（`dist/`），由人工统一重建。

## 5. 交付

完成后用一段话报告：

1. 文件如何分配到 ui/ 与 domain/，有没有需要拆分的常量文件；
2. 解除了哪些对页面的反向依赖，用的是 2.4 里的哪种做法；
3. 网关删了几条转发，改了哪些调用方；
4. 改了哪些测试路径；
5. 验收结果：typecheck、测试通过数、门禁反证是否按预期报错；
6. 有没有遇到手册没覆盖的情况（这部分最重要，会用来修订本手册）。
