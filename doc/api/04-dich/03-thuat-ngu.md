# Bảng thuật ngữ

Bảng thuật ngữ có thể được tham chiếu bằng ID tài nguyên hoặc truyền nội tuyến cùng yêu cầu tác vụ.

## Trường tác vụ

```json
{
  "translation": {
    "glossary_id": "glossary-xxx",
    "glossary_name": "chemistry",
    "glossary_entries": [
      {
        "source": "bond",
        "target": "liên kết",
        "note": ""
      }
    ]
  }
}
```

## Giao diện bảng thuật ngữ

```http
POST /api/v1/glossaries/parse-csv
POST /api/v1/glossaries/import
GET /api/v1/glossaries
POST /api/v1/glossaries
GET /api/v1/glossaries/{glossary_id}
PUT /api/v1/glossaries/{glossary_id}
DELETE /api/v1/glossaries/{glossary_id}
GET /api/v1/glossaries/{glossary_id}/export.csv
```

## Nguyên tắc Frontend

- Quản lý tài nguyên bảng thuật ngữ thông qua `/glossaries`.
- Khi tạo tác vụ, ưu tiên truyền `glossary_id`.
- Một số thuật ngữ tạm thời ít có thể truyền cùng tác vụ bằng `glossary_entries`.
- Cường độ tiêm thuật ngữ được kiểm soát bởi `translation.glossary_mode`.
