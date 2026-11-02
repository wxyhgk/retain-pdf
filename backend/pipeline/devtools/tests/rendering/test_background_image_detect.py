from __future__ import annotations


import fitz


from retainpdf_pipeline.render.source.background.detect import page_has_large_background_image
from retainpdf_pipeline.render.source.background.detect import page_has_tiled_background_images
from retainpdf_pipeline.render.source.background.detect import pick_primary_background_image


def test_tiled_background_images_are_detected(tmp_path) -> None:
    image_path = tmp_path / "band.png"
    pix = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 20, 20), False)
    pix.clear_with(230)
    pix.save(image_path)

    doc = fitz.open()
    page = doc.new_page(width=200, height=300)
    for top in range(0, 300, 25):
        page.insert_image(fitz.Rect(0, top, 200, min(top + 25, 300)), filename=image_path)

    assert page_has_tiled_background_images(page)
    assert page_has_large_background_image(page)


def test_sparse_images_are_not_treated_as_tiled_background(tmp_path) -> None:
    image_path = tmp_path / "figure.png"
    pix = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 20, 20), False)
    pix.clear_with(230)
    pix.save(image_path)

    doc = fitz.open()
    page = doc.new_page(width=200, height=300)
    page.insert_image(fitz.Rect(20, 20, 120, 100), filename=image_path)
    page.insert_image(fitz.Rect(80, 160, 180, 240), filename=image_path)

    assert not page_has_tiled_background_images(page)
    assert not page_has_large_background_image(page)


def test_primary_background_image_falls_back_to_image_rects_when_info_xref_is_zero() -> None:
    # 一页两张图（快路走不了），带编号的位置给不出编号：按编号逐张找位置兜底。
    class FakePage:
        rect = fitz.Rect(0, 0, 200, 300)

        def get_image_info(self, *, hashes: bool = False, xrefs: bool = False) -> list[dict]:
            assert hashes is False
            return [{"xref": 0, "bbox": (0, 0, 200, 300)}, {"xref": 0, "bbox": (10, 10, 40, 40)}]

        def get_images(self, full: bool = False) -> list[tuple]:
            assert full is True
            return [(42, 0, 200, 300, 8, "DeviceRGB", "", "Im0", "DCTDecode", 0), (43, 0, 30, 30, 8, "DeviceRGB", "", "Im1", "DCTDecode", 0)]

        def get_image_rects(self, xref: int) -> list[fitz.Rect]:
            return {42: [fitz.Rect(0, 0, 200, 300)], 43: [fitz.Rect(10, 10, 40, 40)]}[xref]

    page = FakePage()

    assert page_has_large_background_image(page) is True
    assert pick_primary_background_image(page) == (42, fitz.Rect(0, 0, 200, 300))


def _image(tmp_path, name: str = "scan.png"):
    path = tmp_path / name
    pix = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 40, 60), False)
    pix.clear_with(200)
    pix.save(path)
    return path


def _xref_lookups(monkeypatch) -> list[bool]:
    calls: list[bool] = []
    original = fitz.Page.get_image_info

    def recorded(self, *args, **kwargs):
        calls.append(bool(kwargs.get("xrefs")))
        return original(self, *args, **kwargs)

    monkeypatch.setattr(fitz.Page, "get_image_info", recorded)
    return calls


def test_a_scanned_page_finds_its_image_without_decoding_it(tmp_path, monkeypatch) -> None:
    # 扫描件：一页一张整页的图。编号直接用 get_images 的，不去要带编号的位置（那要把图解码再算哈希，扫描件一页
    # 0.34 秒，481 页的书页面分析 35 秒，2026-11-02）。
    doc = fitz.open()
    page = doc.new_page(width=200, height=300)
    page.insert_image(fitz.Rect(0, 0, 200, 300), filename=_image(tmp_path))
    calls = _xref_lookups(monkeypatch)

    xref, rect = pick_primary_background_image(page)

    assert xref == page.get_images(full=True)[0][0]
    assert rect == fitz.Rect(0, 0, 200, 300)
    assert True not in calls


def test_a_page_of_several_images_still_names_the_large_one(tmp_path, monkeypatch) -> None:
    doc = fitz.open()
    page = doc.new_page(width=200, height=300)
    page.insert_image(fitz.Rect(0, 0, 200, 300), filename=_image(tmp_path, "large.png"))
    small = _image(tmp_path, "small.png")
    pix = fitz.Pixmap(small)
    pix.clear_with(20)
    pix.save(small)
    page.insert_image(fitz.Rect(10, 10, 60, 60), filename=small)
    calls = _xref_lookups(monkeypatch)

    xref, rect = pick_primary_background_image(page)

    large = next(info for info in page.get_image_info(hashes=False, xrefs=True) if fitz.Rect(info["bbox"]) == fitz.Rect(0, 0, 200, 300))
    assert (xref, rect) == (large["xref"], fitz.Rect(0, 0, 200, 300))
    assert calls[:2] == [False, True], "several images: only then asked with their numbers"


def test_a_page_without_a_large_image_never_asks_for_numbers(tmp_path, monkeypatch) -> None:
    doc = fitz.open()
    page = doc.new_page(width=200, height=300)
    page.insert_image(fitz.Rect(20, 20, 120, 100), filename=_image(tmp_path))
    calls = _xref_lookups(monkeypatch)

    assert pick_primary_background_image(page) is None
    assert True not in calls
