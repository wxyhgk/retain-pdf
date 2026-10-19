# @blog/compute

笔记里的计算：一个 ```` ```job ```` 块就是一个 xtb 或 CREST 计算，在 Studio 里点「运行」，结果画在块下面，每次运行都留在文章里。博客和 Studio 都用这一份。

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
| `job-options.mjs` | 命令行和表单互相转换：任务、方法、电荷、未成对电子、溶剂、优化精度、CREST 能量窗口；表单不认识的参数原样保留 |
| `parsers/xtb.ts` | `xtb.out`（能量、自由能、能隙、偶极、优化的每一步、虚频、出错原因）、`vibspectrum`、`g98.out`（振动模式） |
| `parsers/crest.ts` | `crest.out`，以及构象的相对能量和玻尔兹曼占比 |
| `parsers/xyz-frames.ts` | 多帧 XYZ（`xtbopt.log`、`crest_conformers.xyz`） |
| `browser/job-view.ts` | 把一次运行画出来：状态、数值、优化曲线、红外光谱（点一下看振动）、构象表、输出的末尾 |

真正去跑计算的部分只在 Studio 的开发服务器里：

- `src/studio/server/job-runs.mjs`：开始、跟进、停止、取回结果。
- `src/studio/server/compute-hosts.mjs`：计算机器（本机、SSH、Slurm）。

博客端：

- `packages/markdown/plugins/remark-jobs.mjs` 在构建时读 `run.json`。
- `src/components/Jobs.astro` 在页面上读其余文件。

测试：`node --experimental-strip-types --test packages/compute/test/*.test.ts`（仓库根目录的 `npm test` 会一起跑）。`test/fixtures/` 里是 xtb 6.7.1 和 CREST 3.0.2 的真实输出。
