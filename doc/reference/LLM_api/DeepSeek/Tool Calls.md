Tool Calls cho phép mô hình gọi các công cụ bên ngoài để tăng cường khả năng của mình.

Chế độ không suy nghĩ
Mã mẫu
Dưới đây là mã Python hoàn chỉnh sử dụng Tool Calls, lấy ví dụ lấy thông tin thời tiết tại vị trí hiện tại của người dùng.

Định dạng API cụ thể của Tool Calls vui lòng tham khảo tài liệu Chat Completion.

from openai import OpenAI

def send_messages(messages):
    response = client.chat.completions.create(
        model="deepseek-v4-pro",
        messages=messages,
        tools=tools
    )
    return response.choices[0].message

client = OpenAI(
    api_key="<your api key>",
    base_url="https://api.deepseek.com",
)

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get weather of a location, the user should supply a location first.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA",
                    }
                },
                "required": ["location"]
            },
        }
    },
]

messages = [{"role": "user", "content": "How's the weather in Hangzhou, Zhejiang?"}]
message = send_messages(messages)
print(f"User>\t {messages[0]['content']}")

tool = message.tool_calls[0]
messages.append(message)

messages.append({"role": "tool", "tool_call_id": tool.id, "content": "24℃"})
message = send_messages(messages)
print(f"Model>\t {message.content}")

Quy trình thực thi của ví dụ này như sau:

Người dùng: Hỏi thời tiết hiện tại
Mô hình: Trả về function get_weather({location: 'Hangzhou'})
Người dùng: Gọi function get_weather({location: 'Hangzhou'}) và truyền cho mô hình.
Mô hình: Trả về ngôn ngữ tự nhiên, "The current temperature in Hangzhou is 24°C."
Lưu ý: Chức năng của hàm get_weather trong mã trên cần do người dùng cung cấp, mô hình không tự thực thi hàm cụ thể.

Chế độ suy nghĩ
Từ DeepSeek-V3.2, API hỗ trợ khả năng gọi công cụ trong chế độ suy nghĩ, xem chi tiết tại chế độ suy nghĩ.

Chế độ strict (Beta)
Trong chế độ strict, mô hình sẽ tuân thủ nghiêm ngặt định dạng JSON Schema của Function khi xuất ra lời gọi Function, để đảm bảo Function mà mô hình xuất ra phù hợp với định nghĩa của người dùng. Có thể sử dụng chế độ strict cho cả chế độ suy nghĩ và không suy nghĩ.

Để sử dụng chế độ strict, cần:

Người dùng đặt base_url="https://api.deepseek.com/beta" để bật tính năng Beta
Trong danh sách tools truyền vào, tất cả function đều phải đặt thuộc tính strict là true
Phía server sẽ kiểm tra JSON Schema của Function mà người dùng truyền vào, nếu không đúng quy định hoặc gặp loại JSON Schema không được hỗ trợ, sẽ trả về lỗi
Dưới đây là ví dụ định nghĩa tool trong chế độ strict:

{
    "type": "function",
    "function": {
        "name": "get_weather",
        "strict": true,
        "description": "Get weather of a location, the user should supply a location first.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city and state, e.g. San Francisco, CA",
                }
            },
            "required": ["location"],
            "additionalProperties": false
        }
    }
}

Các loại JSON Schema được hỗ trợ trong chế độ strict
object
string
number
integer
boolean
array
enum
anyOf
Loại object
object định nghĩa một cấu trúc lồng chứa các cặp key-value, trong đó properties định nghĩa schema cho từng key (thuộc tính) trong object. Tất cả thuộc tính của mỗi object đều phải được đặt là required và thuộc tính additionalProperties trong object phải là false.

Ví dụ:

{
    "type": "object",
    "properties": {
        "name": { "type": "string" },
        "age": { "type": "integer" }
    },
    "required": ["name", "age"],
    "additionalProperties": false
}

Loại string
Các tham số được hỗ trợ:
pattern: sử dụng biểu thức chính quy để ràng buộc định dạng chuỗi
format: sử dụng các định dạng phổ biến được xác định trước để kiểm tra, hiện hỗ trợ:
email: địa chỉ email
hostname: tên máy chủ
ipv4: địa chỉ IPv4
ipv6: địa chỉ IPv6
uuid: uuid
Các tham số không được hỗ trợ
minLength
maxLength
Ví dụ:

{
    "type": "object",
    "properties": {
        "user_email": {
            "type": "string",
            "description": "The user's email address",
            "format": "email" 
        },
        "zip_code": {
            "type": "string",
            "description": "Six digit postal code",
            "pattern": "^\\d{6}$"
        }
    }
}

Loại number/integer
Các tham số được hỗ trợ
const: cố định số là hằng số
default: giá trị mặc định của số
minimum: giá trị nhỏ nhất
maximum: giá trị lớn nhất
exclusiveMinimum: không nhỏ hơn
exclusiveMaximum: không lớn hơn
multipleOf: số xuất ra là bội số của giá trị này
Ví dụ:

{
    "type": "object",
    "properties": {
        "score": {
            "type": "integer",
            "description": "A number from 1-5, which represents your rating, the higher, the better",
            "minimum": 1,
            "maximum": 5
        }
    },
    "required": ["score"],
    "additionalProperties": false
}

Loại array
Các tham số không được hỗ trợ
minItems
maxItems
Ví dụ:

{
    "type": "object",
    "properties": {
        "keywords": {
            "type": "array",
            "description": "Five keywords of the article, sorted by importance",
            "items": {
                "type": "string",
                "description": "A concise and accurate keyword or phrase."
            }
        }
    },
    "required": ["keywords"],
    "additionalProperties": false
}

enum
enum đảm bảo đầu ra là một trong số các lựa chọn dự kiến, ví dụ trong tình huống trạng thái đơn hàng, chỉ có thể là một trong số các trạng thái giới hạn.

Ví dụ:

{
    "type": "object",
    "properties": {
        "order_status": {
            "type": "string",
            "description": "Ordering status",
            "enum": ["pending", "processing", "shipped", "cancelled"]
        }
    }
}

anyOf
Khớp với bất kỳ schema nào trong số các schema được cung cấp, có thể xử lý các trường có thể có nhiều định dạng hợp lệ, ví dụ tài khoản người dùng có thể là email hoặc số điện thoại:

{
    "type": "object",
    "properties": {
    "account": {
        "anyOf": [
            { "type": "string", "format": "email", "description": "có thể là địa chỉ email" },
            { "type": "string", "pattern": "^\\d{11}$", "description": "hoặc số điện thoại 11 chữ số" }
        ]
    }
  }
}

$ref và $def
Có thể sử dụng $def để định nghĩa các module, sau đó dùng $ref để tham chiếu nhằm giảm sự lặp lại và phân mô-đun hóa schema, ngoài ra còn có thể sử dụng $ref một mình để định nghĩa cấu trúc đệ quy.

{
    "type": "object",
    "properties": {
        "report_date": {
            "type": "string",
            "description": "The date when the report was published"
        },
        "authors": {
            "type": "array",
            "description": "The authors of the report",
            "items": {
                "$ref": "#/$def/author"
            }
        }
    },
    "required": ["report_date", "authors"],
    "additionalProperties": false,
    "$def": {
        "authors": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "author's name"
                },
                "institution": {
                    "type": "string",
                    "description": "author's institution"
                },
                "email": {
                    "type": "string",
                    "format": "email",
                    "description": "author's email"
                }
            },
            "additionalProperties": false,
            "required": ["name", "institution", "email"]
        }
    }
}

Trang trước