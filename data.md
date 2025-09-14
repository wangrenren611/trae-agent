# Trae Agent Trajectory 数据格式详解

## 概述

Trajectory是Trae Agent系统记录智能体执行轨迹的JSON格式文件，用于调试、分析、审计和研究目的。该文件记录了完整的LLM交互过程和智能体执行步骤。

## 文件结构

```json
{
  "task": "任务描述",
  "start_time": "开始时间",
  "end_time": "结束时间",
  "provider": "LLM提供商",
  "model": "模型名称",
  "max_steps": "最大步数",
  "llm_interactions": [],
  "agent_steps": [],
  "success": "是否成功",
  "final_result": "最终结果",
  "execution_time": "执行时间"
}
```

## 字段详细说明

### 根级别字段

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `task` | string | 是 | 原始任务描述，用户输入的任务内容 |
| `start_time` | string | 是 | 任务开始时间，ISO 8601格式 (YYYY-MM-DDTHH:MM:SS.ffffff) |
| `end_time` | string | 是 | 任务结束时间，ISO 8601格式 (YYYY-MM-DDTHH:MM:SS.ffffff) |
| `provider` | string | 是 | LLM提供商名称，可能的值：`anthropic`, `openai`, `google`, `azure`, `doubao`, `ollama`, `openrouter` |
| `model` | string | 是 | 使用的具体模型名称，如 `claude-sonnet-4-20250514`, `gpt-4o` 等 |
| `max_steps` | integer | 是 | 允许的最大执行步数，防止无限循环 |
| `llm_interactions` | array | 是 | LLM交互记录数组，记录每次与LLM的完整交互 |
| `agent_steps` | array | 是 | 智能体执行步骤数组，记录每个执行步骤的详细信息 |
| `success` | boolean | 是 | 任务是否成功完成 |
| `final_result` | string\|null | 否 | 最终结果或输出消息，失败时为null |
| `execution_time` | number | 是 | 总执行时间，单位为秒，精确到小数点后6位 |

## LLM交互记录 (llm_interactions)

每个LLM交互记录包含以下字段：

```json
{
  "timestamp": "2025-06-12T22:05:47.000000",
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "input_messages": [...],
  "response": {...},
  "tools_available": [...]
}
```

### LLM交互字段说明

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `timestamp` | string | 是 | 交互发生的时间戳，ISO 8601格式 |
| `provider` | string | 是 | 本次交互使用的LLM提供商 |
| `model` | string | 是 | 本次交互使用的具体模型 |
| `input_messages` | array | 是 | 发送给LLM的输入消息数组 |
| `response` | object | 是 | LLM的完整响应对象 |
| `tools_available` | array\|null | 否 | 本次交互时可用的工具名称列表 |

### 输入消息格式 (input_messages)

```json
{
  "role": "system|user|assistant",
  "content": "消息内容",
  "tool_call": {...}, // 可选
  "tool_result": {...} // 可选
}
```

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `role` | string | 是 | 消息角色：`system`(系统消息), `user`(用户消息), `assistant`(助手消息) |
| `content` | string | 是 | 消息的文本内容 |
| `tool_call` | object\|null | 否 | 工具调用信息，当消息包含工具调用时存在 |
| `tool_result` | object\|null | 否 | 工具执行结果，当消息包含工具结果时存在 |

### LLM响应格式 (response)

```json
{
  "content": "LLM响应内容",
  "model": "claude-sonnet-4-20250514",
  "finish_reason": "end_turn",
  "usage": {...},
  "tool_calls": [...]
}
```

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `content` | string | 是 | LLM生成的文本响应内容 |
| `model` | string | 是 | 实际使用的模型名称 |
| `finish_reason` | string | 是 | 响应结束原因：`end_turn`, `max_tokens`, `stop`, `tool_calls` 等 |
| `usage` | object | 是 | Token使用统计信息 |
| `tool_calls` | array\|null | 否 | LLM发起的工具调用列表 |

### Token使用统计 (usage)

```json
{
  "input_tokens": 150,
  "output_tokens": 75,
  "cache_creation_input_tokens": 0,
  "cache_read_input_tokens": 0,
  "reasoning_tokens": null
}
```

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `input_tokens` | integer | 是 | 输入token数量 |
| `output_tokens` | integer | 是 | 输出token数量 |
| `cache_creation_input_tokens` | integer\|null | 否 | 缓存创建时的输入token数（某些模型支持） |
| `cache_read_input_tokens` | integer\|null | 否 | 缓存读取时的输入token数（某些模型支持） |
| `reasoning_tokens` | integer\|null | 否 | 推理过程使用的token数（某些模型支持） |

### 工具调用格式 (tool_calls)

```json
{
  "call_id": "call_123",
  "name": "str_replace_based_edit_tool",
  "arguments": {
    "command": "create",
    "path": "hello.py",
    "file_text": "print('Hello, World!')"
  }
}
```

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `call_id` | string | 是 | 工具调用的唯一标识符 |
| `name` | string | 是 | 工具名称 |
| `arguments` | object | 是 | 传递给工具的参数对象 |

## 智能体执行步骤 (agent_steps)

每个执行步骤包含以下字段：

```json
{
  "step_number": 1,
  "timestamp": "2025-06-12T22:05:47.500000",
  "state": "thinking",
  "llm_messages": [...],
  "llm_response": {...},
  "tool_calls": [...],
  "tool_results": [...],
  "reflection": null,
  "error": null,
  "lakeview_summary": "步骤摘要" // 可选
}
```

### 执行步骤字段说明

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `step_number` | integer | 是 | 步骤序号，从1开始递增 |
| `timestamp` | string | 是 | 步骤执行的时间戳，ISO 8601格式 |
| `state` | string | 是 | 智能体当前状态：`thinking`(思考中), `calling_tool`(调用工具), `reflecting`(反思中), `completed`(已完成), `error`(错误) |
| `llm_messages` | array\|null | 否 | 该步骤中发送给LLM的消息 |
| `llm_response` | object\|null | 否 | 该步骤中LLM的响应 |
| `tool_calls` | array\|null | 否 | 该步骤中发起的工具调用 |
| `tool_results` | array\|null | 否 | 该步骤中工具的执行结果 |
| `reflection` | string\|null | 否 | 智能体对该步骤的反思内容 |
| `error` | string\|null | 否 | 如果步骤失败，包含错误信息 |
| `lakeview_summary` | string\|null | 否 | LakeView系统生成的步骤摘要 |

### 工具结果格式 (tool_results)

```json
{
  "call_id": "call_123",
  "success": true,
  "result": "File created successfully",
  "error": null
}
```

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `call_id` | string | 是 | 对应的工具调用ID |
| `success` | boolean | 是 | 工具执行是否成功 |
| `result` | string | 是 | 工具执行的结果内容 |
| `error` | string\|null | 否 | 如果执行失败，包含错误信息 |

## 数据记录机制

### 自动记录
- 所有LLM客户端自动记录交互数据
- 智能体执行步骤自动记录状态转换
- 工具调用和结果自动记录

### 实时保存
- 每次交互后立即保存到文件
- 使用UTF-8编码，支持中文内容
- 文件保存在`trajectories/`目录下

### 文件命名
- 默认格式：`trajectory_YYYYMMDD_HHMMSS.json`
- 支持自定义文件名和路径
- 自动创建目录结构

## 使用场景

1. **调试分析**: 追踪智能体执行过程中的具体问题
2. **性能分析**: 分析token使用和执行时间模式
3. **行为研究**: 理解LLM推理和工具使用模式
4. **合规审计**: 记录所有自动化操作和变更
5. **模型比较**: 比较不同LLM提供商和模型的行为

## 安全注意事项

- Trajectory文件可能包含敏感信息
- API密钥不会被记录
- 建议安全存储包含专有代码或数据的trajectory文件
- `trajectories/`目录已从版本控制中排除

## 示例文件

完整的trajectory文件示例请参考项目文档中的示例，包含一个完整的"创建Hello World Python脚本"任务的执行轨迹。
