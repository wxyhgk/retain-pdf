from __future__ import annotations

import io
import sys
from pathlib import Path

import pikepdf
from pikepdf import Name

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from services.rendering.source_cleanup.pdf.xobject_ops import _clone_form_xobject


# Một form xobject chứa `/StampId null` (dạng thực tế của form con dấu nhà xuất bản).
# Chỉ có thể tạo bằng cách đọc văn bản gốc đã chứa giá trị null - API Python của pikepdf không cho phép
# đặt khóa từ điển thành None. Byte gốc cho phép qpdf mở và tái tạo xref.
_PDF_WITH_NULL_FORM_KEY = b"""%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100]
   /Resources << /XObject << /Fm0 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /XObject /Subtype /Form /BBox [0 0 10 10] /StampId null /Length 3 >>
stream
q Q
endstream
endobj
5 0 obj
<< /Length 8 >>
stream
/Fm0 Do
endstream
endobj
trailer
<< /Root 1 0 R >>
%%EOF
"""


def test_clone_form_xobject_skips_null_valued_keys() -> None:
    with pikepdf.open(io.BytesIO(_PDF_WITH_NULL_FORM_KEY)) as pdf:
        form = pdf.pages[0].obj[Name("/Resources")][Name("/XObject")][Name("/Fm0")]
        # Xác nhận văn bản gốc thực sự có một khóa giá trị null (nếu không thì test vô nghĩa)
        assert any(value is None for _key, value in form.items())

        cloned = _clone_form_xobject(pdf, form)

        assert cloned[Name("/Subtype")] == Name("/Form")
        assert list(cloned[Name("/BBox")]) == [0, 0, 10, 10]
        # Khóa null bị loại bỏ không gây lỗi, bản sao không còn ném ValueError
        assert Name("/StampId") not in cloned
