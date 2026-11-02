---
title: "计算输入和输出文件演示"
description: "Gaussian、ORCA、VASP、CP2K 的输入和输出在博客上的显示：着色、标题栏、引用文件、折叠。"
pubDate: "2026-10-16"
tags: ["Gaussian", "ORCA", "VASP", "CP2K"]
draft: true
---

这篇文章演示计算输入和输出文件的几种写法。每一节先说写法，再给效果。

## 输入文件

### Gaussian

写 ```` ```gaussian title="water-opt.gjf" ````。Link0、路由行、标题、电荷和自旋多重度、坐标分别着色。

```gaussian title="water-opt.gjf"
%nprocshared=8
%mem=16GB
%chk=water-opt.chk
#p opt freq b3lyp/6-31g(d) em=gd3bj

Water optimization

0 1
O     0.000000    0.000000    0.117790
H     0.000000    0.755450   -0.471160
H     0.000000   -0.755450   -0.471160

```

没有 `title` 时，标题栏显示程序名，下载的文件名用常用名（这里是 `input.gjf`）：

```gaussian
%chk=ts.chk
#p opt=(ts,calcfc,noeigentest) wb97xd/def2svp scrf=(smd,solvent=water)

Transition state search

0 1
C    -0.3812   0.0021   0.0000
Cl    1.9620  -0.0104   0.0000
F    -2.4410   0.0119   0.0000
H    -0.3112   1.0700   0.0000
H    -0.3112  -0.5330   0.9260
H    -0.3112  -0.5330  -0.9260

```

### ORCA

`%` 块、`end`、`* xyz` 坐标块分别着色：

```orca title="ethanol-sp.inp"
! DLPNO-CCSD(T) def2-TZVP def2-TZVP/C TightSCF
%maxcore 4000
%pal
  nprocs 8
end
%scf
  MaxIter 300
  DIISMaxEq 15
end
# 乙醇单点
* xyz 0 1
C   -0.9289   0.0447   0.0000
C    0.5203  -0.4021   0.0000
O    1.3501   0.7472   0.0000
H   -1.4555  -0.3463   0.8800
H   -1.4555  -0.3463  -0.8800
H   -1.0175   1.1340   0.0000
H    0.7404  -1.0170   0.8840
H    0.7404  -1.0170  -0.8840
H    2.2687   0.4432   0.0000
*
```

### VASP

INCAR、POSCAR、KPOINTS 各有一种代码块：

```incar title="INCAR"
SYSTEM = Si bulk
ENCUT  = 520        # 截断能，eV
PREC   = Accurate
ISMEAR = 0 ; SIGMA = 0.05
EDIFF  = 1E-6
IBRION = 2 ; ISIF = 3 ; NSW = 50
LWAVE  = .FALSE.
LCHARG = .TRUE.
MAGMOM = 2*0.0
```

```poscar title="POSCAR"
Si diamond
   5.430
     0.0    0.5    0.5
     0.5    0.0    0.5
     0.5    0.5    0.0
   Si
    2
Selective dynamics
Direct
  0.00  0.00  0.00   T T T
  0.25  0.25  0.25   F F F
```

```kpoints title="KPOINTS"
Automatic mesh
0
Gamma
  8 8 8
  0 0 0
```

### CP2K

段落 `&SECTION … &END`、变量 `${…}`、单位 `[…]` 分别着色：

```cp2k title="water-md.inp"
@SET SYSTEM water
&GLOBAL
  PROJECT ${SYSTEM}
  RUN_TYPE MD
  PRINT_LEVEL LOW
&END GLOBAL
&MOTION
  &MD
    ENSEMBLE NVT
    STEPS 10000
    TIMESTEP [fs] 0.5
    TEMPERATURE [K] 300
  &END MD
&END MOTION
&FORCE_EVAL
  METHOD Quickstep
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
    &XC
      &XC_FUNCTIONAL PBE
      &END XC_FUNCTIONAL
    &END XC
  &END DFT
&END FORCE_EVAL
```

## 输出文件

### 引用文章里的文件

代码块里只写一行 `@file ./assets/water-opt.log`，构建时读入这个文件。左边是原文件的行号；文件超过 400 行，只显示前 200 行和后 100 行，中间有一行说明省略了哪些行。超过 30 行先折叠，点下面的「展开」看全部。「下载」拿到的是完整的文件。

```output
@file ./assets/water-opt.log
```

### 只显示几行

写 ```` ```output lines=505-533 ````，只显示这几行，行号还是原文件的行号。`SCF Done` 这类能量行和 `Normal termination` 会突出显示：

```output lines=505-533
@file ./assets/water-opt.log
```

### 按内容截取

行号一重算就会变，按内容找更稳。`match` 只留下含这些文字的行（`|` 分隔几个，照原样找，不是正则），`context=1` 再带上前后各一行；`mark` 让某些行突出显示：

```output match="SCF Done|Normal termination" mark="Normal termination"
@file ./assets/water-opt.log
```

`from` … `to` 取出两行之间的整段，`last` 只要最后一段，比如优化收敛后的最后一个几何：

```output from="Input orientation" to="Cycle   1" last
@file ./assets/water-opt.log
```

找不到时，代码块里会写「没有找到」，发布前检查也会提醒。

### 出错的输出

报错是红色，警告是黄色。这个文件不到 30 行，不折叠：

```output
@file ./assets/orca-failed.out
```

### 直接粘贴的输出

不引用文件，直接写在代码块里也行：

```output title="OSZICAR"
       N       E                     dE             d eps       ncg     rms          rms(c)
DAV:   1     0.394226112156E+02    0.39423E+02   -0.31392E+03   288   0.379E+02
DAV:   2    -0.120155622361E+02   -0.51438E+02   -0.49839E+02   312   0.109E+02
RMM:   3    -0.108493207753E+02    0.11662E+01   -0.13013E+01   272   0.153E+01    0.102E+01
RMM:   4    -0.108436412006E+02    0.56796E-02   -0.31212E-02   296   0.765E-01    0.287E-01
   1 F= -.10843641E+02 E0= -.10843641E+02  d E =-.108436E+02
```

## 其他语言的代码块

任何语言都可以加 `title`；超过 30 行同样会折叠。这段 Python 有 40 行：

```python title="read_energies.py"
"""从 Gaussian 输出里读出每一步优化的 SCF 能量。"""

import re
import sys
from pathlib import Path

SCF = re.compile(r"SCF Done:\s+E\((\w+)\)\s+=\s+(-?\d+\.\d+)")
HARTREE_TO_KCAL = 627.5095


def energies(path: Path) -> list[float]:
    values = []
    for line in path.read_text().splitlines():
        match = SCF.search(line)
        if match:
            values.append(float(match.group(2)))
    return values


def report(values: list[float]) -> None:
    if not values:
        print("没有找到 SCF Done")
        return
    first = values[0]
    for step, value in enumerate(values, 1):
        relative = (value - first) * HARTREE_TO_KCAL
        print(f"{step:3d}  {value:16.9f}  {relative:8.3f} kcal/mol")


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("用法: read_energies.py water-opt.log")
    report(energies(Path(sys.argv[1])))


if __name__ == "__main__":
    main()


# 结束
```

写 `open` 不折叠：

```python title="read_energies.py" open
"""同一段代码，写了 open，全部展开。"""

import re
import sys
from pathlib import Path

SCF = re.compile(r"SCF Done:\s+E\((\w+)\)\s+=\s+(-?\d+\.\d+)")
HARTREE_TO_KCAL = 627.5095


def energies(path: Path) -> list[float]:
    values = []
    for line in path.read_text().splitlines():
        match = SCF.search(line)
        if match:
            values.append(float(match.group(2)))
    return values


def report(values: list[float]) -> None:
    if not values:
        print("没有找到 SCF Done")
        return
    first = values[0]
    for step, value in enumerate(values, 1):
        relative = (value - first) * HARTREE_TO_KCAL
        print(f"{step:3d}  {value:16.9f}  {relative:8.3f} kcal/mol")


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("用法: read_energies.py water-opt.log")
    report(energies(Path(sys.argv[1])))


if __name__ == "__main__":
    main()


# 结束
```

写 `fold`，短的也折叠：

```incar title="INCAR.relax" fold
ENCUT = 520
ISMEAR = 0
SIGMA = 0.05
EDIFF = 1E-6
EDIFFG = -0.01
IBRION = 2
ISIF = 3
NSW = 100
POTIM = 0.5
LREAL = Auto
NCORE = 4
KPAR = 2
LWAVE = .FALSE.
LCHARG = .FALSE.
ISYM = 0
NELM = 120
ALGO = Fast
LASPH = .TRUE.
GGA = PE
```
