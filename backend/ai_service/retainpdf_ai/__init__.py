"""retainpdf-ai: dịch vụ AI chạy thường trực (hỏi đáp có truy xuất kiểu agentic).

Vị trí kiến trúc: Rust API là nơi ghi duy nhất của tầng dữ liệu (documents/favorites/FTS);
dịch vụ này không giữ trạng thái, gồm vòng lặp suy luận + danh bạ tool, các tool đọc dữ liệu
qua Rust API và đọc trực tiếp sản phẩm trong thư mục tác vụ để lấy nội dung block.
Worker dịch theo lô hoạt động độc lập với dịch vụ này.
"""

__version__ = "0.1.0"
