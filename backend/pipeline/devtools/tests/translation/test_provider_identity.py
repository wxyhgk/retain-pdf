"""provider 身份判定必须只有一个口径。

历史缺陷:``classify_provider_family`` 与 ``_is_deepseek_provider`` 各自嗅字符串,
对同一个 provider 得出相反结论。这些用例钉住收敛后的口径,并且钉住
"official 与 family 是两个不同的问题、故意不等价"这件事。
"""
import pytest

from retainpdf_pipeline.translate.artifacts import classify_provider_family
from retainpdf_pipeline.translate.core.provider_identity import is_deepseek_family_provider
from retainpdf_pipeline.translate.core.provider_identity import is_deepseek_official_endpoint
from retainpdf_pipeline.translate.workflow.phases.repair import _is_deepseek_provider


# (base_url, model, 期望 family 标签, 期望是否 deepseek 系)
PROVIDER_CASES = [
    # 官方端点
    ("https://api.deepseek.com/v1", "deepseek-chat", "deepseek_official", True),
    ("https://api.deepseek.com", "deepseek-reasoner", "deepseek_official", True),
    # 自建 / 第三方 deepseek 兼容端点:是 deepseek 系,但不是官方端点
    ("https://example.com/v1", "deepseek-r1", "deepseek_compatible", True),
    ("https://openrouter.ai/api/v1", "deepseek/deepseek-chat", "deepseek_compatible", True),
    # 旧 classify 用 startswith,这条会漏判成 other,而 repair 判 True —— 正是矛盾点
    ("https://llm.internal/v1", "my-deepseek-v3", "deepseek_compatible", True),
    # 反方向:旧 classify 只看 base 里有没有 "deepseek" 就判 compatible,
    # 而 repair 要求 "deepseek.com";一个叫 deepseek-proxy 的自建网关跑 gpt-4o 不是 deepseek 系
    ("https://deepseek-proxy.internal/v1", "gpt-4o", "other", False),
    # 非 deepseek
    ("https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen", "other", False),
    ("https://api.openai.com/v1", "gpt-4o", "other", False),
]


@pytest.mark.parametrize("base_url,model,expected_family,expected_is_deepseek", PROVIDER_CASES)
def test_provider_family_label_matches_single_source_of_truth(
    base_url, model, expected_family, expected_is_deepseek
):
    assert classify_provider_family(base_url=base_url, model=model) == expected_family
    assert is_deepseek_family_provider(model=model, base_url=base_url) is expected_is_deepseek


@pytest.mark.parametrize("base_url,model,expected_family,expected_is_deepseek", PROVIDER_CASES)
def test_repair_stage_and_diagnostics_never_disagree_about_deepseek(
    base_url, model, expected_family, expected_is_deepseek
):
    """诊断标签说是 deepseek 系,修复阶段就必须也这么认为,反之亦然。"""
    labelled_as_deepseek = classify_provider_family(base_url=base_url, model=model) != "other"
    assert _is_deepseek_provider(model=model, base_url=base_url) is labelled_as_deepseek
    assert labelled_as_deepseek is expected_is_deepseek


@pytest.mark.parametrize("base_url,model,expected_family,_expected", PROVIDER_CASES)
def test_official_endpoint_is_a_strictly_narrower_question_than_family(
    base_url, model, expected_family, _expected
):
    """official 决定并发/超时档位,family 决定能否复用任务凭据,两者故意不等价。

    但 official 必须是 family 的子集:官方端点一定属于 deepseek 系。
    """
    official = is_deepseek_official_endpoint(base_url)
    assert official is (expected_family == "deepseek_official")
    if official:
        assert is_deepseek_family_provider(model=model, base_url=base_url)


def test_self_hosted_compatible_endpoint_must_not_get_official_concurrency_tier():
    """自建兼容端点判成 official 会拿官方档位去打小端点,这条守住那个边界。"""
    assert not is_deepseek_official_endpoint("https://llm.internal/v1")
    assert is_deepseek_family_provider(model="deepseek-chat", base_url="https://llm.internal/v1")
    assert classify_provider_family(base_url="https://llm.internal/v1", model="deepseek-chat") == (
        "deepseek_compatible"
    )


def test_empty_base_url_stays_out_of_the_official_tier_but_repair_sees_the_default_endpoint():
    """没配 base_url 时,诊断标签不得升成 official(否则会打开官方并发/超时档位),
    而修复阶段归一化后看到的是官方默认端点,判 deepseek 系是对的。"""
    assert classify_provider_family(base_url="", model="") == "other"
    assert _is_deepseek_provider(model="", base_url="") is True
