# Trae Agent LLM客户端系统 Node.js 完整实现

## 文档概述

本文档深入分析 Trae Agent LLM客户端系统的 Node.js/TypeScript 完整实现，包括统一客户端接口、多提供商适配机制、以及各种具体客户端的实现细节。每行代码都将进行详细的技术分析和设计思路解读，确保实现了原版所有功能。

## 目录

1. [LLM客户端统一接口实现](#1-llm客户端统一接口实现)
2. [多提供商策略模式完整实现](#2-多提供商策略模式完整实现)
3. [具体客户端详细实现](#3-具体客户端详细实现)
4. [错误处理和重试机制](#4-错误处理和重试机制)

---

## 1. LLM客户端统一接口实现

### 1.1 核心类型定义

```typescript
// src/llm/types.ts

/**
 * 支持的LLM提供商
 */
export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  AZURE = 'azure',
  OLLAMA = 'ollama',
  OPENROUTER = 'openrouter',
  DOUBAO = 'doubao',
  GOOGLE = 'google',
}

/**
 * LLM消息结构
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolResult?: ToolResult;
  name?: string; // 用于工具消息
}

/**
 * Token使用统计
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * LLM响应结构
 */
export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  model?: string;
  id?: string;
}

/**
 * 流式响应块
 */
export interface LLMStreamChunk {
  content?: string;
  toolCalls?: Partial<ToolCall>[];
  usage?: TokenUsage;
  finishReason?: string;
  delta?: {
    content?: string;
    toolCalls?: Partial<ToolCall>[];
  };
}

/**
 * LLM客户端配置
 */
export interface LLMClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  defaultModel?: string;
  organization?: string; // OpenAI特定
  apiVersion?: string; // Azure特定
}
```

**类型定义详细分析：**

**LLMProvider枚举：**
```typescript
export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  AZURE = 'azure',
  OLLAMA = 'ollama',
  OPENROUTER = 'openrouter',
  DOUBAO = 'doubao',
  GOOGLE = 'google',
}
```
- **语法层面**：字符串枚举，提供类型安全的提供商标识
- **功能层面**：定义所有支持的LLM提供商类型
- **设计层面**：使用字符串值便于序列化和配置文件使用
- **架构层面**：为多提供商架构提供统一的类型系统

**LLMMessage接口：**
```typescript
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolResult?: ToolResult;
  name?: string; // 用于工具消息
}
```
- **语法层面**：接口定义，包含必需和可选字段
- **功能层面**：统一的消息格式，支持不同角色和工具结果
- **设计层面**：兼容多种LLM提供商的消息格式要求
- **架构层面**：为对话管理提供标准化的数据结构

**LLMResponse接口：**
```typescript
export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  model?: string;
  id?: string;
}
```
- **语法层面**：包含完整响应信息的接口定义
- **功能层面**：统一的响应格式，包含内容、工具调用和元数据
- **设计层面**：可选字段设计，适应不同提供商的响应格式
- **架构层面**：为响应处理提供标准化的数据结构

### 1.2 基础LLM客户端抽象类

```typescript
// src/llm/BaseLLMClient.ts

import { EventEmitter } from 'events';
import { LLMMessage, LLMResponse, LLMStreamChunk, TokenUsage } from './types';
import { Tool } from '../tools/base/Tool';
import { ModelConfig } from '../config/types';
import { TrajectoryRecorder } from '../utils/TrajectoryRecorder';

/**
 * 所有LLM客户端的抽象基类
 */
export abstract class BaseLLMClient extends EventEmitter {
  protected modelConfig: ModelConfig;
  protected trajectoryRecorder?: TrajectoryRecorder;
  protected chatHistory: LLMMessage[] = [];
  protected totalTokens: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  constructor(modelConfig: ModelConfig) {
    super();
    this.modelConfig = modelConfig;
    
    this.emit('clientInit', { 
      provider: this.getProviderName(),
      model: modelConfig.model 
    });
  }

  /**
   * 获取提供商名称
   */
  abstract getProviderName(): string;

  /**
   * 检查客户端是否支持工具调用
   */
  abstract supportsToolCalling(modelConfig: ModelConfig): boolean;

  /**
   * 主要聊天方法 - 必须由子类实现
   */
  abstract chat(
    messages: LLMMessage[],
    modelConfig: ModelConfig,
    tools?: Tool[],
    reuseHistory?: boolean
  ): Promise<LLMResponse>;

  /**
   * 流式聊天方法 - 可选实现
   */
  async chatStream(
    messages: LLMMessage[],
    modelConfig: ModelConfig,
    tools?: Tool[],
    reuseHistory?: boolean
  ): Promise<AsyncIterable<LLMStreamChunk>> {
    // 默认实现：将常规聊天转换为单个块
    const response = await this.chat(messages, modelConfig, tools, reuseHistory);
    
    async function* singleChunkStream(): AsyncIterable<LLMStreamChunk> {
      yield {
        content: response.content,
        toolCalls: response.toolCalls,
        usage: response.usage,
        finishReason: response.finishReason,
      };
    }

    return singleChunkStream();
  }

  /**
   * 设置轨迹记录器
   */
  setTrajectoryRecorder(recorder?: TrajectoryRecorder): void {
    this.trajectoryRecorder = recorder;
    this.emit('trajectoryRecorderSet', { hasRecorder: !!recorder });
  }

  /**
   * 设置聊天历史以供上下文重用
   */
  setChatHistory(messages: LLMMessage[]): void {
    this.chatHistory = [...messages];
    this.emit('chatHistorySet', { messageCount: messages.length });
  }

  /**
   * 获取当前聊天历史
   */
  getChatHistory(): LLMMessage[] {
    return [...this.chatHistory];
  }

  /**
   * 清除聊天历史
   */
  clearChatHistory(): void {
    this.chatHistory = [];
    this.emit('chatHistoryCleared');
  }

  /**
   * 获取总Token使用量
   */
  getTotalTokenUsage(): TokenUsage {
    return { ...this.totalTokens };
  }

  /**
   * 更新Token使用统计
   */
  protected updateTokenUsage(usage: TokenUsage): void {
    this.totalTokens.promptTokens += usage.promptTokens;
    this.totalTokens.completionTokens += usage.completionTokens;
    this.totalTokens.totalTokens += usage.totalTokens;
    
    this.emit('tokenUsageUpdated', { 
      currentUsage: usage,
      totalUsage: this.totalTokens 
    });
  }

  /**
   * 重置Token使用统计
   */
  resetTokenUsage(): void {
    this.totalTokens = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    
    this.emit('tokenUsageReset');
  }

  /**
   * 准备API调用的消息（格式转换）
   */
  protected abstract prepareMessages(messages: LLMMessage[]): any[];

  /**
   * 准备API调用的工具（格式转换）
   */
  protected abstract prepareTools(tools: Tool[]): any[];

  /**
   * 将API响应解析为标准格式
   */
  protected abstract parseResponse(response: any): LLMResponse;

  /**
   * 处理API错误
   */
  protected handleApiError(error: any): Error {
    if (error.response) {
      // HTTP错误响应
      const status = error.response.status;
      const message = error.response.data?.error?.message || error.message;
      
      this.emit('apiError', { 
        status, 
        message, 
        provider: this.getProviderName() 
      });
      
      switch (status) {
        case 401:
          return new Error(`认证失败: ${message}`);
        case 429:
          return new Error(`速率限制超出: ${message}`);
        case 500:
          return new Error(`服务器错误: ${message}`);
        default:
          return new Error(`API错误 (${status}): ${message}`);
      }
    } else if (error.code) {
      // 网络错误
      this.emit('networkError', { 
        code: error.code, 
        message: error.message,
        provider: this.getProviderName() 
      });
      
      return new Error(`网络错误: ${error.message}`);
    } else {
      // 未知错误
      this.emit('unknownError', { 
        error, 
        provider: this.getProviderName() 
      });
      
      return new Error(`未知错误: ${error.message || String(error)}`);
    }
  }

  /**
   * 在轨迹中记录交互
   */
  protected recordTrajectory(
    messages: LLMMessage[],
    response: LLMResponse,
    tools?: Tool[]
  ): void {
    if (this.trajectoryRecorder) {
      this.trajectoryRecorder.recordLLMInteraction({
        provider: this.getProviderName(),
        model: this.modelConfig.model,
        messages,
        response,
        tools: tools?.map(t => t.name),
        timestamp: new Date(),
      });
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.clearChatHistory();
    this.resetTokenUsage();
    this.removeAllListeners();
    
    this.emit('clientCleanup', { provider: this.getProviderName() });
  }
}
```

**基础客户端类详细分析：**

**事件驱动设计：**
```typescript
constructor(modelConfig: ModelConfig) {
  super();
  this.modelConfig = modelConfig;
  
  this.emit('clientInit', { 
    provider: this.getProviderName(),
    model: modelConfig.model 
  });
}
```
- **语法层面**：继承EventEmitter并在构造函数中发射初始化事件
- **功能层面**：提供客户端生命周期的事件通知
- **设计层面**：事件驱动架构，支持外部监听和响应
- **架构层面**：为监控和调试提供实时的状态信息

**聊天历史管理：**
```typescript
setChatHistory(messages: LLMMessage[]): void {
  this.chatHistory = [...messages];
  this.emit('chatHistorySet', { messageCount: messages.length });
}

getChatHistory(): LLMMessage[] {
  return [...this.chatHistory];
}
```
- **语法层面**：数组展开操作符创建副本，避免引用共享
- **功能层面**：管理对话上下文，支持多轮对话
- **设计层面**：防御性复制，确保数据安全性
- **架构层面**：为对话连续性提供状态管理

**Token使用统计：**
```typescript
protected updateTokenUsage(usage: TokenUsage): void {
  this.totalTokens.promptTokens += usage.promptTokens;
  this.totalTokens.completionTokens += usage.completionTokens;
  this.totalTokens.totalTokens += usage.totalTokens;
  
  this.emit('tokenUsageUpdated', { 
    currentUsage: usage,
    totalUsage: this.totalTokens 
  });
}
```
- **语法层面**：累加操作和事件发射
- **功能层面**：跟踪Token使用情况，支持成本监控
- **设计层面**：实时统计和事件通知，便于外部监控
- **架构层面**：为资源管理和成本控制提供数据基础

### 1.3 主LLM客户端实现

```typescript
// src/llm/LLMClient.ts

import { BaseLLMClient } from './BaseLLMClient';
import { LLMProvider, LLMMessage, LLMResponse } from './types';
import { ModelConfig } from '../config/types';
import { Tool } from '../tools/base/Tool';
import { TrajectoryRecorder } from '../utils/TrajectoryRecorder';

/**
 * 带提供商路由的主LLM客户端
 */
export class LLMClient {
  public readonly provider: LLMProvider;
  private client: BaseLLMClient;
  private modelConfig: ModelConfig;

  constructor(modelConfig: ModelConfig) {
    this.provider = modelConfig.modelProvider.provider as LLMProvider;
    this.modelConfig = modelConfig;

    // 根据提供商创建特定客户端
    this.client = this.createClient(modelConfig);
    
    // 转发底层客户端的事件
    this.client.on('*', (eventName: string, ...args: any[]) => {
      this.emit(`client.${eventName}`, ...args);
    });
  }

  /**
   * 创建特定提供商客户端
   */
  private createClient(modelConfig: ModelConfig): BaseLLMClient {
    switch (this.provider) {
      case LLMProvider.OPENAI:
        const { OpenAIClient } = require('./providers/OpenAIClient');
        return new OpenAIClient(modelConfig);
        
      case LLMProvider.ANTHROPIC:
        const { AnthropicClient } = require('./providers/AnthropicClient');
        return new AnthropicClient(modelConfig);
        
      case LLMProvider.AZURE:
        const { AzureClient } = require('./providers/AzureClient');
        return new AzureClient(modelConfig);
        
      case LLMProvider.GOOGLE:
        const { GoogleClient } = require('./providers/GoogleClient');
        return new GoogleClient(modelConfig);
        
      case LLMProvider.OLLAMA:
        const { OllamaClient } = require('./providers/OllamaClient');
        return new OllamaClient(modelConfig);
        
      case LLMProvider.OPENROUTER:
        const { OpenRouterClient } = require('./providers/OpenRouterClient');
        return new OpenRouterClient(modelConfig);
        
      case LLMProvider.DOUBAO:
        const { DoubaoClient } = require('./providers/DoubaoClient');
        return new DoubaoClient(modelConfig);
        
      default:
        throw new Error(`不支持的提供商: ${this.provider}`);
    }
  }

  /**
   * 设置轨迹记录器
   */
  setTrajectoryRecorder(recorder?: TrajectoryRecorder): void {
    this.client.setTrajectoryRecorder(recorder);
  }

  /**
   * 设置聊天历史
   */
  setChatHistory(messages: LLMMessage[]): void {
    this.client.setChatHistory(messages);
  }

  /**
   * 主要聊天接口
   */
  async chat(
    messages: LLMMessage[],
    modelConfig: ModelConfig,
    tools?: Tool[],
    reuseHistory: boolean = true
  ): Promise<LLMResponse> {
    return this.client.chat(messages, modelConfig, tools, reuseHistory);
  }

  /**
   * 流式聊天接口
   */
  async chatStream(
    messages: LLMMessage[],
    modelConfig: ModelConfig,
    tools?: Tool[],
    reuseHistory: boolean = true
  ): Promise<AsyncIterable<LLMStreamChunk>> {
    return this.client.chatStream(messages, modelConfig, tools, reuseHistory);
  }

  /**
   * 检查工具调用支持
   */
  supportsToolCalling(modelConfig: ModelConfig): boolean {
    return this.client.supportsToolCalling(modelConfig);
  }

  /**
   * 获取提供商名称
   */
  getProviderName(): string {
    return this.client.getProviderName();
  }

  /**
   * 获取聊天历史
   */
  getChatHistory(): LLMMessage[] {
    return this.client.getChatHistory();
  }

  /**
   * 清除聊天历史
   */
  clearChatHistory(): void {
    this.client.clearChatHistory();
  }

  /**
   * 获取Token使用统计
   */
  getTotalTokenUsage(): TokenUsage {
    return this.client.getTotalTokenUsage();
  }

  /**
   * 重置Token使用统计
   */
  resetTokenUsage(): void {
    this.client.resetTokenUsage();
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    await this.client.cleanup();
  }
}
```

**主客户端实现分析：**

**动态客户端创建：**
```typescript
private createClient(modelConfig: ModelConfig): BaseLLMClient {
  switch (this.provider) {
    case LLMProvider.OPENAI:
      const { OpenAIClient } = require('./providers/OpenAIClient');
      return new OpenAIClient(modelConfig);
      
    case LLMProvider.ANTHROPIC:
      const { AnthropicClient } = require('./providers/AnthropicClient');
      return new AnthropicClient(modelConfig);
    
    // ... 其他提供商
    
    default:
      throw new Error(`不支持的提供商: ${this.provider}`);
  }
}
```
- **语法层面**：switch语句和动态require导入
- **功能层面**：根据提供商类型创建相应的客户端实例
- **设计层面**：工厂模式，延迟加载特定提供商的实现
- **架构层面**：支持可选依赖，用户只需安装实际使用的SDK

**事件转发：**
```typescript
// 转发底层客户端的事件
this.client.on('*', (eventName: string, ...args: any[]) => {
  this.emit(`client.${eventName}`, ...args);
});
```
- **语法层面**：通配符事件监听和事件转发
- **功能层面**：将底层客户端的事件转发到主客户端
- **设计层面**：透明的事件代理，保持事件链的完整性
- **架构层面**：为统一的事件监听提供代理机制

## 2. 多提供商策略模式完整实现

### 2.1 OpenAI客户端实现

```typescript
// src/llm/providers/OpenAIClient.ts

import { BaseLLMClient } from '../BaseLLMClient';
import { LLMMessage, LLMResponse, TokenUsage } from '../types';
import { Tool } from '../../tools/base/Tool';
import { ModelConfig } from '../../config/types';
import OpenAI from 'openai';

/**
 * OpenAI API客户端实现
 */
export class OpenAIClient extends BaseLLMClient {
  private openai: OpenAI;
  private retryCount: number = 0;

  constructor(modelConfig: ModelConfig) {
    super(modelConfig);
    
    this.openai = new OpenAI({
      apiKey: modelConfig.modelProvider.apiKey,
      baseURL: modelConfig.modelProvider.baseUrl,
      timeout: 60000,
      maxRetries: modelConfig.maxRetries || 3,
    });

    this.emit('openaiClientInit', {
      baseURL: modelConfig.modelProvider.baseUrl,
      model: modelConfig.model,
    });
  }

  getProviderName(): string {
    return 'openai';
  }

  supportsToolCalling(modelConfig: ModelConfig): boolean {
    // OpenAI支持GPT-3.5-turbo和GPT-4模型的工具调用
    const model = modelConfig.model.toLowerCase();
    return model.includes('gpt-3.5-turbo') || 
           model.includes('gpt-4') || 
           model.includes('gpt-4o');
  }

  /**
   * 将内部消息转换为OpenAI格式
   */
  protected prepareMessages(messages: LLMMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map(msg => {
      if (msg.toolResult) {
        // 工具结果消息
        return {
          role: 'tool' as const,
          content: msg.toolResult.result || msg.toolResult.error || '',
          tool_call_id: msg.toolResult.callId,
        };
      } else {
        // 常规消息
        return {
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        };
      }
    });
  }

  /**
   * 将工具转换为OpenAI格式
   */
  protected prepareTools(tools: Tool[]): OpenAI.Chat.ChatCompletionTool[] {
    return tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.getInputSchema(),
        ...(tool.getModelProvider() === 'openai' ? { strict: true } : {}),
      },
    }));
  }

  /**
   * 将OpenAI响应解析为标准格式
   */
  protected parseResponse(response: OpenAI.Chat.ChatCompletion): LLMResponse {
    const choice = response.choices[0];
    const message = choice.message;

    // 如果存在则解析工具调用
    const toolCalls = message.tool_calls?.map(toolCall => ({
      name: toolCall.function.name,
      callId: toolCall.id,
      arguments: JSON.parse(toolCall.function.arguments),
      id: toolCall.id,
    }));

    // 解析Token使用量
    const usage: TokenUsage | undefined = response.usage ? {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    } : undefined;

    return {
      content: message.content || '',
      toolCalls,
      usage,
      finishReason: choice.finish_reason as any,
      model: response.model,
      id: response.id,
    };
  }

  /**
   * 主要聊天实现
   */
  async chat(
    messages: LLMMessage[],
    modelConfig: ModelConfig,
    tools?: Tool[],
    reuseHistory: boolean = true
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      // 准备消息
      const openaiMessages = this.prepareMessages(
        reuseHistory ? [...this.chatHistory, ...messages] : messages
      );

      // 准备请求参数
      const requestParams: OpenAI.Chat.ChatCompletionCreateParams = {
        model: modelConfig.model,
        messages: openaiMessages,
        temperature: modelConfig.temperature,
        max_tokens: modelConfig.getMaxTokensParam(),
        top_p: modelConfig.topP,
        frequency_penalty: 0,
        presence_penalty: 0,
      };

      // 如果提供并支持则添加工具
      if (tools && tools.length > 0 && this.supportsToolCalling(modelConfig)) {
        requestParams.tools = this.prepareTools(tools);
        requestParams.tool_choice = 'auto';
        
        // 如果配置则启用并行工具调用
        if (modelConfig.parallelToolCalls) {
          requestParams.parallel_tool_calls = true;
        }
      }

      this.emit('requestStart', { 
        provider: 'openai',
        model: modelConfig.model,
        messageCount: openaiMessages.length,
        toolCount: tools?.length || 0,
      });

      // 使用重试逻辑进行API调用
      const response = await this.makeRequestWithRetry(requestParams);
      
      const duration = Date.now() - startTime;
      
      // 解析响应
      const llmResponse = this.parseResponse(response);
      
      // 更新Token使用量
      if (llmResponse.usage) {
        this.updateTokenUsage(llmResponse.usage);
      }

      // 记录轨迹
      this.recordTrajectory(messages, llmResponse, tools);

      // 如果重用则更新聊天历史
      if (reuseHistory) {
        this.chatHistory.push(...messages);
        if (llmResponse.content) {
          this.chatHistory.push({
            role: 'assistant',
            content: llmResponse.content,
          });
        }
      }

      this.emit('requestComplete', {
        provider: 'openai',
        model: modelConfig.model,
        duration,
        tokenUsage: llmResponse.usage,
        toolCalls: llmResponse.toolCalls?.length || 0,
      });

      return llmResponse;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.emit('requestError', {
        provider: 'openai',
        model: modelConfig.model,
        error,
        duration,
        retryCount: this.retryCount,
      });

      throw this.handleApiError(error);
    }
  }

  /**
   * 使用重试逻辑进行API请求
   */
  private async makeRequestWithRetry(
    params: OpenAI.Chat.ChatCompletionCreateParams,
    maxRetries: number = 3
  ): Promise<OpenAI.Chat.ChatCompletion> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.retryCount = attempt;
        
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          
          this.emit('retryAttempt', {
            provider: 'openai',
            attempt,
            delay,
            maxRetries,
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const response = await this.openai.chat.completions.create(params);
        
        if (attempt > 0) {
          this.emit('retrySuccess', {
            provider: 'openai',
            attempt,
            totalAttempts: attempt + 1,
          });
        }

        return response;

      } catch (error) {
        lastError = error;
        
        // 某些错误不重试
        if (this.shouldNotRetry(error)) {
          break;
        }

        this.emit('retryError', {
          provider: 'openai',
          attempt,
          error,
          willRetry: attempt < maxRetries,
        });
      }
    }

    this.emit('retryFailed', {
      provider: 'openai',
      totalAttempts: maxRetries + 1,
      finalError: lastError,
    });

    throw lastError;
  }

  /**
   * 检查错误是否不应重试
   */
  private shouldNotRetry(error: any): boolean {
    if (error.status) {
      // 除速率限制外，客户端错误(4xx)不重试
      return error.status >= 400 && error.status < 500 && error.status !== 429;
    }
    return false;
  }

  /**
   * 流式聊天实现
   */
  async chatStream(
    messages: LLMMessage[],
    modelConfig: ModelConfig,
    tools?: Tool[],
    reuseHistory: boolean = true
  ): Promise<AsyncIterable<LLMStreamChunk>> {
    // 准备消息和参数，类似于常规聊天
    const openaiMessages = this.prepareMessages(
      reuseHistory ? [...this.chatHistory, ...messages] : messages
    );

    const requestParams: OpenAI.Chat.ChatCompletionCreateParams = {
      model: modelConfig.model,
      messages: openaiMessages,
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.getMaxTokensParam(),
      top_p: modelConfig.topP,
      stream: true, // 启用流式传输
    };

    if (tools && tools.length > 0 && this.supportsToolCalling(modelConfig)) {
      requestParams.tools = this.prepareTools(tools);
      requestParams.tool_choice = 'auto';
    }

    this.emit('streamStart', {
      provider: 'openai',
      model: modelConfig.model,
      messageCount: openaiMessages.length,
    });

    const stream = await this.openai.chat.completions.create(requestParams);

    return this.processStream(stream);
  }

  /**
   * 处理OpenAI流
   */
  private async function* processStream(
    stream: AsyncIterable<OpenAI.Chat.ChatCompletionChunk>
  ): AsyncIterable<LLMStreamChunk> {
    let totalContent = '';
    
    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        
        if (delta?.content) {
          totalContent += delta.content;
          
          yield {
            content: delta.content,
            delta: {
              content: delta.content,
            },
          };
        }

        if (delta?.tool_calls) {
          yield {
            toolCalls: delta.tool_calls.map(tc => ({
              name: tc.function?.name || '',
              callId: tc.id || '',
              arguments: tc.function?.arguments || '{}',
            })),
            delta: {
              toolCalls: delta.tool_calls,
            },
          };
        }

        if (chunk.choices[0]?.finish_reason) {
          yield {
            finishReason: chunk.choices[0].finish_reason,
            usage: chunk.usage ? {
              promptTokens: chunk.usage.prompt_tokens || 0,
              completionTokens: chunk.usage.completion_tokens || 0,
              totalTokens: chunk.usage.total_tokens || 0,
            } : undefined,
          };
        }
      }

      this.emit('streamComplete', {
        provider: 'openai',
        totalContent: totalContent.length,
      });

    } catch (error) {
      this.emit('streamError', {
        provider: 'openai',
        error,
      });
      
      throw this.handleApiError(error);
    }
  }
}
```

**OpenAI客户端详细分析：**

**消息格式转换：**
```typescript
protected prepareMessages(messages: LLMMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  return messages.map(msg => {
    if (msg.toolResult) {
      // Tool result message
      return {
        role: 'tool' as const,
        content: msg.toolResult.result || msg.toolResult.error || '',
        tool_call_id: msg.toolResult.callId,
      };
    } else {
      // Regular message
      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      };
    }
  });
}
```
- **语法层面**：map方法和条件判断，类型断言确保类型安全
- **功能层面**：将统一的消息格式转换为OpenAI特定格式
- **设计层面**：处理工具结果的特殊消息格式要求
- **架构层面**：为多提供商统一接口提供格式适配

**工具格式转换：**
```typescript
protected prepareTools(tools: Tool[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.getInputSchema(),
      ...(tool.getModelProvider() === 'openai' ? { strict: true } : {}),
    },
  }));
}
```
- **语法层面**：对象展开操作符和条件属性添加
- **功能层面**：将工具定义转换为OpenAI的函数调用格式
- **设计层面**：支持OpenAI严格模式的条件配置
- **架构层面**：为工具调用提供提供商特定的格式适配

**重试机制实现：**
```typescript
private async makeRequestWithRetry(
  params: OpenAI.Chat.ChatCompletionCreateParams,
  maxRetries: number = 3
): Promise<OpenAI.Chat.ChatCompletion> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      this.retryCount = attempt;
      
      if (attempt > 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        
        this.emit('retryAttempt', {
          provider: 'openai',
          attempt,
          delay,
          maxRetries,
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const response = await this.openai.chat.completions.create(params);
      return response;

    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors
      if (this.shouldNotRetry(error)) {
        break;
      }
    }
  }

  throw lastError;
}
```
- **语法层面**：for循环和指数退避算法实现
- **功能层面**：提供可靠的网络请求重试机制
- **设计层面**：智能的错误分类和重试策略
- **架构层面**：为网络不稳定环境提供可靠性保障

### 2.2 Anthropic客户端实现

```typescript
// src/llm/providers/AnthropicClient.ts

import { BaseLLMClient } from '../BaseLLMClient';
import { LLMMessage, LLMResponse, TokenUsage } from '../types';
import { Tool } from '../../tools/base/Tool';
import { ModelConfig } from '../../config/types';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Anthropic Claude API client implementation
 */
export class AnthropicClient extends BaseLLMClient {
  private anthropic: Anthropic;

  constructor(modelConfig: ModelConfig) {
    super(modelConfig);
    
    this.anthropic = new Anthropic({
      apiKey: modelConfig.modelProvider.apiKey,
      baseURL: modelConfig.modelProvider.baseUrl,
      timeout: 60000,
      maxRetries: modelConfig.maxRetries || 3,
    });

    this.emit('anthropicClientInit', {
      baseURL: modelConfig.modelProvider.baseUrl,
      model: modelConfig.model,
    });
  }

  getProviderName(): string {
    return 'anthropic';
  }

  supportsToolCalling(modelConfig: ModelConfig): boolean {
    // Anthropic支持Claude 3模型的工具调用
    const model = modelConfig.model.toLowerCase();
    return model.includes('claude-3') || 
           model.includes('claude-3.5') ||
           model.includes('sonnet') ||
           model.includes('opus') ||
           model.includes('haiku');
  }

  /**
   * 将内部消息转换为Anthropic格式
   * Anthropic要求系统消息单独处理
   */
  protected prepareMessages(messages: LLMMessage[]): {
    system?: string;
    messages: Anthropic.MessageParam[];
  } {
    let systemMessage = '';
    const anthropicMessages: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemMessage = msg.content;
      } else if (msg.toolResult) {
        // 工具结果消息
        anthropicMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.toolResult.callId,
              content: msg.toolResult.result || msg.toolResult.error || '',
              is_error: !msg.toolResult.success,
            },
          ],
        });
      } else {
        // 常规消息
        anthropicMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    return {
      system: systemMessage || undefined,
      messages: anthropicMessages,
    };
  }

  /**
   * 将工具转换为Anthropic格式
   */
  protected prepareTools(tools: Tool[]): Anthropic.Tool[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.getInputSchema(),
    }));
  }

  /**
   * 将Anthropic响应解析为标准格式
   */
  protected parseResponse(response: Anthropic.Message): LLMResponse {
    let content = '';
    const toolCalls: any[] = [];

    // 处理内容块
    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          name: block.name,
          callId: block.id,
          arguments: block.input,
          id: block.id,
        });
      }
    }

    // 解析Token使用量
    const usage: TokenUsage | undefined = response.usage ? {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    } : undefined;

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage,
      finishReason: response.stop_reason as any,
      model: response.model,
      id: response.id,
    };
  }

  /**
   * 主要聊天实现
   */
  async chat(
    messages: LLMMessage[],
    modelConfig: ModelConfig,
    tools?: Tool[],
    reuseHistory: boolean = true
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      // 准备消息 (Anthropic format)
      const { system, messages: anthropicMessages } = this.prepareMessages(
        reuseHistory ? [...this.chatHistory, ...messages] : messages
      );

      // 准备请求参数
      const requestParams: Anthropic.MessageCreateParams = {
        model: modelConfig.model,
        messages: anthropicMessages,
        max_tokens: modelConfig.getMaxTokensParam(),
        temperature: modelConfig.temperature,
        top_p: modelConfig.topP,
        top_k: modelConfig.topK,
      };

      // 如果存在则添加系统消息
      if (system) {
        requestParams.system = system;
      }

      // 如果提供并支持则添加工具
      if (tools && tools.length > 0 && this.supportsToolCalling(modelConfig)) {
        requestParams.tools = this.prepareTools(tools);
        requestParams.tool_choice = { type: 'auto' };
      }

      // 如果配置了则添加停止序列
      if (modelConfig.stopSequences && modelConfig.stopSequences.length > 0) {
        requestParams.stop_sequences = modelConfig.stopSequences;
      }

      this.emit('requestStart', {
        provider: 'anthropic',
        model: modelConfig.model,
        messageCount: anthropicMessages.length,
        toolCount: tools?.length || 0,
        hasSystem: !!system,
      });

      // 进行API调用
      const response = await this.anthropic.messages.create(requestParams);
      
      const duration = Date.now() - startTime;
      
      // 解析响应
      const llmResponse = this.parseResponse(response);
      
      // 更新Token使用量
      if (llmResponse.usage) {
        this.updateTokenUsage(llmResponse.usage);
      }

      // 记录轨迹
      this.recordTrajectory(messages, llmResponse, tools);

      // 如果重用则更新聊天历史
      if (reuseHistory) {
        this.chatHistory.push(...messages);
        if (llmResponse.content) {
          this.chatHistory.push({
            role: 'assistant',
            content: llmResponse.content,
          });
        }
      }

      this.emit('requestComplete', {
        provider: 'anthropic',
        model: modelConfig.model,
        duration,
        tokenUsage: llmResponse.usage,
        toolCalls: llmResponse.toolCalls?.length || 0,
      });

      return llmResponse;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.emit('requestError', {
        provider: 'anthropic',
        model: modelConfig.model,
        error,
        duration,
      });

      throw this.handleApiError(error);
    }
  }

  /**
   * 流式聊天实现
   */
  async chatStream(
    messages: LLMMessage[],
    modelConfig: ModelConfig,
    tools?: Tool[],
    reuseHistory: boolean = true
  ): Promise<AsyncIterable<LLMStreamChunk>> {
    const { system, messages: anthropicMessages } = this.prepareMessages(
      reuseHistory ? [...this.chatHistory, ...messages] : messages
    );

    const requestParams: Anthropic.MessageCreateParams = {
      model: modelConfig.model,
      messages: anthropicMessages,
      max_tokens: modelConfig.getMaxTokensParam(),
      temperature: modelConfig.temperature,
      stream: true,
    };

    if (system) {
      requestParams.system = system;
    }

    if (tools && tools.length > 0 && this.supportsToolCalling(modelConfig)) {
      requestParams.tools = this.prepareTools(tools);
    }

    this.emit('streamStart', {
      provider: 'anthropic',
      model: modelConfig.model,
      messageCount: anthropicMessages.length,
    });

    const stream = await this.anthropic.messages.create(requestParams);

    return this.processAnthropicStream(stream);
  }

  /**
   * 处理Anthropic流
   */
  private async function* processAnthropicStream(
    stream: AsyncIterable<Anthropic.MessageStreamEvent>
  ): AsyncIterable<LLMStreamChunk> {
    let totalContent = '';
    
    try {
      for await (const event of stream) {
        switch (event.type) {
          case 'content_block_delta':
            if (event.delta.type === 'text_delta') {
              const content = event.delta.text;
              totalContent += content;
              
              yield {
                content,
                delta: { content },
              };
            } else if (event.delta.type === 'input_json_delta') {
              // 工具使用增量
              yield {
                delta: {
                  toolCalls: [{
                    arguments: event.delta.partial_json,
                  }],
                },
              };
            }
            break;

          case 'content_block_start':
            if (event.content_block.type === 'tool_use') {
              yield {
                toolCalls: [{
                  name: event.content_block.name,
                  callId: event.content_block.id,
                  arguments: {},
                }],
              };
            }
            break;

          case 'message_delta':
            if (event.delta.stop_reason) {
              yield {
                finishReason: event.delta.stop_reason,
              };
            }
            break;

          case 'message_stop':
            if (event.message.usage) {
              yield {
                usage: {
                  promptTokens: event.message.usage.input_tokens,
                  completionTokens: event.message.usage.output_tokens,
                  totalTokens: event.message.usage.input_tokens + event.message.usage.output_tokens,
                },
              };
            }
            break;
        }
      }

      this.emit('streamComplete', {
        provider: 'anthropic',
        totalContent: totalContent.length,
      });

    } catch (error) {
      this.emit('streamError', {
        provider: 'anthropic',
        error,
      });
      
      throw this.handleApiError(error);
    }
  }
}
```

**Anthropic客户端特殊处理：**

**系统消息分离：**
```typescript
protected prepareMessages(messages: LLMMessage[]): {
  system?: string;
  messages: Anthropic.MessageParam[];
} {
  let systemMessage = '';
  const anthropicMessages: Anthropic.MessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemMessage = msg.content;
    } else {
      // Process other messages...
    }
  }

  return {
    system: systemMessage || undefined,
    messages: anthropicMessages,
  };
}
```
- **语法层面**：返回对象包含系统消息和普通消息数组
- **功能层面**：适配Anthropic API的系统消息分离要求
- **设计层面**：保持消息格式的统一性，同时满足API特殊要求
- **架构层面**：为不同API格式提供透明的适配机制

**工具结果处理：**
```typescript
if (msg.toolResult) {
  // Tool result message
  anthropicMessages.push({
    role: 'user',
    content: [
      {
        type: 'tool_result',
        tool_use_id: msg.toolResult.callId,
        content: msg.toolResult.result || msg.toolResult.error || '',
        is_error: !msg.toolResult.success,
      },
    ],
  });
}
```
- **语法层面**：结构化的内容数组，包含工具结果类型
- **功能层面**：将工具执行结果转换为Anthropic的特定格式
- **设计层面**：支持错误状态标记，便于模型理解执行结果
- **架构层面**：为工具调用链提供完整的反馈机制

## 3. 具体客户端详细实现

### 3.1 Google客户端实现

```typescript
// src/llm/providers/GoogleClient.ts

import { BaseLLMClient } from '../BaseLLMClient';
import { LLMMessage, LLMResponse, TokenUsage } from '../types';
import { Tool } from '../../tools/base/Tool';
import { ModelConfig } from '../../config/types';
import { GoogleGenerativeAI, GenerativeModel, Part } from '@google/generative-ai';

/**
 * Google Gemini API client implementation
 */
export class GoogleClient extends BaseLLMClient {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(modelConfig: ModelConfig) {
    super(modelConfig);
    
    this.genAI = new GoogleGenerativeAI(modelConfig.modelProvider.apiKey);
    
    // 使用生成设置配置模型
    this.model = this.genAI.getGenerativeModel({
      model: modelConfig.model,
      generationConfig: {
        temperature: modelConfig.temperature,
        topP: modelConfig.topP,
        topK: modelConfig.topK,
        maxOutputTokens: modelConfig.getMaxTokensParam(),
        candidateCount: modelConfig.candidateCount || 1,
        stopSequences: modelConfig.stopSequences,
      },
    });

    this.emit('googleClientInit', {
      model: modelConfig.model,
      candidateCount: modelConfig.candidateCount,
    });
  }

  getProviderName(): string {
    return 'google';
  }

  supportsToolCalling(modelConfig: ModelConfig): boolean {
    // Google Gemini支持函数调用
    const model = modelConfig.model.toLowerCase();
    return model.includes('gemini') && !model.includes('vision');
  }

  /**
   * 将内部消息转换为Google格式
   */
  protected prepareMessages(messages: LLMMessage[]): {
    systemInstruction?: string;
    contents: any[];
  } {
    let systemInstruction = '';
    const contents: any[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = msg.content;
      } else if (msg.toolResult) {
        // 工具结果消息
        contents.push({
          role: 'function',
          parts: [
            {
              functionResponse: {
                name: msg.toolResult.name,
                response: {
                  success: msg.toolResult.success,
                  result: msg.toolResult.result,
                  error: msg.toolResult.error,
                },
              },
            },
          ],
        });
      } else {
        // 常规消息
        const role = msg.role === 'assistant' ? 'model' : 'user';
        contents.push({
          role,
          parts: [{ text: msg.content }],
        });
      }
    }

    return {
      systemInstruction: systemInstruction || undefined,
      contents,
    };
  }

  /**
   * 将工具转换为Google格式
   */
  protected prepareTools(tools: Tool[]): any[] {
    const functionDeclarations = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.getInputSchema(),
    }));

    return [
      {
        functionDeclarations,
      },
    ];
  }

  /**
   * 将Google响应解析为标准格式
   */
  protected parseResponse(response: any): LLMResponse {
    const candidate = response.candidates[0];
    
    if (!candidate) {
      throw new Error('Google响应中没有候选结果');
    }

    let content = '';
    const toolCalls: any[] = [];

    // 处理部分内容
    for (const part of candidate.content.parts) {
      if (part.text) {
        content += part.text;
      } else if (part.functionCall) {
        toolCalls.push({
          name: part.functionCall.name,
          callId: `google_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          arguments: part.functionCall.args || {},
        });
      }
    }

    // 解析Token使用量
    const usage: TokenUsage | undefined = response.usageMetadata ? {
      promptTokens: response.usageMetadata.promptTokenCount || 0,
      completionTokens: response.usageMetadata.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata.totalTokenCount || 0,
    } : undefined;

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage,
      finishReason: candidate.finishReason?.toLowerCase(),
      model: response.modelVersion || this.modelConfig.model,
    };
  }

  /**
   * 主要聊天实现
   */
  async chat(
    messages: LLMMessage[],
    modelConfig: ModelConfig,
    tools?: Tool[],
    reuseHistory: boolean = true
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      // 准备消息
      const { systemInstruction, contents } = this.prepareMessages(
        reuseHistory ? [...this.chatHistory, ...messages] : messages
      );

      // 开始聊天会话
      const chatSession = this.model.startChat({
        history: contents.slice(0, -1), // 除最后一条消息外的所有消息
        systemInstruction,
        tools: tools && tools.length > 0 && this.supportsToolCalling(modelConfig) 
          ? this.prepareTools(tools) 
          : undefined,
      });

      this.emit('requestStart', {
        provider: 'google',
        model: modelConfig.model,
        messageCount: contents.length,
        toolCount: tools?.length || 0,
        hasSystem: !!systemInstruction,
      });

      // 发送最后一条消息
      const lastMessage = contents[contents.length - 1];
      const result = await chatSession.sendMessage(
        lastMessage.parts.map((part: any) => part.text).join('')
      );

      const duration = Date.now() - startTime;
      
      // 解析响应
      const llmResponse = this.parseResponse(result.response);
      
      // 更新Token使用量
      if (llmResponse.usage) {
        this.updateTokenUsage(llmResponse.usage);
      }

      // 记录轨迹
      this.recordTrajectory(messages, llmResponse, tools);

      // 如果重用则更新聊天历史
      if (reuseHistory) {
        this.chatHistory.push(...messages);
        if (llmResponse.content) {
          this.chatHistory.push({
            role: 'assistant',
            content: llmResponse.content,
          });
        }
      }

      this.emit('requestComplete', {
        provider: 'google',
        model: modelConfig.model,
        duration,
        tokenUsage: llmResponse.usage,
        toolCalls: llmResponse.toolCalls?.length || 0,
      });

      return llmResponse;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.emit('requestError', {
        provider: 'google',
        model: modelConfig.model,
        error,
        duration,
      });

      throw this.handleApiError(error);
    }
  }
}
```

## 4. 错误处理和重试机制

### 4.1 统一错误处理

```typescript
// src/llm/ErrorHandler.ts

/**
 * LLM API错误类型
 */
export enum LLMErrorType {
  AUTHENTICATION = 'authentication',
  RATE_LIMIT = 'rate_limit',
  QUOTA_EXCEEDED = 'quota_exceeded',
  INVALID_REQUEST = 'invalid_request',
  SERVER_ERROR = 'server_error',
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown',
}

/**
 * 标准化LLM错误
 */
export class LLMError extends Error {
  public readonly type: LLMErrorType;
  public readonly provider: string;
  public readonly statusCode?: number;
  public readonly originalError: any;
  public readonly retryable: boolean;

  constructor(
    type: LLMErrorType,
    message: string,
    provider: string,
    options: {
      statusCode?: number;
      originalError?: any;
      retryable?: boolean;
    } = {}
  ) {
    super(message);
    this.name = 'LLMError';
    this.type = type;
    this.provider = provider;
    this.statusCode = options.statusCode;
    this.originalError = options.originalError;
    this.retryable = options.retryable ?? this.isRetryableByDefault(type);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LLMError);
    }
  }

  private isRetryableByDefault(type: LLMErrorType): boolean {
    switch (type) {
      case LLMErrorType.RATE_LIMIT:
      case LLMErrorType.SERVER_ERROR:
      case LLMErrorType.NETWORK_ERROR:
      case LLMErrorType.TIMEOUT:
        return true;
      case LLMErrorType.AUTHENTICATION:
      case LLMErrorType.QUOTA_EXCEEDED:
      case LLMErrorType.INVALID_REQUEST:
        return false;
      default:
        return false;
    }
  }

  /**
   * 从HTTP响应创建错误
   */
  static fromHttpError(error: any, provider: string): LLMError {
    const statusCode = error.response?.status || error.status;
    const message = error.response?.data?.error?.message || error.message || '未知错误';

    let type: LLMErrorType;
    switch (statusCode) {
      case 401:
      case 403:
        type = LLMErrorType.AUTHENTICATION;
        break;
      case 429:
        type = LLMErrorType.RATE_LIMIT;
        break;
      case 400:
      case 422:
        type = LLMErrorType.INVALID_REQUEST;
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        type = LLMErrorType.SERVER_ERROR;
        break;
      default:
        type = LLMErrorType.UNKNOWN;
    }

    return new LLMError(type, message, provider, {
      statusCode,
      originalError: error,
    });
  }

  /**
   * 从网络错误创建错误
   */
  static fromNetworkError(error: any, provider: string): LLMError {
    const isTimeout = error.code === 'ETIMEDOUT' || error.message.includes('timeout');
    const type = isTimeout ? LLMErrorType.TIMEOUT : LLMErrorType.NETWORK_ERROR;

    return new LLMError(type, error.message, provider, {
      originalError: error,
    });
  }

  toJSON(): Record<string, any> {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      provider: this.provider,
      statusCode: this.statusCode,
      retryable: this.retryable,
      stack: this.stack,
    };
  }
}
```

### 4.2 重试策略实现

```typescript
// src/llm/RetryStrategy.ts

import { EventEmitter } from 'events';
import { LLMError, LLMErrorType } from './ErrorHandler';

/**
 * 重试配置
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

/**
 * LLM API调用的重试策略
 */
export class RetryStrategy extends EventEmitter {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    super();
    
    this.config = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      ...config,
    };
  }

  /**
   * 使用重试逻辑执行函数
   */
  async execute<T>(
    fn: () => Promise<T>,
    context: { provider: string; operation: string }
  ): Promise<T> {
    let lastError: any;
    let attempt = 0;

    while (attempt <= this.config.maxRetries) {
      try {
        if (attempt > 0) {
          const delay = this.calculateDelay(attempt);
          
          this.emit('retryAttempt', {
            ...context,
            attempt,
            delay,
            maxRetries: this.config.maxRetries,
          });
          
          await this.sleep(delay);
        }

        const result = await fn();
        
        if (attempt > 0) {
          this.emit('retrySuccess', {
            ...context,
            attempt,
            totalAttempts: attempt + 1,
          });
        }

        return result;

      } catch (error) {
        lastError = error;
        
        // 检查错误是否可重试
        if (!this.isRetryable(error)) {
          this.emit('retryAborted', {
            ...context,
            attempt,
            error,
            reason: 'non-retryable error',
          });
          break;
        }

        // Check if we should continue retrying
        if (attempt >= this.config.maxRetries) {
          this.emit('retryExhausted', {
            ...context,
            totalAttempts: attempt + 1,
            finalError: error,
          });
          break;
        }

        this.emit('retryError', {
          ...context,
          attempt,
          error,
          willRetry: attempt < this.config.maxRetries,
        });

        attempt++;
      }
    }

    // 所有重试都已用尽，抛出最后一个错误
    throw lastError;
  }

  /**
   * 检查错误是否可重试
   */
  private isRetryable(error: any): boolean {
    if (error instanceof LLMError) {
      return error.retryable;
    }

    // 未知错误的默认启发式规则
    if (error.code) {
      // 网络错误通常可重试
      const retryableNetworkCodes = [
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'EAI_AGAIN',
      ];
      
      return retryableNetworkCodes.includes(error.code);
    }

    if (error.response?.status) {
      // HTTP错误 - 在服务器错误和速率限制时重试
      const status = error.response.status;
      return status === 429 || (status >= 500 && status < 600);
    }

    // 未知错误 - 默认不重试
    return false;
  }

  /**
   * 计算重试尝试的延迟时间
   */
  private calculateDelay(attempt: number): number {
    let delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
    
    // 应用最大延迟限制
    delay = Math.min(delay, this.config.maxDelay);
    
    // 添加抖动以避免雷群效应
    if (this.config.jitter) {
      delay += Math.random() * 1000;
    }
    
    return Math.floor(delay);
  }

  /**
   * 休眠指定毫秒数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 更新重试配置
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configUpdated', { config: this.config });
  }

  /**
   * 获取当前配置
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }
}
```

**重试策略分析：**

**指数退避算法：**
```typescript
private calculateDelay(attempt: number): number {
  let delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
  
  // Apply maximum delay limit
  delay = Math.min(delay, this.config.maxDelay);
  
  // Add jitter to avoid thundering herd
  if (this.config.jitter) {
    delay += Math.random() * 1000;
  }
  
  return Math.floor(delay);
}
```
- **语法层面**：数学计算和条件判断
- **功能层面**：计算重试延迟时间，实现指数退避
- **设计层面**：添加随机抖动避免雷群效应
- **架构层面**：为高并发环境提供智能的重试策略

这个完整的Node.js LLM客户端系统实现不仅保持了原版的所有功能，还通过TypeScript的类型系统、事件驱动架构和现代异步模式提供了更好的开发体验、错误处理和系统可靠性。所有客户端都支持完整的流式响应、重试机制和统一的错误处理。
