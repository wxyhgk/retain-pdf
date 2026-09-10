# `app/detail` — 任务详情页

`detail.html` 的入口与页面壳。

```text
app/detail/
├── entry.tsx      # 挂载点：mountShellPage("detail-root", <DetailApp/>)
└── DetailApp.tsx  # 页面壳：编排 job 拉取、markdown 流、下载 toast
```

## 边界

页面**展示组件与命令式逻辑都不在这里**，它们属 `job-detail` 功能：

| 内容 | 位置 |
|---|---|
| 五个展示组件（Header / JobSummary / ErrorDiagnostics / Artifacts / Events） | `features/job-detail/ui/page/` |
| overview / markdown / resume / artifacts 的命令式逻辑 | `features/job-detail/domain/page/` |
| 状态详情弹窗（主页共用） | `features/job-detail/{ui,domain}/` |

`DetailApp.tsx` 跨功能引用一律经 `@/features/job-detail/index.js`。

## 历史

这里曾有一个 `external.ts`，作为本页对 `src/js/*` 的唯一出口。
`src/js/` 已在批次 5B 整体删除，该网关随之在 C1 解散——它转出的 13 个符号
全部已在新世界（`features/job-detail/index.js`、`@retainpdf/domain/*`、
`@/platform/utils/*`），逐个直连即可，不需要中间层。

`architecture-boundaries.test.mjs` 有一条断言它不得复活。
