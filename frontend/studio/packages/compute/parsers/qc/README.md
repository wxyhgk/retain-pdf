# 量子化学输出的解析

把 Gaussian 的 `.log`、ORCA 的 `.out` 读成同一种数据（`QcOutput`，见 `qc.mjs` 开头），卡片、详情窗口、博客构建都只认它。纯函数：输入文本，输出数据，不依赖 Studio 和博客，Node 和浏览器里都能用。

| 文件 | 内容 |
|---|---|
| `qc.mjs` | `QcOutput` 的样子和单位；`parseQcOutput(text)`（认出程序再交给它）、`qcProgram(开头)`；规则表 `readRules`；公用的小工具 |
| `gaussian.mjs` | Gaussian 16（`Opt Freq` 这种多个任务的输入，`Link1:` 后面是第二个任务） |
| `orca.mjs` | ORCA 6 |

每个程序的写法一样：

- **规则表 `RULES`**：单个的值，一条一个——正则、取第一个还是最后一个（`take`，默认最后一个）、怎么读（`read`，默认把第一组读成数字）。大部分修改只改这里。
- **读表函数**：成块的东西——结构（`atomsOf`）、振动（`vibrationsOf`）、轨道（`frontierOf`）、激发态。
- 读不到的就是 null（列表是 `[]`），其余的照样读。不要因为一段读不出来就让整个文件失败。

## 遇到读错或读不出来的输出

1. **先放例子**：把输出放进 `packages/compute/test/fixtures/qc/`，名字说明它是什么（`hcn-ts-orca.out`）。输入文件也放一份（`.gjf`、`.inp`）。
   - 仓库是公开的：先把服务器路径、用户名、主机名换掉（Gaussian 的 `#p` 会打印每个 link 的路径，结尾的归档块里有 `GINC-主机名` 和用户名），比如 `/opt/…/g16` → `/apps/g16`、`GINC-XXX` → `GINC-HOST`、`\用户名\` → `\USER\`。
2. **再写答案**：同名的 `<名字>.answer.json`，写它**应该**读出的值（对着输出原文写，不是把现在读出的抄过去）。只写的字段才检查，没写的不管。可以从一个相近例子的答案改起。
3. **改解析**：改规则表或读表函数，直到 `npm run test:unit` 通过——所有旧例子也要还是对的。
4. **对一遍 cclib**（有 Python 时）：`packages/compute/test/qc-cclib-check.py`，用法写在它开头。它用另一个读法核对能量、优化步、坐标、频率、红外强度、热力学量、HOMO/LUMO、激发态；它不读的（方法名、出错原因、ORCA 的 ⟨S²⟩）对着原文看。

## 容易读错的地方

- **取最后一个**：优化过程中结构、能量、轨道会打印很多次，要的是最后的（规则表默认就是最后一个）。优化每一步的能量（`steps`）只取优化那个任务里的。
- **ORCA 的 `FINAL SINGLE POINT ENERGY`**：做 TD-DFT 时它是基态加第一激发态的激发能，所以 `energy` 读 SCF 的 `Total Energy`。
- **ORCA 的「The first frequency considered to be a vibration is N」**：它把虚频排除在外（算热力学用的），不能用来挑振动；振动是频率不为 0.00 的那些。ORCA 的红外表里也没有虚频，所以虚频的强度是 null。
- **Gaussian 的数字会粘在一起**：轨道能量 `-19.22619-19.22611`，用 `-?\d+\.\d+` 一个个找，不要按空格分。
- **单位**：能量全用 Hartree；激发能 eV、波长 nm；频率 cm⁻¹（虚频是负数）；红外强度 km/mol；坐标 Å；偶极 Debye。cclib 内部存 eV，换算常数是旧的（CODATA 2010），对比时用它自己的 `convertor`。
- **方法名**：Gaussian 从结尾归档块读（`FOpt\UB3LYP\def2SVP`），没有归档块（出错结束）时从 `SCF Done: E(RB3LYP)` 读；R、U、RO 拆到 `reference`。ORCA 只把泛函拆成交换和相关两部分打印，所以从输入的 `!` 行读：去掉任务、设置、基组以外剩下的那个词。

## 还没有覆盖的

后 HF 方法（MP2、CCSD(T)：`energy` 现在只是 SCF 的）、`Freq=HPModes` 的高精度简正模式、扫描、IRC、ONIOM、ORCA 5 及更早版本的激发态表、NBO。遇到时按上面的步骤加。
