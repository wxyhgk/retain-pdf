Trong nhiều tình huống, người dùng cần mô hình xuất ra đúng định dạng JSON để cấu trúc hóa đầu ra, giúp cho việc phân tích ở các bước sau dễ dàng hơn.

DeepSeek cung cấp tính năng JSON Output để đảm bảo mô hình xuất ra chuỗi JSON hợp lệ.

Lưu ý
Đặt tham số response_format thành {'type': 'json_object'}.
System prompt hoặc user prompt phải chứa từ "json" và đưa ra ví dụ về định dạng JSON mong muốn để hướng dẫn mô hình xuất JSON hợp lệ.
Cần đặt max_tokens hợp lý để tránh chuỗi JSON bị cắt ngang.
Khi sử dụng JSON Output, API có thể trả về content rỗng. Chúng tôi đang tích cực tối ưu vấn đề này, bạn có thể thử sửa prompt để giảm thiểu.
Mã mẫu
Dưới đây là mã Python hoàn chỉnh sử dụng JSON Output:

import json
from openai import OpenAI

client = OpenAI(
    api_key="<your api key>",
    base_url="https://api.deepseek.com",
)

system_prompt = """
The user will provide some exam text. Please parse the "question" and "answer" and output them in JSON format. 

EXAMPLE INPUT: 
Which is the highest mountain in the world? Mount Everest.

EXAMPLE JSON OUTPUT:
{
    "question": "Which is the highest mountain in the world?",
    "answer": "Mount Everest"
}
"""

user_prompt = "Which is the longest river in the world? The Nile River."

messages = [{"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}]

response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=messages,
    response_format={
        'type': 'json_object'
    }
)

print(json.loads(response.choices[0].message.content))


Mô hình sẽ xuất ra:

{
    "question": "Which is the longest river in the world?",
    "answer": "The Nile River"
}