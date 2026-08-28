# Quy ước thư mục LLM

Thư mục hiện tại được chia theo "triển khai dành riêng cho provider" và "logic chung giữa các provider".

## Đọc trước đối với người mới

- Muốn xem yêu cầu API provider và mô hình mặc định:
  `providers/deepseek/client.py`
- Muốn xem điểm vào runtime thống nhất của "provider đang kích hoạt":
  `shared/provider_runtime.py`
- Muốn xem registry/capability của provider:
  `shared/provider_registry.py`
- Muốn xem triển khai dịch phía provider:
  `providers/deepseek/translation_client.py`
- Muốn xem ngữ cảnh điều khiển dịch, thuật ngữ và điểm vào ghép gợi ý:
  `shared/control_context.py`
- Muốn xem xây dựng prompt/message dịch:
  `shared/prompt_building.py`
- Muốn xem điều phối dịch chính và retry batch:
  `shared/orchestration/retrying_translator.py`
- Muốn xem degrade plain-text, chiến lược ổn định placeholder:
  `shared/orchestration/single_item_flow.py`
- Muốn xem wrapper định tuyến direct-typst/heavy-formula/tagged-placeholder đơn:
  `shared/orchestration/single_item_routes.py`
- Muốn xem facade fallback:
  `shared/orchestration/fallbacks.py`
- Muốn xem bản đồ trách nhiệm đầy đủ của thư mục điều phối:
  `shared/orchestration/README.md`
- Muốn xem chia cửa sổ công thức, định tuyến segment:
  `shared/orchestration/segment_routing.py`
- Muốn xem kiểm tra placeholder và lý do degrade:
  `placeholder_guard.py`

## Bản đồ thư mục

- `providers/`
  Chỉ chứa API adapter dành riêng cho provider, xử lý yêu cầu/phản hồi, giá trị mặc định của provider.
  Không nên chứa điều phối retry giữa các provider, quy tắc phân tích cấu trúc chung, workflow cấp trang, quyết định policy, trạng thái memory và render/lưu trữ.
- `shared/`
  Chỉ chứa các khả năng dùng chung giữa các provider, ví dụ ngữ cảnh điều khiển, cache, schema có cấu trúc và parser.
- `shared/prompt_building.py`
  Chứa logic xây dựng prompt/message dùng chung giữa các provider, không còn nhét vào tệp transport của provider.
- `shared/provider_runtime.py`
  Là giao diện adapter ổn định để lớp shared truy cập provider đang kích hoạt.
- `shared/provider_registry.py`
  Chứa định nghĩa runtime của provider, family/default model/base url của provider và lắp ráp khả năng transport/dịch.
- `shared/provider_protocol.py`
  Chứa kiểu giao thức và mô tả capability của runtime provider. Khi provider thêm khả năng mới, trước tiên mở rộng ở đây, sau đó để registry lắp ráp.
- `shared/orchestration/`
  Chỉ chứa điều phối dịch, fallback, segment routing dùng chung giữa các provider.
  Ở đây nên ưu tiên phụ thuộc vào `shared/provider_runtime.py`, không import trực tiếp `providers/deepseek/*`.
  Giải thích chi tiết hơn về ranh giới module trong thư mục xem tại `shared/orchestration/README.md`.
- Thư mục cấp cao nhất `llm/`
  Hiện chỉ giữ lại điểm vào tổng hợp ổn định và một số module chung cấp cao.
  Mã mới nên ưu tiên phụ thuộc trực tiếp vào triển khai thực tế trong `providers/` hoặc `shared/`.

## Thư mục

- `providers/deepseek/`
  Chứa API adapter, giá trị mặc định, xử lý yêu cầu/phản hồi dành riêng cho DeepSeek
- `shared/`
  Chứa cache, ngữ cảnh điều khiển, schema có cấu trúc và parser dùng chung giữa các provider
- `shared/prompt_building.py`
  Chứa prompt và message builder
- `shared/provider_runtime.py`
  Chứa lớp adapter runtime từ shared đến provider đang kích hoạt
- `shared/provider_registry.py`
  Chứa registry của provider đang kích hoạt và runtime capability
- `shared/orchestration/`
  Chứa điều phối dịch, fallback, định tuyến phân đoạn công thức dùng chung giữa các provider
- Thư mục cấp cao nhất `llm/`
  Giữ lại điểm vào tổng hợp ổn định và một số logic chung cấp cao

## Phân tầng hiện tại

- Dành riêng cho provider
  - `providers/deepseek/client.py`
  - `providers/deepseek/translation_client.py`
- Lớp chung shared
  - `shared/control_context.py`
  - `shared/cache.py`
  - `shared/prompt_building.py`
  - `shared/provider_registry.py`
  - `shared/provider_runtime.py`
  - `shared/structured_models.py`
  - `shared/structured_output.py`
  - `shared/structured_parsers.py`
- Lớp điều phối shared
  - `shared/orchestration/README.md`
  - `shared/orchestration/retrying_translator.py`
  - `shared/orchestration/single_item_flow.py`
  - `shared/orchestration/single_item_deps.py`
  - `shared/orchestration/single_item_routes.py`
  - `shared/orchestration/fallbacks.py`
  - `shared/orchestration/segment_request.py`
  - `shared/orchestration/segment_windows.py`
  - `shared/orchestration/segment_executor.py`
  - `shared/orchestration/segment_failures.py`
  - `shared/orchestration/batched_plain.py`
  - `shared/orchestration/direct_typst.py`
  - `shared/orchestration/direct_typst_long_text.py`
  - `shared/orchestration/direct_typst_salvage.py`
  - `shared/orchestration/heavy_formula.py`
  - `shared/orchestration/plain_text_validation.py`
  - `shared/orchestration/sentence_level.py`
  - `shared/orchestration/transport.py`
  - `shared/orchestration/keep_origin.py`
  - `shared/orchestration/metadata.py`
  - `shared/orchestration/common.py`
  - `shared/orchestration/segment_routing.py`
- Logic chung
  - `placeholder_guard.py`
  - `domain_context.py`

## Điểm vào ổn định và tương thích

- Điểm vào tổng hợp ổn định
  - `llm/__init__.py`
  - `providers/deepseek/__init__.py`
  - `shared/__init__.py`
  - `shared/orchestration/__init__.py`

## Phân tầng runtime Provider

- `providers/<provider>/`
  Chỉ quan tâm đến transport dành riêng cho provider, giá trị mặc định và chi tiết dịch của chính provider
- `shared/provider_registry.py`
  Lắp ráp khả năng dành riêng của provider thành `TranslationProviderRuntimeProtocol`
- `shared/provider_runtime.py`
  Để lộ bí danh ổn định của "provider đang kích hoạt hiện tại" cho lớp nghiệp vụ và lớp orchestration
- Lớp nghiệp vụ
  Mặc định chỉ phụ thuộc vào `shared/provider_runtime.py`, không import trực tiếp `providers/deepseek/*`

## Chuỗi gọi chính

- Chuỗi dịch chính:
  `workflow/translation_workflow.py`
  -> `services.translation.llm.translate_batch`
  -> `shared/orchestration/retrying_translator.py`
  -> `shared/orchestration/single_item_flow.py`
  -> `providers/deepseek/translation_client.py`
  -> `providers/deepseek/client.py`
- Chuỗi gợi ý lĩnh vực:
  `domain_context.py`
  -> `shared/control_context.py`
  -> `providers/deepseek/client.py`
- Chuỗi degrade công thức:
  `shared/orchestration/retrying_translator.py`
  -> `shared/orchestration/segment_routing.py`
  -> `shared/orchestration/single_item_flow.py`
  -> `placeholder_guard.py`

## Điểm vào gỡ lỗi

- Ngoại lệ placeholder, degrade keep-origin:
  `placeholder_guard.py`
- Retry batch, degrade đơn item:
  `shared/orchestration/retrying_translator.py`
  `shared/orchestration/single_item_flow.py`
  `shared/orchestration/fallbacks.py`
  `shared/orchestration/README.md`
- Phân tích đầu ra có cấu trúc thất bại:
  `shared/structured_output.py`
  `shared/structured_parsers.py`
- Gỡ lỗi và replay:
  `backend/scripts/devtools/replay_translation_item.py`
  `backend/scripts/devtools/tests/translation/`

## Quy ước sau này

- Khi thêm provider mới, ưu tiên thêm triển khai trong `providers/<provider>/`
- Khi thêm provider mới, đồng thời khai báo khả năng trong `shared/provider_protocol.py`, đăng ký runtime trong `shared/provider_registry.py`
- Khả năng chung ưu tiên đặt trong `shared/`
- Thư mục cấp cao nhất `llm/` chỉ giữ lại điểm vào tổng hợp ổn định và một số module chung cấp cao, không tiếp tục nhét các trường hợp đặc biệt của provider
- Mã nghiệp vụ mặc định truy cập mô hình mặc định, base_url, phân giải api_key và transport chat chung thông qua `shared/provider_runtime.py`
