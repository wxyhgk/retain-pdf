# React 迁移:遗留树可达性审计(Phase 0 产出)

审计对象:`src/js/job/`(14 文件)、`src/js/job-status/`(54)、`src/js/status-detail/`(5)。
方法:esbuild metafile 从三个真实入口(app-bundle-entry.js / reader/index.js / job-detail/index.js)求可达集 + 反向 import 图 + DOM API 扫描。

## 结论

| 树 | 活VM | 活视图 | 仅测试引用 | 死代码 | 合计 |
|---|---|---|---|---|---|
| job/ | 14 | 0 | 0 | 0 | 14 |
| job-status/ | 45 | 0 | 3 | 6 | 54 |
| status-detail/ | 5 | 0 | 0 | 0 | 5 |
| **合计** | **64** | **0** | **3** | **6** | **73** |

**三棵树是迁移要原样继承的纯逻辑核心,不是死代码。** 可达文件全部为纯 view-model/adapter,零 DOM 渲染(DOM 视图在 components/、ui/、job-detail/view.js 等处)。

## Phase 4 可删清单(9 文件,自成孤立子图,一起删干净)

**无条件可删(6,零引用或仅被死文件引用):**
- src/js/job-status/stage-presentation-event.js(集群根)
- src/js/job-status/stage-presentation-fallback.js(完全孤立)
- src/js/job-status/stage-presentation-event-context.js
- src/js/job-status/job-stage-progress-strategy.js
- src/js/job-status/stage-progress-selection.js
- src/js/job-status/stage-progress-view-data.js

**仅被 tests/job-stage-contract.test.mjs(第 10-12 行 import)引用(3):**
- src/js/job-status/canonical-stage-snapshot.js
- src/js/job-status/job-stage-event-selection.js
- src/js/job-status/main-lane-stage-selection.js

删这 3 个需同步处理该测试;若保留测试则保留这 3 个文件。

## 备注
- `job/action-model.js`、`job/artifacts.js` 有受守卫的 `window.location.href` 读取(URL 构建,非 DOM 渲染),判活 VM;重度被活代码引用,不在删除范围。
- 外部无任何动态 import() 指向上述 9 文件(已验证)。
