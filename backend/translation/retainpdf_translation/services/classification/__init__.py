"""块分类：纯规则的判断（`rule_engine`）在底座；调模型的可疑块分类（`page_classifier`）属于普通翻译引擎，
由引擎通过 `TranslationPolicyConfig.page_classifier` 传给页面策略（2026-11-20 拆包：以前这里转发 page_classifier 的三个函数，没人用）。"""
