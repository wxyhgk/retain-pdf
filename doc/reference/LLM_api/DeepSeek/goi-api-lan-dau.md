DeepSeek API sử dụng định dạng API tương thích với OpenAI/Anthropic. Bằng cách sửa đổi cấu hình, bạn có thể sử dụng SDK OpenAI/Anthropic để truy cập DeepSeek API hoặc sử dụng phần mềm tương thích với API OpenAI/Anthropic.

PARAM	VALUE
base_url (OpenAI)	https://api.deepseek.com
base_url (Anthropic)	https://api.deepseek.com/anthropic
api_key	apply for an API key
model*	deepseek-v4-flash
deepseek-v4-pro
deepseek-chat (sẽ bị loại bỏ vào 2026/07/24)
deepseek-reasoner (sẽ bị loại bỏ vào 2026/07/24)
* Hai tên mô hình deepseek-chat và deepseek-reasoner sẽ bị loại bỏ vào 2026/07/24. Vì lý do tương thích, hai mô hình này tương ứng với chế độ không suy nghĩ và suy nghĩ của deepseek-v4-flash.

Gọi API đối thoại
Sau khi tạo API key, bạn có thể sử dụng các script mẫu sau để truy cập mô hình DeepSeek thông qua định dạng OpenAI API. Ví dụ này là đầu ra không streaming, bạn có thể đặt stream thành true để sử dụng chế độ streaming.

Ví dụ truy cập định dạng Anthropic API, vui lòng tham khảo Anthropic API.

curl
python
nodejs
curl https://api.deepseek.com/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" \
  -d '{
        "model": "deepseek-v4-pro",
        "messages": [
          {"role": "system", "content": "You are a helpful assistant."},
          {"role": "user", "content": "Hello!"}
        ],
        "thinking": {"type": "enabled"},
        "reasoning_effort": "high",
        "stream": false
      }'