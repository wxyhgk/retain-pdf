Hướng dẫn này sẽ giới thiệu cách sử dụng API /chat/completions của DeepSeek để thực hiện hội thoại nhiều lượt.

API /chat/completions của DeepSeek là một API 'không trạng thái', tức là server không ghi lại ngữ cảnh của yêu cầu người dùng. Trong mỗi yêu cầu, người dùng cần ghép toàn bộ lịch sử hội thoại trước đó và truyền vào API hội thoại.

Đoạn mã dưới đây bằng Python minh họa cách ghép ngữ cảnh để thực hiện hội thoại nhiều lượt.

from openai import OpenAI
client = OpenAI(api_key="<DeepSeek API Key>", base_url="https://api.deepseek.com")

# Round 1
messages = [{"role": "user", "content": "What's the highest mountain in the world?"}]
response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=messages
)

messages.append(response.choices[0].message)
print(f"Messages Round 1: {messages}")

# Round 2
messages.append({"role": "user", "content": "What is the second?"})
response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=messages
)

messages.append(response.choices[0].message)
print(f"Messages Round 2: {messages}")

Trong yêu cầu đầu tiên, messages gửi đến API là:

[
    {"role": "user", "content": "What's the highest mountain in the world?"}
]

Trong yêu cầu thứ hai:

Cần thêm đầu ra của mô hình từ lượt đầu tiên vào cuối messages
Thêm câu hỏi mới vào cuối messages
Messages cuối cùng gửi đến API là:

[
    {"role": "user", "content": "What's the highest mountain in the world?"},
    {"role": "assistant", "content": "The highest mountain in the world is Mount Everest."},
    {"role": "user", "content": "What is the second?"}
]