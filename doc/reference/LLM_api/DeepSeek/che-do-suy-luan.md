Chế độ suy luận
Các mô hình DeepSeek hỗ trợ chế độ suy luận: trước khi đưa ra câu trả lời cuối cùng, mô hình sẽ xuất ra một chuỗi suy nghĩ để nâng cao độ chính xác của câu trả lời cuối cùng.

Công tắc chế độ suy luận và điều khiển cường độ suy luận
Tham số điều khiển (định dạng OpenAI)	Tham số điều khiển (định dạng Anthropic)
Công tắc chế độ suy luận(1)	{"thinking": {"type": "enabled/disabled"}}
Điều khiển cường độ suy luận(2)(3)	{"reasoning_effort": "high/max"}	{"output_config": {"effort": "high/max"}}
(1) Mặc định công tắc suy luận là enabled
(2) Trong chế độ suy luận, đối với các yêu cầu thông thường, effort mặc định là high; đối với một số yêu cầu Agent phức tạp (như Claude Code, OpenCode), effort tự động được đặt thành max
(3) Trong chế độ suy luận, vì lý do tương thích, low, medium sẽ được ánh xạ thành high, xhigh sẽ được ánh xạ thành max

Khi bạn sử dụng OpenAI SDK để thiết lập tham số thinking, bạn cần truyền tham số thinking vào extra_body:

response = client.chat.completions.create(
  model="deepseek-v4-pro",
  # ...
  reasoning_effort="high",
  extra_body={"thinking": {"type": "enabled"}}
)

Tham số đầu vào và đầu ra
Chế độ suy luận không hỗ trợ các tham số temperature, top_p, presence_penalty, frequency_penalty. Lưu ý rằng để tương thích với phần mềm hiện có, việc thiết lập các tham số sẽ không báo lỗi nhưng cũng không có hiệu lực.

Trong chế độ suy luận, nội dung chuỗi suy nghĩ được trả về qua tham số reasoning_content, cùng cấp với content. Trong các lượt tiếp theo, bạn có thể tùy chọn trả lại reasoning_content cho API:

Giữa hai tin nhắn user, nếu mô hình không thực hiện gọi công cụ, thì reasoning_content của assistant ở giữa không cần tham gia vào ngữ cảnh, việc truyền nó vào API trong các lượt tiếp theo sẽ bị bỏ qua. Xem chi tiết tại Ghép nối hội thoại nhiều lượt.
Giữa hai tin nhắn user, nếu mô hình thực hiện gọi công cụ, thì reasoning_content của assistant ở giữa cần tham gia vào ngữ cảnh, và phải được gửi lại cho API trong tất cả các lượt tương tác user tiếp theo. Xem chi tiết tại Gọi công cụ.
Ghép nối hội thoại nhiều lượt
Trong mỗi lượt hội thoại, mô hình sẽ xuất ra nội dung chuỗi suy nghĩ (reasoning_content) và câu trả lời cuối cùng (content). Nếu không có gọi công cụ, thì trong lượt tiếp theo, nội dung chuỗi suy nghĩ của lượt trước sẽ không được ghép vào ngữ cảnh, như hình dưới đây:


Mã mẫu
Đoạn mã dưới đây sử dụng ngôn ngữ Python làm ví dụ, thể hiện cách truy cập chuỗi suy nghĩ và câu trả lời cuối cùng, cũng như cách ghép nối ngữ cảnh trong hội thoại nhiều lượt.

Không stream
Stream
from openai import OpenAI
client = OpenAI(api_key="<DeepSeek API Key>", base_url="https://api.deepseek.com")

# Lượt 1
messages = [{"role": "user", "content": "9.11 and 9.8, which is greater?"}]
response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=messages,
    reasoning_effort="high"
    extra_body={"thinking": {"type": "enabled"}},
)

reasoning_content = response.choices[0].message.reasoning_content
content = response.choices[0].message.content

# Lượt 2
# reasoning_content sẽ bị API bỏ qua
messages.append(response.choices[0].message)
messages.append({'role': 'user', 'content': "How many Rs are there in the word 'strawberry'?"})
response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=messages,
    reasoning_effort="high"
    extra_body={"thinking": {"type": "enabled"}},
)
# ...

Gọi công cụ
Chế độ suy luận của mô hình DeepSeek hỗ trợ chức năng gọi công cụ. Trước khi đưa ra câu trả lời cuối cùng, mô hình có thể thực hiện nhiều vòng suy nghĩ và gọi công cụ để nâng cao chất lượng câu trả lời. Mô hình gọi của nó như hình dưới đây:


Lưu ý rằng, khác với các lượt không gọi công cụ trong chế độ suy luận, các lượt đã gọi công cụ phải truyền đầy đủ reasoning_content cho API trong tất cả các yêu cầu tiếp theo.

Nếu mã của bạn không truyền đúng reasoning_content, API sẽ trả về lỗi 400. Phương pháp truyền đúng vui lòng tham khảo mã mẫu dưới đây.

Mã mẫu
Dưới đây là mã mẫu đơn giản cho việc gọi công cụ trong chế độ suy luận:

import os
import json
from openai import OpenAI
from datetime import datetime

# Định nghĩa các công cụ
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_date",
            "description": "Get the current date",
            "parameters": { "type": "object", "properties": {} },
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get weather of a location, the user should supply the location and date.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": { "type": "string", "description": "The city name" },
                    "date": { "type": "string", "description": "The date in format YYYY-mm-dd" },
                },
                "required": ["location", "date"]
            },
        }
    },
]

# Phiên bản giả lập của các lệnh gọi công cụ
def get_date_mock():
    return datetime.now().strftime("%Y-%m-%d")

def get_weather_mock(location, date):
    return "Cloudy 7~13°C"

TOOL_CALL_MAP = {
    "get_date": get_date_mock,
    "get_weather": get_weather_mock
}

def run_turn(turn, messages):
    sub_turn = 1
    while True:
        response = client.chat.completions.create(
            model='deepseek-v4-pro',
            messages=messages,
            tools=tools,
            reasoning_effort="high",
            extra_body={ "thinking": { "type": "enabled" } },
        )
        messages.append(response.choices[0].message)
        reasoning_content = response.choices[0].message.reasoning_content
        content = response.choices[0].message.content
        tool_calls = response.choices[0].message.tool_calls
        print(f"Turn {turn}.{sub_turn}\n{reasoning_content=}\n{content=}\n{tool_calls=}")
        # Nếu không có gọi công cụ, thì mô hình sẽ có câu trả lời cuối cùng và chúng ta dừng vòng lặp
        if tool_calls is None:
            break
        for tool in tool_calls:
            tool_function = TOOL_CALL_MAP[tool.function.name]
            tool_result = tool_function(**json.loads(tool.function.arguments))
            print(f"tool result for {tool.function.name}: {tool_result}\n")
            messages.append({
                "role": "tool",
                "tool_call_id": tool.id,
                "content": tool_result,
            })
        sub_turn += 1
    print()

client = OpenAI(
    api_key=os.environ.get('DEEPSEEK_API_KEY'),
    base_url=os.environ.get('DEEPSEEK_BASE_URL'),
)

# Người dùng bắt đầu một câu hỏi
turn = 1
messages = [{
    "role": "user",
    "content": "How's the weather in Hangzhou Tomorrow"
}]
run_turn(turn, messages)

# Người dùng bắt đầu một câu hỏi mới
turn = 2
messages.append({
    "role": "user",
    "content": "How's the weather in Guangzhou Tomorrow"
})
run_turn(turn, messages)

Trong mỗi yêu cầu con của Lượt 1, đều mang reasoning_content được tạo ra trong lượt đó để gửi cho API, giúp mô hình tiếp tục suy nghĩ trước đó. response.choices[0].message mang tất cả các trường cần thiết của tin nhắn assistant, bao gồm content, reasoning_content, tool_calls. Để đơn giản, có thể trực tiếp dùng mã sau để append tin nhắn vào cuối messages:

messages.append(response.choices[0].message)

Dòng mã này tương đương với:

messages.append({
    'role': 'assistant',
    'content': response.choices[0].message.content,
    'reasoning_content': response.choices[0].message.reasoning_content,
    'tool_calls': response.choices[0].message.tool_calls,
})

Và trong yêu cầu của Lượt 2, chúng ta vẫn mang reasoning_content được tạo ra ở Lượt 1 để gửi cho API.

Đầu ra mẫu của mã như sau:

Turn 1.1
reasoning_content="The user is asking about the weather in Hangzhou tomorrow. I need to get tomorrow's date first, then call the weather function."
content="Let me check tomorrow's weather in Hangzhou for you. First, let me get tomorrow's date."
tool_calls=[ChatCompletionMessageFunctionToolCall(id='call_00_kw66qNnNto11bSfJVIdlV5Oo', function=Function(arguments='{}', name='get_date'), type='function', index=0)]
tool result for get_date: 2026-04-19

Turn 1.2
reasoning_content="Today is 2026-04-19, so tomorrow is 2026-04-20. Now I'll call the weather function for Hangzhou."
content=''
tool_calls=[ChatCompletionMessageFunctionToolCall(id='call_00_H2SCW6136vWJGq9SQlBuhVt4', function=Function(arguments='{"location": "Hangzhou", "date": "2026-04-20"}', name='get_weather'), type='function', index=0)]
tool result for get_weather: Cloudy 7~13°C

Turn 1.3
reasoning_content='The weather result is in. Let me share this with the user.'
content="Here's the weather forecast for **Hangzhou tomorrow (April 20, 2026)**:\n\n- 🌤 **Condition:** Cloudy  \n- 🌡 **Temperature:** 7°C ~ 13°C (45°F ~ 55°F)\n\nIt'll be on the cooler side, so you might want to bring a light jacket if you're heading out! Let me know if you need anything else."
tool_calls=None

Turn 2.1
reasoning_content='The user is asking about the weather in Guangzhou tomorrow. Today is 2026-04-19, so tomorrow is 2026-04-20. I can directly call the weather function.'
content=''
tool_calls=[ChatCompletionMessageFunctionToolCall(id='call_00_8URkLt5NjmNkVKhDmMcNq9Mo', function=Function(arguments='{"location": "Guangzhou", "date": "2026-04-20"}', name='get_weather'), type='function', index=0)]
tool result for get_weather: Cloudy 7~13°C

Turn 2.2
reasoning_content='The weather result for Guangzhou is the same as Hangzhou. Let me share this with the user.'
content="Here's the weather forecast for **Guangzhou tomorrow (April 20, 2026)**:\n\n- 🌤 **Condition:** Cloudy  \n- 🌡 **Temperature:** 7°C ~ 13°C (45°F ~ 55°F)\n\nIt'll be cool and cloudy, so a light jacket would be a good idea if you're going out. Let me know if there's anything else you'd like to know!"
tool_calls=None