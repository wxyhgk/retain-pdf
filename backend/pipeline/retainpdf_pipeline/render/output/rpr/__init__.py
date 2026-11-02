"""rpr 排版引擎（retain-pdf-rendering）的公用部分：找到并调用引擎 CLI（engine_cli）、把排版 markdown 转成
引擎文本（text）。render.engine = "rpr_fit" 的路线在 output/rpr_fit/；以前这里还有 render.engine = "rpr"
（字号用 retain-pdf 的规则）的整条路线，2026-11-02 删了。
"""
