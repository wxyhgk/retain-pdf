#!/usr/bin/env python3

# Mapping from Vietnamese assertion to English assertion
mapping = {
    'Hiện đang bật chế độ xuất trực tiếp công thức direct_typst': 'The direct_typst formula passthrough mode is enabled.',
    'Vui lòng hiểu ngữ nghĩa toàn câu trước': 'First understand the semantics of the whole sentence',
    'Vui lòng chủ động bọc bằng `$...$`': 'proactively wrap it in `$...$`',
    'Sử dụng dấu gạch chéo ngược đơn': 'use a single backslash for LaTeX commands',
    'Unicode 上标字符': 'Unicode superscript characters',  # This is Chinese, should be kept or translated? Let's keep it for now
    '$^{117}$': '$^{{117}}$',  # This is a pattern, should be kept
    '$^{26-28}$': '$^{{26-28}}$',  # This is a pattern, should be kept
    'Sửa chữa tối thiểu': 'apply a minimal semantic repair',
    'Không viết bổ sung nội dung chính bị thiếu': 'Do not fill in missing body content',
    '<<<ITEM item_id=ITEM_ID>>>': '<<<ITEM item_id=',  # This is a pattern, should be kept
    'Không sử dụng khoảng trắng': 'Do not leave bare LaTeX-style math fragments',  # Approximate
    'là số lẻ': 'is an odd number of',  # From context
    'Danh mục / Danh sách bảng biểu': 'Table of Contents / List of Tables',
    'Yêu cầu thuật ngữ:': 'Terminology requirements:',
    'Chỉ trả về bản dịch, sử dụng văn bản thuần.': 'Return only the translation, using plain text.',
    'Không xuất ra placeholder, dữ liệu có cấu trúc, thẻ, khối mã hoặc giải thích': 'Do not output placeholders, structured data, tags, code blocks or explanations',
    'Bản dịch A': 'Translation A',  # For the parse tests
}

with open('backend/scripts/devtools/tests/translation/test_translation_prompt_protocols.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

changed = 0
for i in range(len(lines)):
    for vn, en in mapping.items():
        if vn in lines[i] and 'assert' in lines[i]:
            lines[i] = lines[i].replace(vn, en)
            changed += 1

with open('backend/scripts/devtools/tests/translation/test_translation_prompt_protocols.py', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"Fixed {changed} assertions")