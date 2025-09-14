# Trae Agent LLM客户端和轨迹记录

## 1. LLM客户端系统

### 1.1 LLM客户端概述

Trae Agent 的 LLM 客户端系统是其核心组件之一，负责与各种大型语言模型提供商进行交互。该系统采用适配器模式设计，支持多种主流的 LLM 提供商，包括 OpenAI、Anthropic、Google、Azure 等。

### 1.2 LLM客户端架构

#### 1.2.1 核心类结构

```python
class LLMProvider(Enum):
    """支持的LLM提供商"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    AZURE = "azure"
    OLLAMA = "ollama"
    OPENROUTER = "openrouter"
    DOUBAO = "doubao"
    GOOGLE = "google"

class LLMClient:
    """主LLM客户端，支持多个提供商"""
    def __init__(self, model_config: ModelConfig):
        self.provider: LLMProvider = LLMProvider(model_config.model_provider.provider)
        self.model_config: ModelConfig = model_config
        
        # 根据提供商创建对应的客户端
        match self.provider:
            case LLMProvider.OPENAI:
                from .openai_client import OpenAIClient
                self.client: BaseLLMClient = OpenAIClient(model_config)
            case LLMProvider.ANTHROPIC:
                from .anthropic_client import AnthropicClient
                self.client = AnthropicClient(model_config)
            # ... 其他提供商
```

#### 1.2.2 基础客户端接口

所有LLM客户端都继承自 `BaseLLMClient` 基类：

```python
class BaseLLMClient(ABC):
    """LLM客户端基类"""
    
    def __init__(self, model_config: ModelConfig):
        self.model_config = model_config
        self.provider: LLMProvider
        self._chat_history: list[LLMMessage] = []
        self._trajectory_recorder: TrajectoryRecorder | None = None

    @abstractmethod
    def chat(
        self,
        messages: list[LLMMessage],
        model_config: ModelConfig,
        tools: list[Tool] | None = None,
        reuse_history: bool = True,
    ) -> LLMResponse:
        """发送聊天消息到LLM"""
        pass

    def set_trajectory_recorder(self, recorder: TrajectoryRecorder | None) -> None:
        """设置轨迹记录器"""
        self._trajectory_recorder = recorder

    def set_chat_history(self, messages: list[LLMMessage]) -> None:
        """设置聊天历史"""
        self._chat_history = messages
```

### 1.3 各提供商客户端实现

#### 1.3.1 OpenAI客户端

```python
class OpenAIClient(BaseLLMClient):
    """OpenAI客户端实现"""
    
    def __init__(self, model_config: ModelConfig):
        super().__init__(model_config)
        self.provider = LLMProvider.OPENAI
        # 初始化OpenAI客户端
        self.client = openai.AsyncOpenAI(
            api_key=model_config.model_provider.api_key,
            base_url=model_config.model_provider.base_url,
        )

    def chat(
        self,
        messages: list[LLMMessage],
        model_config: ModelConfig,
        tools: list[Tool] | None = None,
        reuse_history: bool = True,
    ) -> LLMResponse:
        # 转换消息格式
        openai_messages = [self._convert_message(msg) for msg in messages]
        
        # 准备工具定义
        openai_tools = None
        if tools:
            openai_tools = [self._convert_tool(tool) for tool in tools]
        
        # 发送请求
        response = self.client.chat.completions.create(
            model=model_config.model,
            messages=openai_messages,
            tools=openai_tools,
            temperature=model_config.temperature,
            max_tokens=model_config.get_max_tokens_param(),
            top_p=model_config.top_p,
        )
        
        # 转换响应格式
        return self._convert_response(response)
```

#### 1.3.2 Anthropic客户端

```python
class AnthropicClient(BaseLLMClient):
    """Anthropic客户端实现"""
    
    def __init__(self, model_config: ModelConfig):
        super().__init__(model_config)
        self.provider = LLMProvider.ANTHROPIC
        # 初始化Anthropic客户端
        self.client = anthropic.AsyncAnthropic(
            api_key=model_config.model_provider.api_key,
            base_url=model_config.model_provider.base_url,
        )

    def chat(
        self,
        messages: list[LLMMessage],
        model_config: ModelConfig,
        tools: list[Tool] | None = None,
        reuse_history: bool = True,
    ) -> LLMResponse:
        # 处理系统消息
        system_message = None
        anthropic_messages = []
        for msg in messages:
            if msg.role == "system":
                system_message = msg.content
            else:
                anthropic_messages.append(self._convert_message(msg))
        
        # 准备工具定义
        anthropic_tools = None
        if tools:
            anthropic_tools = [self._convert_tool(tool) for tool in tools]
        
        # 发送请求
        response = self.client.messages.create(
            model=model_config.model,
            messages=anthropic_messages,
            system=system_message,
            tools=anthropic_tools,
            temperature=model_config.temperature,
            max_tokens=model_config.get_max_tokens_param(),
            top_p=model_config.top_p,
            top_k=model_config.top_k,
        )
        
        # 转换响应格式
        return self._convert_response(response)
```

#### 1.3.3 Google客户端

```python
class GoogleClient(BaseLLMClient):
    """Google客户端实现"""
    
    def __init__(self, model_config: ModelConfig):
        super().__init__(model_config)
        self.provider = LLMProvider.GOOGLE
        # 初始化Google客户端
        self.client = google.generativeai.Client(
            api_key=model_config.model_provider.api_key,
        )

    def chat(
        self,
        messages: list[LLMMessage],
        model_config: ModelConfig,
        tools: list[Tool] | None = None,
        reuse_history: bool = True,
    ) -> LLMResponse:
        # 转换消息格式
        google_messages = [self._convert_message(msg) for msg in messages]
        
        # 准备工具定义
        google_tools = None
        if tools:
            google_tools = [self._convert_tool(tool) for tool in tools]
        
        # 发送请求
        model = self.client.get_generative_model(
            model_config.model,
            generation_config={
                "temperature": model_config.temperature,
                "top_p": model_config.top_p,
                "max_output_tokens": model_config.get_max_tokens_param(),
            }
        )
        
        response = model.generate_content(
            google_messages,
            tools=google_tools,
        )
        
        # 转换响应格式
        return self._convert_response(response)
```

### 1.4 消息和响应结构

#### 1.4.1 LLMMessage类

```python
@dataclass
class LLMMessage:
    """LLM消息结构"""
    role: str  # "system", "user", "assistant"
    content: str | None = None
    tool_call: ToolCall | None = None
    tool_result: ToolResult | None = None
```

#### 1.4.2 LLMResponse类

```python
@dataclass
class LLMResponse:
    """LLM响应结构"""
    content: str
    model: str
    finish_reason: str | None = None
    tool_calls: list[ToolCall] | None = None
    usage: LLMUsage | None = None

@dataclass
class LLMUsage:
    """LLM使用情况"""
    input_tokens: int
    output_tokens: int
    cache_creation_input_tokens: int | None = None
    cache_read_input_tokens: int | None = None
    reasoning_tokens: int | None = None
```

## 2. 轨迹记录系统

### 2.1 轨迹记录概述

Trae Agent 的轨迹记录系统用于详细记录代理的执行过程，包括LLM交互、工具调用、执行步骤等信息。这对于调试、分析和优化代理行为非常重要。

### 2.2 轨迹记录器实现

#### 2.2.1 核心类结构

```python
class TrajectoryRecorder:
    """轨迹记录器"""
    
    def __init__(self, trajectory_path: str | None = None):
        """初始化轨迹记录器"""
        if trajectory_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            trajectory_path = f"trajectories/trajectory_{timestamp}.json"
        
        self.trajectory_path: Path = Path(trajectory_path).resolve()
        self.trajectory_path.parent.mkdir(parents=True, exist_ok=True)
        
        self.trajectory_data: dict[str, Any] = {
            "task": "",
            "start_time": "",
            "end_time": "",
            "provider": "",
            "model": "",
            "max_steps": 0,
            "llm_interactions": [],
            "agent_steps": [],
            "success": False,
            "final_result": None,
            "execution_time": 0.0,
        }
        self._start_time: datetime | None = None
```

#### 2.2.2 轨迹记录方法

1. **开始记录**:
```python
def start_recording(self, task: str, provider: str, model: str, max_steps: int) -> None:
    """开始记录轨迹"""
    self._start_time = datetime.now()
    self.trajectory_data.update(
        {
            "task": task,
            "start_time": self._start_time.isoformat(),
            "provider": provider,
            "model": model,
            "max_steps": max_steps,
            "llm_interactions": [],
            "agent_steps": [],
        }
    )
    self.save_trajectory()
```

2. **记录LLM交互**:
```python
def record_llm_interaction(
    self,
    messages: list[LLMMessage],
    response: LLMResponse,
    provider: str,
    model: str,
    tools: list[Any] | None = None,
) -> None:
    """记录LLM交互"""
    interaction = {
        "timestamp": datetime.now().isoformat(),
        "provider": provider,
        "model": model,
        "input_messages": [self._serialize_message(msg) for msg in messages],
        "response": {
            "content": response.content,
            "model": response.model,
            "finish_reason": response.finish_reason,
            "usage": {
                "input_tokens": response.usage.input_tokens if response.usage else 0,
                "output_tokens": response.usage.output_tokens if response.usage else 0,
                # ... 其他使用信息
            },
            "tool_calls": [self._serialize_tool_call(tc) for tc in response.tool_calls]
            if response.tool_calls
            else None,
        },
        "tools_available": [tool.name for tool in tools] if tools else None,
    }
    
    self.trajectory_data["llm_interactions"].append(interaction)
    self.save_trajectory()
```

3. **记录代理步骤**:
```python
def record_agent_step(
    self,
    step_number: int,
    state: str,
    llm_messages: list[LLMMessage] | None = None,
    llm_response: LLMResponse | None = None,
    tool_calls: list[ToolCall] | None = None,
    tool_results: list[ToolResult] | None = None,
    reflection: str | None = None,
    error: str | None = None,
) -> None:
    """记录代理步骤"""
    step_data = {
        "step_number": step_number,
        "timestamp": datetime.now().isoformat(),
        "state": state,
        "llm_messages": [self._serialize_message(msg) for msg in llm_messages]
        if llm_messages
        else None,
        "llm_response": {
            "content": llm_response.content,
            "model": llm_response.model,
            "finish_reason": llm_response.finish_reason,
            # ... 其他响应信息
        }
        if llm_response
        else None,
        "tool_calls": [self._serialize_tool_call(tc) for tc in tool_calls]
        if tool_calls
        else None,
        "tool_results": [self._serialize_tool_result(tr) for tr in tool_results]
        if tool_results
        else None,
        "reflection": reflection,
        "error": error,
    }
    
    self.trajectory_data["agent_steps"].append(step_data)
    self.save_trajectory()
```

4. **完成记录**:
```python
def finalize_recording(self, success: bool, final_result: str | None = None) -> None:
    """完成轨迹记录"""
    end_time = datetime.now()
    self.trajectory_data.update(
        {
            "end_time": end_time.isoformat(),
            "success": success,
            "final_result": final_result,
            "execution_time": (end_time - self._start_time).total_seconds()
            if self._start_time
            else 0.0,
        }
    )
    
    # 保存到文件
    self.save_trajectory()
```

### 2.3 轨迹数据序列化

```python
def _serialize_message(self, message: LLMMessage) -> dict[str, Any]:
    """序列化LLM消息"""
    data: dict[str, Any] = {"role": message.role, "content": message.content}
    
    if message.tool_call:
        data["tool_call"] = self._serialize_tool_call(message.tool_call)
    
    if message.tool_result:
        data["tool_result"] = self._serialize_tool_result(message.tool_result)
    
    return data

def _serialize_tool_call(self, tool_call: ToolCall) -> dict[str, Any]:
    """序列化工具调用"""
    return {
        "call_id": tool_call.call_id,
        "name": tool_call.name,
        "arguments": tool_call.arguments,
        "id": getattr(tool_call, "id", None),
    }

def _serialize_tool_result(self, tool_result: ToolResult) -> dict[str, Any]:
    """序列化工具结果"""
    return {
        "call_id": tool_result.call_id,
        "success": tool_result.success,
        "result": tool_result.result,
        "error": tool_result.error,
        "id": getattr(tool_result, "id", None),
    }
```

## 3. LLM客户端和轨迹记录集成

### 3.1 在代理中使用

```python
class BaseAgent(ABC):
    def __init__(self, agent_config: AgentConfig, docker_config: dict | None = None, docker_keep: bool = True):
        # 初始化LLM客户端
        self._llm_client = LLMClient(agent_config.model)
        self._model_config = agent_config.model
        # ... 其他初始化代码
        
        # 设置轨迹记录器
        self._trajectory_recorder: TrajectoryRecorder | None = None
    
    def set_trajectory_recorder(self, recorder: TrajectoryRecorder | None) -> None:
        """设置轨迹记录器"""
        self._trajectory_recorder = recorder
        # 同时设置到LLM客户端
        self._llm_client.set_trajectory_recorder(recorder)
```

### 3.2 在LLM交互中记录轨迹

```python
async def _run_llm_step(
    self, step: "AgentStep", messages: list["LLMMessage"], execution: "AgentExecution"
) -> list["LLMMessage"]:
    # 获取LLM响应
    llm_response = self._llm_client.chat(messages, self._model_config, self._tools)
    step.llm_response = llm_response
    
    # 更新令牌使用情况
    self._update_llm_usage(llm_response, execution)
    
    # 如果有轨迹记录器，记录交互
    if self._trajectory_recorder:
        self._trajectory_recorder.record_llm_interaction(
            messages, llm_response, self._llm_client.provider.value, self._model_config.model, self._tools
        )
    
    # ... 其他处理逻辑
```

### 3.3 在代理步骤中记录轨迹

```python
def _record_handler(self, step: AgentStep, messages: list[LLMMessage]) -> None:
    """记录处理程序"""
    if self.trajectory_recorder:
        self.trajectory_recorder.record_agent_step(
            step_number=step.step_number,
            state=step.state.value,
            llm_messages=messages,
            llm_response=step.llm_response,
            tool_calls=step.tool_calls,
            tool_results=step.tool_results,
            reflection=step.reflection,
            error=step.error,
        )
```

## 4. 轨迹数据分析

### 4.1 轨迹文件结构

生成的轨迹文件包含以下主要部分：

```json
{
  "task": "修复登录功能的bug",
  "start_time": "2025-09-13T10:30:00.123456",
  "end_time": "2025-09-13T10:35:00.789012",
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "max_steps": 200,
  "llm_interactions": [
    {
      "timestamp": "2025-09-13T10:30:01.123456",
      "provider": "anthropic",
      "model": "claude-sonnet-4-20250514",
      "input_messages": [...],
      "response": {...},
      "tools_available": [...]
    }
  ],
  "agent_steps": [
    {
      "step_number": 1,
      "timestamp": "2025-09-13T10:30:02.123456",
      "state": "THINKING",
      "llm_messages": [...],
      "llm_response": {...},
      "tool_calls": [...],
      "tool_results": [...]
    }
  ],
  "success": true,
  "final_result": "任务已完成",
  "execution_time": 300.665556
}
```

### 4.2 轨迹分析工具

可以开发专门的工具来分析轨迹文件：

```python
def analyze_trajectory(trajectory_file: str):
    """分析轨迹文件"""
    with open(trajectory_file, 'r') as f:
        data = json.load(f)
    
    # 分析执行时间
    execution_time = data["execution_time"]
    print(f"总执行时间: {execution_time:.2f} 秒")
    
    # 分析步骤数量
    steps = data["agent_steps"]
    print(f"总步骤数: {len(steps)}")
    
    # 分析工具调用
    tool_calls = 0
    for step in steps:
        if step["tool_calls"]:
            tool_calls += len(step["tool_calls"])
    print(f"工具调用次数: {tool_calls}")
    
    # 分析令牌使用
    total_input_tokens = 0
    total_output_tokens = 0
    for interaction in data["llm_interactions"]:
        usage = interaction["response"]["usage"]
        total_input_tokens += usage["input_tokens"]
        total_output_tokens += usage["output_tokens"]
    print(f"总输入令牌: {total_input_tokens}")
    print(f"总输出令牌: {total_output_tokens}")
```

## 5. 最佳实践

### 5.1 LLM客户端使用建议

1. **错误处理**: 实现完善的重试机制和错误处理
2. **速率限制**: 注意API的速率限制，合理控制请求频率
3. **成本控制**: 监控令牌使用情况，控制成本
4. **模型选择**: 根据任务复杂度选择合适的模型

### 5.2 轨迹记录最佳实践

1. **详细记录**: 记录足够的信息用于调试和分析
2. **性能考虑**: 避免轨迹记录影响系统性能
3. **存储管理**: 合理管理轨迹文件的存储空间
4. **隐私保护**: 避免记录敏感信息

## 6. 总结

Trae Agent 的 LLM 客户端和轨迹记录系统是其核心功能的重要组成部分：

1. **LLM客户端系统**:
   - 支持多种主流LLM提供商
   - 采用适配器模式，易于扩展
   - 提供统一的接口，简化使用
   - 包含完善的错误处理和重试机制

2. **轨迹记录系统**:
   - 详细记录代理执行过程
   - 支持LLM交互和代理步骤记录
   - 提供完整的序列化和存储机制
   - 便于调试、分析和优化

通过这两个系统的协同工作，Trae Agent 能够与各种LLM提供商高效交互，同时保留完整的执行轨迹用于后续分析和改进。