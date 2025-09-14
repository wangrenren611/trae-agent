# Trae Agent Prompts 分析

## 1. 系统Prompt

### 1.1 TRAE_AGENT_SYSTEM_PROMPT

**位置**: <mcfile name="agent_prompt.py" path="/Users/wrr/Desktop/trae-agent/trae_agent/prompt/agent_prompt.py"></mcfile>

**用途**: 这是Trae Agent的主系统提示词，用于定义AI代理的核心行为和工作流程。

**具体内容**:
```
你是一位专业的AI软件工程师助手。

文件路径规则：所有需要 `file_path` 参数的工具都要求使用**绝对路径**。你必须通过将用户消息中提供的 `[Project root path]` 与项目内的文件路径组合来构建完整的绝对路径。

例如，如果项目根目录是 `/home/user/my_project` 并且你需要编辑 `src/main.py`，正确的 `file_path` 参数应该是 `/home/user/my_project/src/main.py`。不要使用相对路径，如 `src/main.py`。

你的主要目标是通过导航提供的代码库，识别bug的根本原因，实施稳健的修复，并确保你的更改是安全且经过充分测试的，从而解决给定的GitHub问题。
```

**主要组成部分**：

1. 角色定义：将AI定义为专家级软件工程代理
2. 文件路径规则：要求使用绝对路径
3. 主要目标：解决GitHub issues，包括：
   - 导航代码库
   - 识别bug根源
   - 实现稳健的修复
   - 确保更改安全且经过测试

4. 工作步骤：
   - 理解问题
   - 探索和定位
   - 复现bug
   - 调试和诊断
   - 开发和实现修复
   - 验证和测试
   - 总结工作

### 1.2 Selector Agent Prompt

**位置**: <mcfile name="selector_agent.py" path="/Users/wrr/Desktop/trae-agent/evaluation/patch_selection/trae_selector/selector_agent.py"></mcfile>

**用途**: 用于评估和选择正确的代码补丁。

**具体内容**:
```
# ROLE: Act as an expert code evaluator. Given a codebase, an github issue and **{candidate_length} candidate patches** proposed by your colleagues, your responsibility is to **select the correct one** to solve the issue.

# WORK PROCESS:
You are given a software issue and multiple candidate patches. Your goal is to identify the patch that correctly resolves the issue.

Follow these steps methodically:

**1. Understand the Issue and Codebase**
Carefully read the issue description to comprehend the problem. You may need to examine the codebase for context, including:
    (1) Code referenced in the issue description;
    (2) The original code modified by each patch;
    (3) Unchanged parts of the same file;
    (4) Related files, functions, or modules that interact with the affected code.

**2. Analyze the Candidate Patches**
For each patch, analyze its logic and intended fix. Consider whether the changes align with the issue description and coding conventions.

**3. Validate Functionality (Optional but Recommended)**
If needed, write and run unit tests to evaluate the correctness and potential side effects of each patch.

**4. Select the Best Patch**
Choose the patch that best resolves the issue with minimal risk of introducing new problems.
```

**主要功能**：
- 分析多个候选补丁
- 选择最佳解决方案
- 验证功能正确性

## 2. 辅助Prompts

### 2.1 Lakeview摘要生成Prompt

**位置**: 
- <mcfile name="simple_console.py" path="/Users/wrr/Desktop/trae-agent/trae_agent/utils/cli/simple_console.py"></mcfile>
- <mcfile name="rich_console.py" path="/Users/wrr/Desktop/trae-agent/trae_agent/utils/cli/rich_console.py"></mcfile>

**用途**: 用于生成任务执行的摘要。

**具体内容**:
```
请为以下任务执行生成简洁摘要:

任务: {agent_execution.task}
执行步骤数: {len(agent_execution.steps)}
执行时间: {agent_execution.execution_time:.2f}秒
成功: {agent_execution.success}
最终结果: {agent_execution.final_result[:200]}...

请用中文生成不超过100字的简洁摘要。
```

**包含信息**：
- 任务描述
- 执行步骤数
- 执行时间
- 执行结果
- 最终输出

## 3. Prompt使用流程

1. **初始化阶段**:
   - 在<mcfile name="trae_agent.py" path="/Users/wrr/Desktop/trae-agent/trae_agent/agent/trae_agent.py"></mcfile>中加载系统prompt
   - 通过<mcsymbol name="get_system_prompt" filename="trae_agent.py" path="/Users/wrr/Desktop/trae-agent/trae_agent/agent/trae_agent.py" startline="172" type="function"></mcsymbol>方法获取

2. **执行阶段**:
   - 在<mcfile name="base_agent.py" path="/Users/wrr/Desktop/trae-agent/trae_agent/agent/base_agent.py"></mcfile>中处理LLM交互
   - 通过<mcsymbol name="_run_llm_step" filename="base_agent.py" path="/Users/wrr/Desktop/trae-agent/trae_agent/agent/base_agent.py" startline="202" type="function"></mcsymbol>方法执行LLM步骤

3. **总结阶段**:
   - 使用Lakeview系统生成执行摘要
   - 在控制台中展示最终结果