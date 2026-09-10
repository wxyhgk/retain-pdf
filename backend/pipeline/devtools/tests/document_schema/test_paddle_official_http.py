from __future__ import annotations

import json
import sys
import tomllib
from pathlib import Path
from types import SimpleNamespace

import pytest


REPO_ROOT = Path(__file__).resolve().parents[5]
REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.ocr.ocr_provider import paddle_api
from retainpdf_pipeline.ocr.ocr_provider.paddle_runner import PADDLE_TRANSPORT_OFFICIAL_HTTP
from retainpdf_pipeline.ocr.ocr_provider.paddle_runner import PADDLE_TRANSPORT_OFFICIAL_CLI
from retainpdf_pipeline.ocr.ocr_provider.paddle_runner import resolve_paddle_transport


class _JsonlResponse:
    def __init__(self, records: list[dict]) -> None:
        self.text = "\n".join(json.dumps(record) for record in records)


class _EnvelopeResponse:
    def json(self) -> dict:
        return {"errorCode": 0, "logId": "trace-1", "data": {"jobId": "job-1"}}


def test_official_http_submits_page_ranges_for_url_and_file(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests: list[tuple[tuple, dict]] = []

    def capture_request(*args, **kwargs):
        requests.append((args, kwargs))
        return _EnvelopeResponse()

    monkeypatch.setattr(paddle_api, "_request_with_retry", capture_request)
    source = tmp_path / "paper.pdf"
    source.write_bytes(b"%PDF-1.4\n")

    assert paddle_api.submit_local_file(
        token="token",
        file_path=source,
        model="PaddleOCR-VL-1.6",
        optional_payload={"mergeLayoutBlocks": False},
        page_ranges=" 2,4-6 ",
    ) == ("job-1", "trace-1")
    assert paddle_api.submit_remote_url(
        token="token",
        source_url="https://example.test/paper.pdf",
        model="PaddleOCR-VL-1.6",
        optional_payload={"mergeLayoutBlocks": False},
        page_ranges=" 2,4-6 ",
    ) == ("job-1", "trace-1")

    assert requests[0][1]["data"]["pageRanges"] == "2,4-6"
    assert requests[0][1]["files"]["file"] == ("paper.pdf", b"%PDF-1.4\n")
    assert requests[1][1]["json"]["pageRanges"] == "2,4-6"
    assert requests[1][1]["json"]["optionalPayload"] == {
        "mergeLayoutBlocks": False
    }


def test_official_http_jsonl_preserves_complete_raw_pages(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    raw_page = {
        "prunedResult": {
            "parsing_res_list": [
                {
                    "block_label": "text",
                    "block_content": "complete geometry",
                    "block_bbox": [10, 20, 110, 70],
                }
            ]
        },
        "markdown": {
            "text": "complete geometry",
            "images": {"imgs/figure.png": "https://example.test/figure.png"},
        },
        "outputImages": {"layout.png": "https://example.test/layout.png"},
        "inputImage": "https://example.test/input.png",
        "exports": {"docx": "https://example.test/result.docx"},
        "futureProviderField": {"must": "survive"},
    }
    response = _JsonlResponse(
        [
            {
                "result": {
                    "layoutParsingResults": [raw_page],
                    "dataInfo": {
                        "numPages": 2,
                        "sourceType": "pdf",
                        "pages": [{"width": 1000, "height": 1400}],
                    },
                    "futureResultField": {"chunk": 1},
                }
            },
            {
                "logId": "trace-page-2",
                "result": {
                    "layoutParsingResults": [
                        {
                            "prunedResult": {"parsing_res_list": []},
                            "markdown": {"text": "page two", "images": {}},
                        }
                    ],
                    "dataInfo": {
                        "numPages": 2,
                        "pages": [{"width": 1000, "height": 1500}],
                        "futureDataInfoField": "preserved",
                    },
                }
            },
        ]
    )
    monkeypatch.setattr(paddle_api, "_request_with_retry", lambda *_args, **_kwargs: response)

    payload = paddle_api.download_jsonl_result(
        jsonl_url="https://example.test/result.jsonl"
    )

    assert payload["layoutParsingResults"][0] == raw_page
    assert payload["layoutParsingResults"][0]["futureProviderField"] == {
        "must": "survive"
    }
    assert payload["layoutParsingResults"][1]["markdown"]["text"] == "page two"
    assert payload["dataInfo"] == {
        "numPages": 2,
        "sourceType": "pdf",
        "pages": [
            {"width": 1000, "height": 1400},
            {"width": 1000, "height": 1500},
        ],
        "futureDataInfoField": "preserved",
    }
    assert payload["providerResultExtras"] == [
        {"futureResultField": {"chunk": 1}},
        {},
    ]
    assert payload["providerEnvelopeExtras"] == [{}, {"logId": "trace-page-2"}]
    assert payload["providerDataInfoRecords"] == [
        {
            "numPages": 2,
            "sourceType": "pdf",
            "pages": [{"width": 1000, "height": 1400}],
        },
        {
            "numPages": 2,
            "pages": [{"width": 1000, "height": 1500}],
            "futureDataInfoField": "preserved",
        },
    ]
    assert payload["_meta"] == {
        "source": "paddle_jsonl",
        "lineCount": 2,
        "layoutPageCount": 2,
        "dataInfoLineCount": 2,
        "dataInfoPageCount": 2,
        "dataInfoComplete": True,
        "dataInfoConflictKeys": [],
    }


def test_official_http_jsonl_does_not_duplicate_complete_data_info_snapshots(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    complete = {
        "numPages": 2,
        "pages": [{"width": 10, "height": 20}, {"width": 10, "height": 30}],
    }
    response = _JsonlResponse(
        [
            {"result": {"layoutParsingResults": [{}], "dataInfo": complete}},
            {"result": {"layoutParsingResults": [{}], "dataInfo": complete}},
        ]
    )
    monkeypatch.setattr(paddle_api, "_request_with_retry", lambda *_args, **_kwargs: response)

    payload = paddle_api.download_jsonl_result(jsonl_url="https://example.test/result.jsonl")

    assert payload["dataInfo"]["pages"] == complete["pages"]
    assert payload["_meta"]["dataInfoPageCount"] == 2
    assert payload["_meta"]["dataInfoComplete"] is True


@pytest.mark.parametrize(
    ("records", "expected_pages"),
    [
        (
            [
                {"layouts": [{}], "pages": [{"page": 1}]},
                {"layouts": [{}], "pages": [{"page": 2}]},
            ],
            [{"page": 1}, {"page": 2}],
        ),
        (
            [
                {"layouts": [{}], "pages": [{"page": 1}]},
                {"layouts": [{}], "pages": [{"page": 1}, {"page": 2}]},
            ],
            [{"page": 1}, {"page": 2}],
        ),
        (
            [
                {"layouts": [{}], "pages": [{"page": 1}, {"page": 2}]},
                {"layouts": [{}], "pages": [{"page": 1}, {"page": 2}]},
            ],
            [{"page": 1}, {"page": 2}],
        ),
    ],
    ids=("chunk-local", "cumulative", "repeated-full"),
)
def test_official_http_jsonl_merges_pages_without_num_pages(
    records: list[dict],
    expected_pages: list[dict],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    response = _JsonlResponse(
        [
            {
                "result": {
                    "layoutParsingResults": record["layouts"],
                    "dataInfo": {"pages": record["pages"]},
                }
            }
            for record in records
        ]
    )
    monkeypatch.setattr(paddle_api, "_request_with_retry", lambda *_args, **_kwargs: response)

    payload = paddle_api.download_jsonl_result(jsonl_url="https://example.test/result.jsonl")

    assert payload["dataInfo"]["pages"] == expected_pages
    assert payload["dataInfo"]["numPages"] == 2
    assert payload["_meta"]["dataInfoComplete"] is True


def test_official_http_jsonl_preserves_conflicting_data_info_records(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    response = _JsonlResponse(
        [
            {
                "result": {
                    "layoutParsingResults": [{}],
                    "dataInfo": {"numPages": 2, "providerMode": "first", "pages": [{"page": 1}]},
                }
            },
            {
                "result": {
                    "layoutParsingResults": [{}, {}],
                    "dataInfo": {
                        "numPages": 3,
                        "providerMode": "second",
                        "pages": [{"page": 2}, {"page": 3}],
                    },
                }
            },
        ]
    )
    monkeypatch.setattr(paddle_api, "_request_with_retry", lambda *_args, **_kwargs: response)

    payload = paddle_api.download_jsonl_result(jsonl_url="https://example.test/result.jsonl")

    assert payload["dataInfo"]["numPages"] == 3
    assert payload["dataInfo"]["pages"] == [{"page": 1}, {"page": 2}, {"page": 3}]
    assert payload["_meta"]["dataInfoConflictKeys"] == ["numPages", "providerMode"]
    assert [record["numPages"] for record in payload["providerDataInfoRecords"]] == [2, 3]


def test_official_http_remains_default_and_cli_is_explicit_opt_in(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("RETAIN_PADDLE_TRANSPORT", raising=False)
    assert (
        resolve_paddle_transport(SimpleNamespace(ocr_provider_options={}))
        == PADDLE_TRANSPORT_OFFICIAL_HTTP
    )
    for alias in ("http", "official", "official-http", "legacy"):
        assert (
            resolve_paddle_transport(
                SimpleNamespace(ocr_provider_options={"transport": alias})
            )
            == PADDLE_TRANSPORT_OFFICIAL_HTTP
        )
    for alias in ("cli", "official-cli", "official_cli"):
        assert (
            resolve_paddle_transport(
                SimpleNamespace(ocr_provider_options={"transport": alias})
            )
            == PADDLE_TRANSPORT_OFFICIAL_CLI
        )
    with pytest.raises(RuntimeError, match="expected official_http or official_cli"):
        resolve_paddle_transport(
            SimpleNamespace(ocr_provider_options={"transport": "official_sdk"})
        )


def test_backend_dependencies_do_not_pull_the_paddleocr_sdk() -> None:
    project = tomllib.loads(
        (REPO_ROOT / "backend" / "pipeline" / "pyproject.toml").read_text(
            encoding="utf-8"
        )
    )["project"]
    declared = list(project.get("dependencies", []))
    for dependencies in dict(project.get("optional-dependencies", {})).values():
        declared.extend(dependencies)

    assert not any(
        dependency.lower().split("[", 1)[0].startswith(("paddleocr", "paddlex"))
        for dependency in declared
    )
