from __future__ import annotations

from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from lxml import etree

from backend.scripts.devtools.word_export.math_omml import append_inline_content


VML_NS = "urn:schemas-microsoft-com:vml"
OFFICE_NS = "urn:schemas-microsoft-com:office:office"


def append_absolute_textbox(
    paragraph,
    *,
    shape_id: str,
    text: str,
    x_pt: float,
    y_pt: float,
    width_pt: float,
    height_pt: float,
    font_size_pt: float,
    font_family: str,
    include_shapetype: bool = False,
) -> None:
    pict = OxmlElement("w:pict")
    if include_shapetype:
        pict.append(textbox_shapetype())

    shape = etree.Element(f"{{{VML_NS}}}shape", nsmap={"v": VML_NS, "o": OFFICE_NS})
    shape.set("id", shape_id)
    shape.set("type", "#_x0000_t202")
    shape.set("stroked", "f")
    shape.set("filled", "t")
    shape.set("fillcolor", "#FFFFFF")
    shape.set(
        "style",
        (
            "position:absolute;"
            f"margin-left:{x_pt:.3f}pt;"
            f"margin-top:{y_pt:.3f}pt;"
            f"width:{width_pt:.3f}pt;"
            f"height:{height_pt:.3f}pt;"
            "z-index:251659264;"
            "mso-position-horizontal:absolute;"
            "mso-position-horizontal-relative:page;"
            "mso-position-vertical:absolute;"
            "mso-position-vertical-relative:page;"
        ),
    )

    textbox = etree.Element(f"{{{VML_NS}}}textbox")
    textbox.set("inset", "0,0,0,0")
    textbox.set("style", "mso-fit-shape-to-text:false")
    content = OxmlElement("w:txbxContent")

    for line in str(text or "").splitlines() or [""]:
        p = OxmlElement("w:p")
        p_pr = OxmlElement("w:pPr")
        spacing = OxmlElement("w:spacing")
        spacing.set(qn("w:before"), "0")
        spacing.set(qn("w:after"), "0")
        spacing.set(qn("w:line"), str(int(max(1.0, font_size_pt * 1.1) * 20)))
        spacing.set(qn("w:lineRule"), "exact")
        p_pr.append(spacing)
        p.append(p_pr)

        append_inline_content(p, line, font_size_pt=font_size_pt, font_family=font_family)
        content.append(p)

    textbox.append(content)
    shape.append(textbox)
    pict.append(shape)
    paragraph._p.append(pict)


def textbox_shapetype():
    shapetype = etree.Element(f"{{{VML_NS}}}shapetype", nsmap={"v": VML_NS, "o": OFFICE_NS})
    shapetype.set("id", "_x0000_t202")
    shapetype.set("coordsize", "21600,21600")
    shapetype.set(f"{{{OFFICE_NS}}}spt", "202")
    shapetype.set("path", "m,l,21600r21600,l21600,xe")

    stroke = etree.Element(f"{{{VML_NS}}}stroke")
    stroke.set("joinstyle", "miter")
    shapetype.append(stroke)

    path = etree.Element(f"{{{VML_NS}}}path")
    path.set("gradientshapeok", "t")
    path.set(f"{{{OFFICE_NS}}}connecttype", "rect")
    shapetype.append(path)
    return shapetype
