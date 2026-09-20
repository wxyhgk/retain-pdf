"""翻译 provider 身份判定的唯一真相源。

在此之前,"这个 provider 是不是 deepseek" 被独立实现了三次、口径互不相同:

- artifacts/aggregator.py 的 ``classify_provider_family``:
  ``"api.deepseek.com" in base`` / ``"deepseek" in base or model.startswith("deepseek")``
- workflow/phases/repair.py 的 ``_is_deepseek_provider``:
  ``"deepseek" in model or "deepseek.com" in base``

于是同一次任务里两个模块会对同一个 provider 得出相反结论,例如
``model="my-deepseek-v3"`` 前者判 ``other``(``startswith`` 不匹配)、后者判 deepseek;
``base="https://deepseek-proxy.internal/v1", model="gpt-4o"`` 则反过来。

收敛的做法不是把两者合成一个函数——它们问的本来就是**两个不同的问题**,
强行合并会改变生产行为。这里给这两个问题各自一个不会再被混用的名字:

``is_deepseek_official_endpoint``
    是不是 DeepSeek 官方 API 端点。消费者(引擎档位/前缀缓存预热/自适应并发上限)
    拿它回答的是"这家扛不扛得住高并发、按不按官方前缀缓存计价"。
    自建兼容端点必须判 False,否则会拿官方档位去打一个小端点。

``is_deepseek_family_provider``
    是不是 DeepSeek 系(含自建兼容端点)。消费者(乱码重建选 runtime)
    拿它回答的是"能不能直接复用任务自带的 key/model,而不用回落到我们自己的
    DeepSeek key"。这里必须比 official 宽。

两者故意不等价,且 official ⊆ family(官方端点必然含 ``deepseek.com``)。
新增 provider 判定请加在本模块,不要再在调用点嗅字符串。
"""

from __future__ import annotations


def is_deepseek_official_endpoint(base_url: str) -> bool:
    """base_url 是否指向 DeepSeek 官方 API 端点。"""
    return "api.deepseek.com" in (base_url or "").strip().lower()


def is_deepseek_family_provider(*, model: str, base_url: str) -> bool:
    """provider 是否属于 DeepSeek 系(含自建 deepseek 兼容端点)。

    ``base_url`` 由调用方按 provider 自己的 ``normalize_base_url`` 归一化后传入:
    空 base_url 归一化后会落到官方默认端点,该语义属于 transport 层,本模块不复制。
    """
    if "deepseek" in (model or "").strip().lower():
        return True
    return "deepseek.com" in (base_url or "").strip().lower()


__all__ = [
    "is_deepseek_family_provider",
    "is_deepseek_official_endpoint",
]
