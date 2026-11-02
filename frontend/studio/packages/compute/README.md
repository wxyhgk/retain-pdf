# @blog/compute

笔记里的计算：一个 ```` ```job ```` 块就是一个 xtb 或 CREST 计算，页面上只是一张两行的卡片，双击打开详情窗口：结果、设置、输出、历史。在窗口里点「运行」（⌘↩），每次运行都留在文章里。博客和 Studio 都用这一份。

````markdown
```job id=water-opt program=xtb args="--opt tight --alpb water" host=local title="水的结构优化" run=20261019-153012
3
water
O   0.000000   0.000000   0.117300
H   0.000000   0.757200  -0.469200
H   0.000000  -0.757200  -0.469200
```
````

块里写起始结构（XYZ，或 `@file ./assets/分子.xyz`）。不开脚本时它就是一段 XYZ。每次运行放在 `assets/jobs/<id>/<run>/`，里面有：

- `run.json`：运行了什么、在哪台机器、状态和用时；
- 输入文件；
- 程序写出的结果，不包括 `xtbrestart` 这类中间文件。

`run=` 是文章显示的那一次；其它运行也都留着，可以切回去。

| 文件 | 内容 |
|---|---|
| `job-fence.mjs` | 块的写法：`parseJobFence`、`jobFenceMeta`、运行放在哪（`runFolder`）、运行的状态 |
| `job-options.mjs` | 命令行的拆分和拼接；xtb 和建在它上面的程序（CREST）共有的电荷、未成对电子、溶剂，读写命令行和表单字段（`XTB_COMMON_FIELDS`）。各程序自己的任务、方法等在它的插件里 |
| `parsers/xtb.ts` | `xtb.out`（能量、自由能、能隙、偶极、优化的每一步、虚频、出错原因）、`vibspectrum`、`g98.out`（振动模式） |
| `parsers/crest.ts` | `crest.out`，以及构象的相对能量和玻尔兹曼占比 |
| `parsers/xyz-frames.ts` | 多帧 XYZ（`xtbopt.log`、`crest_conformers.xyz`） |
| `parsers/qc/` | Gaussian、ORCA 的输出读成同一种数据（`QcOutput`）：能量、优化过程、结构、振动和红外、热力学、前线轨道、激发态、出错原因。测试用的真实输出和每个的答案在 `test/fixtures/qc/`；怎么修、怎么加见 `parsers/qc/README.md` |
| `browser/job-card.ts` | 页面上的卡片：名字、状态，加上一行关键数字（或运行进度、出错原因），旁边一张不用 WebGL 的小结构图 |
| `browser/job-view.ts` | 详情窗口（`@blog/ui` 的 `openBlockSheet`）里的内容：`drawRun` / `summarizeRun` 交给程序的 `ProgramView`；给程序用的零件：数值、优化曲线、红外光谱（点一下看振动）、构象表、结构；输出；小结构图 `structureThumbnail` |
| `programs.mjs` | 计算程序接缝 `ctx.jobs`（`JobPrograms`）和程序的类型（`programs.d.mts`）。程序本身是插件：`plugins/xtb`、`plugins/crest` |

这里只是库。把它接进博客和 Studio 的是插件 `plugins/job/`（见 `plugins/README.md`），程序是 `plugins/xtb/`、`plugins/crest/`：

- `build.mjs`：构建时把 ```job 变成页面上的 figure，读 `run.json`。
- `page.ts`：博客页面上的卡片和详情窗口，读其余文件。
- `studio.ts` 和 `studio/`：编辑器里的块、斜杠菜单、计算机器窗口。
- `server.mjs` 和 `server/`：Studio 开发服务器上真正去跑计算的部分（`job-runs.mjs` 开始、跟进、停止、取回结果；`compute-hosts.mjs` 管计算机器：本机、SSH、Slurm）。

测试：`node --experimental-strip-types --test packages/compute/test/*.test.ts`（仓库根目录的 `npm test` 会一起跑）。`test/fixtures/` 里是 xtb 6.7.1 和 CREST 3.0.2 的真实输出。
