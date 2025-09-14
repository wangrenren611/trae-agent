# Trae Agent 工具系统 Node.js 完整实现

## 文档概述

本文档深入分析 Trae Agent 工具系统的 Node.js/TypeScript 完整实现，包括工具基类设计、工具执行器架构、以及各种具体工具的实现。每行代码都将从**语法**、**功能**、**设计**和**架构**四个层面进行详细分析，确保实现了原版所有功能。

## 目录

1. [工具基础架构 Node.js 实现](#1-工具基础架构-nodejs-实现)
2. [工具执行器完整实现](#2-工具执行器完整实现)
3. [具体工具实现详解](#3-具体工具实现详解)
4. [Docker工具执行器](#4-docker工具执行器)

---

## 1. 工具基础架构 Node.js 实现

### 1.1 核心类型定义

```typescript
// src/tools/base/types.ts

/**
 * 工具参数模式值类型
 */
export type ParamSchemaValue = string | string[] | boolean | Record<string, any>;

/**
 * 工具属性定义
 */
export type Property = Record<string, ParamSchemaValue>;

/**
 * 工具调用参数类型
 */
export type ToolCallArguments = Record<string, string | number | boolean | Record<string, any> | any[] | null>;
```

**类型定义分析：**

**ParamSchemaValue类型：**
```typescript
export type ParamSchemaValue = string | string[] | boolean | Record<string, any>;
```
- **语法层面**：使用联合类型定义多种可能的参数值类型
- **功能层面**：定义工具参数可以接受的所有数据类型
- **设计层面**：通过类型别名提高代码可读性，避免重复的复杂类型定义
- **架构层面**：为工具参数系统提供统一的类型约束，确保参数验证的一致性

**ToolCallArguments类型：**
```typescript
export type ToolCallArguments = Record<string, string | number | boolean | Record<string, any> | any[] | null>;
```
- **语法层面**：定义工具调用参数的完整类型结构
- **功能层面**：支持多种数据类型的参数传递
- **设计层面**：灵活的参数类型设计，支持复杂的工具调用场景
- **架构层面**：为工具系统提供类型安全的参数传递机制

### 1.2 工具错误类定义

```typescript
// src/tools/base/ToolError.ts

/**
 * 工具特定错误的基类
 */
export class ToolError extends Error {
  public readonly message: string;
  public readonly toolName?: string;
  public readonly errorCode?: number;

  constructor(message: string, toolName?: string, errorCode?: number) {
    super(message);
    this.name = 'ToolError';
    this.message = message;
    this.toolName = toolName;
    this.errorCode = errorCode;
    
    // 维护错误抛出位置的正确堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ToolError);
    }
  }

  /**
   * 创建具有特定错误代码的工具错误
   */
  static withCode(message: string, errorCode: number, toolName?: string): ToolError {
    return new ToolError(message, toolName, errorCode);
  }

  /**
   * 创建工具未找到错误
   */
  static toolNotFound(toolName: string): ToolError {
    return new ToolError(`工具 '${toolName}' 未找到`, toolName, 404);
  }

  /**
   * 创建无效参数错误
   */
  static invalidParameters(message: string, toolName?: string): ToolError {
    return new ToolError(`无效参数: ${message}`, toolName, 400);
  }

  /**
   * 转换为JSON用于序列化
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      toolName: this.toolName,
      errorCode: this.errorCode,
      stack: this.stack,
    };
  }
}
```

**工具错误类分析：**

**构造函数设计：**
```typescript
constructor(message: string, toolName?: string, errorCode?: number) {
  super(message);
  this.name = 'ToolError';
  this.message = message;
  this.toolName = toolName;
  this.errorCode = errorCode;
  
  // 维护错误抛出位置的正确堆栈跟踪
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, ToolError);
  }
}
```
- **语法层面**：继承Error类，设置可选参数和堆栈跟踪
- **功能层面**：创建专门的工具错误类型，包含工具名称和错误码
- **设计层面**：提供结构化的错误信息，便于错误处理和调试
- **架构层面**：为工具系统提供统一的错误处理机制

**静态工厂方法：**
```typescript
static withCode(message: string, errorCode: number, toolName?: string): ToolError {
  return new ToolError(message, toolName, errorCode);
}

static toolNotFound(toolName: string): ToolError {
  return new ToolError(`工具 '${toolName}' 未找到`, toolName, 404);
}
```
- **语法层面**：静态方法，返回类实例
- **功能层面**：提供常见错误场景的快速创建方法
- **设计层面**：工厂模式，简化错误对象创建
- **架构层面**：为不同错误场景提供标准化的错误对象

### 1.3 工具数据结构

```typescript
// src/tools/base/types.ts

/**
 * 工具参数定义
 */
export interface ToolParameter {
  name: string;
  type: string | string[];
  description: string;
  enum?: string[];
  items?: Record<string, any>;
  required: boolean;
}

/**
 * 工具执行结果（中间）
 */
export interface ToolExecResult {
  output?: string;
  error?: string;
  errorCode: number;
}

/**
 * 给LLM的最终工具结果
 */
export interface ToolResult {
  callId: string;
  name: string;
  success: boolean;
  result?: string;
  error?: string;
  id?: string;
}

/**
 * 工具调用表示
 */
export interface ToolCall {
  name: string;
  callId: string;
  arguments: ToolCallArguments;
  id?: string;
}
```

**数据结构设计分析：**

**ToolParameter接口：**
```typescript
export interface ToolParameter {
  name: string;
  type: string | string[];
  description: string;
  enum?: string[];
  items?: Record<string, any>;
  required: boolean;
}
```
- **语法层面**：接口定义，包含必需和可选字段
- **功能层面**：描述工具参数的完整定义
- **设计层面**：支持JSON Schema规范的参数描述
- **架构层面**：为工具参数验证和文档生成提供基础

**ToolExecResult接口：**
```typescript
export interface ToolExecResult {
  output?: string;
  error?: string;
  errorCode: number;
}
```
- **语法层面**：简洁的接口定义，errorCode为必需字段
- **功能层面**：表示工具执行的中间结果
- **设计层面**：分离成功输出和错误信息，使用错误码表示状态
- **架构层面**：为工具执行结果的标准化处理提供基础

### 1.4 工具基类实现

```typescript
// src/tools/base/Tool.ts

import { ToolParameter, ToolExecResult, ToolCallArguments, Property } from './types';

/**
 * 所有工具的抽象基类
 */
export abstract class Tool {
  protected modelProvider?: string;
  private _name?: string;
  private _description?: string;
  private _parameters?: ToolParameter[];

  constructor(modelProvider?: string) {
    this.modelProvider = modelProvider;
  }

  /**
   * 获取工具名称（缓存）
   */
  get name(): string {
    if (!this._name) {
      this._name = this.getName();
    }
    return this._name;
  }

  /**
   * 获取工具描述（缓存）
   */
  get description(): string {
    if (!this._description) {
      this._description = this.getDescription();
    }
    return this._description;
  }

  /**
   * 获取工具参数（缓存）
   */
  get parameters(): ToolParameter[] {
    if (!this._parameters) {
      this._parameters = this.getParameters();
    }
    return this._parameters;
  }

  /**
   * 获取模型提供商
   */
  getModelProvider(): string | undefined {
    return this.modelProvider;
  }

  // 子类必须实现的抽象方法
  abstract getName(): string;
  abstract getDescription(): string;
  abstract getParameters(): ToolParameter[];
  abstract execute(arguments: ToolCallArguments): Promise<ToolExecResult>;

  /**
   * 为LLM生成JSON定义
   */
  jsonDefinition(): Record<string, any> {
    return {
      name: this.name,
      description: this.description,
      parameters: this.getInputSchema(),
    };
  }

  /**
   * 为工具参数生成JSON模式
   */
  getInputSchema(): Record<string, any> {
    const schema: Record<string, any> = {
      type: 'object',
    };

    const properties: Record<string, Property> = {};
    const required: string[] = [];

    for (const param of this.parameters) {
      const paramSchema: Property = {
        type: param.type,
        description: param.description,
      };

      // 处理OpenAI严格模式要求
      if (this.modelProvider === 'openai') {
        required.push(param.name);
        if (!param.required) {
          // 为OpenAI严格模式使可选参数可为空
          const currentType = paramSchema.type;
          if (typeof currentType === 'string') {
            paramSchema.type = [currentType, 'null'];
          } else if (Array.isArray(currentType) && !currentType.includes('null')) {
            paramSchema.type = [...currentType, 'null'];
          }
        }
      } else if (param.required) {
        required.push(param.name);
      }

      // 如果指定则添加枚举值
      if (param.enum) {
        paramSchema.enum = param.enum;
      }

      // 为数组添加items模式
      if (param.items) {
        paramSchema.items = param.items;
      }

      // OpenAI要求对象的additionalProperties: false
      if (this.modelProvider === 'openai' && param.type === 'object') {
        paramSchema.additionalProperties = false;
      }

      properties[param.name] = paramSchema;
    }

    schema.properties = properties;
    if (required.length > 0) {
      schema.required = required;
    }

    // OpenAI要求在顶层additionalProperties: false
    if (this.modelProvider === 'openai') {
      schema.additionalProperties = false;
    }

    return schema;
  }

  /**
   * 验证工具参数
   */
  validateParameters(arguments: ToolCallArguments): void {
    const errors: string[] = [];

    // 检查必需参数
    for (const param of this.parameters) {
      if (param.required && !(param.name in arguments)) {
        errors.push(`缺少必需参数: ${param.name}`);
      }
    }

    // 检查参数类型（基本验证）
    for (const [key, value] of Object.entries(arguments)) {
      const param = this.parameters.find(p => p.name === key);
      if (!param) {
        errors.push(`未知参数: ${key}`);
        continue;
      }

      if (value !== null && value !== undefined) {
        const expectedType = Array.isArray(param.type) ? param.type[0] : param.type;
        const actualType = typeof value;
        
        if (expectedType === 'array' && !Array.isArray(value)) {
          errors.push(`参数 ${key} 应该是数组`);
        } else if (expectedType !== 'array' && expectedType !== actualType && actualType !== 'object') {
          errors.push(`参数 ${key} 应该是 ${expectedType} 类型，得到 ${actualType}`);
        }
      }
    }

    if (errors.length > 0) {
      throw ToolError.invalidParameters(errors.join(', '), this.name);
    }
  }

  /**
   * 清理工具资源
   */
  async close(): Promise<void> {
    // 默认实现 - 可以被子类重写
  }

  /**
   * 将工具转换为字符串表示
   */
  toString(): string {
    return `Tool(name=${this.name}, parameters=${this.parameters.length})`;
  }
}
```

**工具基类详细分析：**

**缓存属性实现：**
```typescript
get name(): string {
  if (!this._name) {
    this._name = this.getName();
  }
  return this._name;
}
```
- **语法层面**：使用getter语法和私有字段缓存
- **功能层面**：缓存工具名称，避免重复调用抽象方法
- **设计层面**：懒加载模式，只在首次访问时计算
- **架构层面**：优化性能，特别是对于频繁访问的属性

**JSON Schema生成：**
```typescript
getInputSchema(): Record<string, any> {
  const schema: Record<string, any> = {
    type: 'object',
  };

  const properties: Record<string, Property> = {};
  const required: string[] = [];

  for (const param of this.parameters) {
    const paramSchema: Property = {
      type: param.type,
      description: param.description,
    };
    
    // 处理OpenAI严格模式要求
    if (this.modelProvider === 'openai') {
      required.push(param.name);
      if (!param.required) {
        // 为OpenAI严格模式使可选参数可为空
        const currentType = paramSchema.type;
        if (typeof currentType === 'string') {
          paramSchema.type = [currentType, 'null'];
        }
      }
    }
    
    properties[param.name] = paramSchema;
  }
}
```
- **语法层面**：for-of循环和对象构建
- **功能层面**：将工具参数定义转换为JSON Schema格式
- **设计层面**：支持不同LLM提供商的特殊要求
- **架构层面**：为工具调用提供标准化的参数描述

**参数验证：**
```typescript
validateParameters(arguments: ToolCallArguments): void {
  const errors: string[] = [];

  // 检查必需参数
  for (const param of this.parameters) {
    if (param.required && !(param.name in arguments)) {
      errors.push(`缺少必需参数: ${param.name}`);
    }
  }

  // 检查参数类型（基本验证）
  for (const [key, value] of Object.entries(arguments)) {
    const param = this.parameters.find(p => p.name === key);
    if (!param) {
      errors.push(`未知参数: ${key}`);
      continue;
    }
    // ... 类型验证逻辑
  }

  if (errors.length > 0) {
    throw ToolError.invalidParameters(errors.join(', '), this.name);
  }
}
```
- **语法层面**：参数遍历和类型检查
- **功能层面**：验证工具调用参数的完整性和正确性
- **设计层面**：收集所有错误后统一抛出，提供完整的错误信息
- **架构层面**：为工具执行提供输入验证保障

## 2. 工具执行器完整实现

### 2.1 工具执行器类定义

```typescript
// src/tools/base/ToolExecutor.ts

import { Tool } from './Tool';
import { ToolCall, ToolResult, ToolExecResult } from './types';
import { ToolError } from './ToolError';
import { EventEmitter } from 'events';

/**
 * 管理工具执行并支持事件的工具执行器
 */
export class ToolExecutor extends EventEmitter {
  private tools: Tool[];
  private toolMap?: Map<string, Tool>;

  constructor(tools: Tool[]) {
    super();
    this.tools = tools;
    this.validateTools();
  }

  /**
   * 验证所有工具都正确配置
   */
  private validateTools(): void {
    const toolNames = new Set<string>();
    
    for (const tool of this.tools) {
      if (toolNames.has(tool.name)) {
        throw new Error(`重复的工具名称: ${tool.name}`);
      }
      toolNames.add(tool.name);
    }

    this.emit('toolsValidated', { toolCount: this.tools.length, toolNames: Array.from(toolNames) });
  }

  /**
   * 获取标准化的工具名称（小写，无下划线）
   */
  private normalizeToolName(name: string): string {
    return name.toLowerCase().replace(/_/g, '');
  }

  /**
   * 获取工具映射（缓存）
   */
  private getToolMap(): Map<string, Tool> {
    if (!this.toolMap) {
      this.toolMap = new Map();
      for (const tool of this.tools) {
        const normalizedName = this.normalizeToolName(tool.name);
        this.toolMap.set(normalizedName, tool);
      }
    }
    return this.toolMap;
  }

  /**
   * 获取所有可用工具
   */
  getTools(): Tool[] {
    return [...this.tools];
  }

  /**
   * 按名称获取工具
   */
  getTool(name: string): Tool | undefined {
    const normalizedName = this.normalizeToolName(name);
    return this.getToolMap().get(normalizedName);
  }

  /**
   * 检查工具是否存在
   */
  hasTool(name: string): boolean {
    return this.getTool(name) !== undefined;
  }

  /**
   * 执行单个工具调用
   */
  async executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
    const startTime = Date.now();
    
    this.emit('toolCallStart', { toolCall, startTime });

    const normalizedName = this.normalizeToolName(toolCall.name);
    const tool = this.getToolMap().get(normalizedName);

    if (!tool) {
      const error = ToolError.toolNotFound(toolCall.name);
      const result: ToolResult = {
        name: toolCall.name,
        success: false,
        error: error.message,
        callId: toolCall.callId,
        id: toolCall.id,
      };

      this.emit('toolCallError', { toolCall, error, result, duration: Date.now() - startTime });
      return result;
    }

    try {
      // 验证参数
      tool.validateParameters(toolCall.arguments);

      this.emit('toolExecutionStart', { toolCall, tool, startTime });

      // 执行工具
      const execResult: ToolExecResult = await tool.execute(toolCall.arguments);
      
      const result: ToolResult = {
        name: toolCall.name,
        success: execResult.errorCode === 0,
        result: execResult.output,
        error: execResult.error,
        callId: toolCall.callId,
        id: toolCall.id,
      };

      const duration = Date.now() - startTime;

      if (result.success) {
        this.emit('toolCallSuccess', { toolCall, tool, result, duration });
      } else {
        this.emit('toolCallFailure', { toolCall, tool, result, duration });
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const result: ToolResult = {
        name: toolCall.name,
        success: false,
        error: `执行工具 '${toolCall.name}' 时出错: ${errorMessage}`,
        callId: toolCall.callId,
        id: toolCall.id,
      };

      this.emit('toolCallError', { 
        toolCall, 
        tool, 
        error, 
        result, 
        duration: Date.now() - startTime 
      });

      return result;
    }
  }

  /**
   * 并行执行多个工具调用
   */
  async parallelToolCall(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    if (toolCalls.length === 0) {
      return [];
    }

    this.emit('parallelExecutionStart', { toolCalls, count: toolCalls.length });

    const startTime = Date.now();
    const promises = toolCalls.map(call => this.executeToolCall(call));
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    this.emit('parallelExecutionComplete', { 
      toolCalls, 
      results, 
      duration,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length
    });

    return results;
  }

  /**
   * 顺序执行多个工具调用
   */
  async sequentialToolCall(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    if (toolCalls.length === 0) {
      return [];
    }

    this.emit('sequentialExecutionStart', { toolCalls, count: toolCalls.length });

    const results: ToolResult[] = [];
    const startTime = Date.now();

    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i];
      
      this.emit('sequentialToolStart', { toolCall, index: i, total: toolCalls.length });
      
      const result = await this.executeToolCall(toolCall);
      results.push(result);
      
      this.emit('sequentialToolComplete', { 
        toolCall, 
        result, 
        index: i, 
        total: toolCalls.length 
      });
    }

    const duration = Date.now() - startTime;

    this.emit('sequentialExecutionComplete', { 
      toolCalls, 
      results, 
      duration,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length
    });

    return results;
  }

  /**
   * 关闭所有工具并清理资源
   */
  async closeTools(): Promise<void[]> {
    this.emit('toolsCloseStart', { toolCount: this.tools.length });

    const closePromises = this.tools.map(async (tool, index) => {
      try {
        await tool.close();
        this.emit('toolClosed', { tool, index });
      } catch (error) {
        this.emit('toolCloseError', { tool, index, error });
        throw error;
      }
    });

    const results = await Promise.allSettled(closePromises);
    
    this.emit('toolsCloseComplete', { 
      toolCount: this.tools.length,
      successCount: results.filter(r => r.status === 'fulfilled').length,
      failureCount: results.filter(r => r.status === 'rejected').length
    });

    return results.map(result => 
      result.status === 'fulfilled' ? result.value : undefined
    ).filter(Boolean) as void[];
  }

  /**
   * 获取执行统计信息
   */
  getStats(): Record<string, any> {
    return {
      toolCount: this.tools.length,
      toolNames: this.tools.map(t => t.name),
      modelProviders: [...new Set(this.tools.map(t => t.getModelProvider()).filter(Boolean))],
    };
  }
}
```

**工具执行器详细分析：**

**工具验证：**
```typescript
private validateTools(): void {
  const toolNames = new Set<string>();
  
  for (const tool of this.tools) {
    if (toolNames.has(tool.name)) {
      throw new Error(`重复的工具名称: ${tool.name}`);
    }
    toolNames.add(tool.name);
  }

  this.emit('toolsValidated', { toolCount: this.tools.length, toolNames: Array.from(toolNames) });
}
```
- **语法层面**：使用Set检查重复，for-of循环遍历工具
- **功能层面**：验证工具配置的唯一性和有效性
- **设计层面**：在构造时进行验证，早期发现配置问题
- **架构层面**：确保工具系统的一致性和可靠性

**并行执行：**
```typescript
async parallelToolCall(toolCalls: ToolCall[]): Promise<ToolResult[]> {
  if (toolCalls.length === 0) {
    return [];
  }

  this.emit('parallelExecutionStart', { toolCalls, count: toolCalls.length });

  const startTime = Date.now();
  const promises = toolCalls.map(call => this.executeToolCall(call));
  const results = await Promise.all(promises);
  const duration = Date.now() - startTime;

  this.emit('parallelExecutionComplete', { 
    toolCalls, 
    results, 
    duration,
    successCount: results.filter(r => r.success).length,
    failureCount: results.filter(r => !r.success).length
  });

  return results;
}
```
- **语法层面**：Promise.all并发执行，map创建Promise数组
- **功能层面**：同时执行多个工具调用，提高执行效率
- **设计层面**：完整的事件通知和统计信息
- **架构层面**：为高性能工具执行提供并发支持

**顺序执行：**
```typescript
async sequentialToolCall(toolCalls: ToolCall[]): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  const startTime = Date.now();

  for (let i = 0; i < toolCalls.length; i++) {
    const toolCall = toolCalls[i];
    
    this.emit('sequentialToolStart', { toolCall, index: i, total: toolCalls.length });
    
    const result = await this.executeToolCall(toolCall);
    results.push(result);
    
    this.emit('sequentialToolComplete', { 
      toolCall, 
      result, 
      index: i, 
      total: toolCalls.length 
    });
  }

  return results;
}
```
- **语法层面**：for循环和await顺序执行
- **功能层面**：按顺序逐个执行工具调用
- **设计层面**：详细的进度通知和索引跟踪
- **架构层面**：为有依赖关系的工具调用提供顺序保证

## 3. 具体工具实现详解

### 3.1 Bash工具实现

```typescript
// src/tools/BashTool.ts

import { Tool } from './base/Tool';
import { ToolParameter, ToolExecResult, ToolCallArguments } from './base/types';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

/**
 * 用于执行bash命令的工具
 */
export class BashTool extends Tool {
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private eventEmitter: EventEmitter = new EventEmitter();

  constructor(modelProvider?: string) {
    super(modelProvider);
  }

  getName(): string {
    return 'bash';
  }

  getDescription(): string {
    return '在系统中执行bash命令。使用此工具运行shell命令、脚本和系统操作。';
  }

  getParameters(): ToolParameter[] {
    return [
      {
        name: 'command',
        type: 'string',
        description: '要执行的bash命令',
        required: true,
      },
      {
        name: 'working_directory',
        type: 'string',
        description: '命令执行的工作目录',
        required: false,
      },
      {
        name: 'timeout',
        type: 'number',
        description: '命令超时时间（毫秒）（默认：30000）',
        required: false,
      },
      {
        name: 'capture_output',
        type: 'boolean',
        description: '是否捕获并返回命令输出（默认：true）',
        required: false,
      },
    ];
  }

  async execute(arguments: ToolCallArguments): Promise<ToolExecResult> {
    const command = arguments.command as string;
    const workingDirectory = arguments.working_directory as string | undefined;
    const timeout = (arguments.timeout as number) || 30000;
    const captureOutput = arguments.capture_output !== false;

    if (!command || typeof command !== 'string') {
      return {
        error: '命令参数是必需的且必须是字符串',
        errorCode: 1,
      };
    }

    // 对危险命令进行安全检查
    if (this.isDangerousCommand(command)) {
      return {
        error: `出于安全原因拒绝命令: ${command}`,
        errorCode: 403,
      };
    }

    const processId = `bash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const result = await this.executeCommand(
        command,
        workingDirectory,
        timeout,
        captureOutput,
        processId
      );

      return {
        output: result.output,
        errorCode: result.exitCode,
        error: result.error,
      };

    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        errorCode: 1,
      };
    } finally {
      this.activeProcesses.delete(processId);
    }
  }

  /**
   * 使用适当的进程管理执行命令
   */
  private async executeCommand(
    command: string,
    workingDirectory?: string,
    timeout: number = 30000,
    captureOutput: boolean = true,
    processId: string = 'default'
  ): Promise<{ output: string; error?: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const shell = process.platform === 'win32' ? 'cmd' : 'bash';
      const shellArgs = process.platform === 'win32' ? ['/c', command] : ['-c', command];

      const childProcess = spawn(shell, shellArgs, {
        cwd: workingDirectory,
        stdio: captureOutput ? 'pipe' : 'inherit',
        env: { ...process.env },
      });

      this.activeProcesses.set(processId, childProcess);

      let stdout = '';
      let stderr = '';

      if (captureOutput) {
        childProcess.stdout?.on('data', (data) => {
          stdout += data.toString();
          this.eventEmitter.emit('stdout', { processId, data: data.toString() });
        });

        childProcess.stderr?.on('data', (data) => {
          stderr += data.toString();
          this.eventEmitter.emit('stderr', { processId, data: data.toString() });
        });
      }

      // 设置超时
      const timeoutHandle = setTimeout(() => {
        childProcess.kill('SIGTERM');
        
        // 5秒后强制终止
        setTimeout(() => {
          if (!childProcess.killed) {
            childProcess.kill('SIGKILL');
          }
        }, 5000);
        
        reject(new Error(`命令在 ${timeout}ms 后超时: ${command}`));
      }, timeout);

      childProcess.on('close', (code) => {
        clearTimeout(timeoutHandle);
        this.activeProcesses.delete(processId);

        const exitCode = code || 0;
        const output = stdout.trim();
        const error = stderr.trim() || undefined;

        this.eventEmitter.emit('processComplete', { 
          processId, 
          command, 
          exitCode, 
          output, 
          error 
        });

        resolve({ output, error, exitCode });
      });

      childProcess.on('error', (error) => {
        clearTimeout(timeoutHandle);
        this.activeProcesses.delete(processId);
        
        this.eventEmitter.emit('processError', { processId, command, error });
        reject(error);
      });

      this.eventEmitter.emit('processStart', { processId, command, workingDirectory });
    });
  }

  /**
   * 检查命令是否包含危险操作
   */
  private isDangerousCommand(command: string): boolean {
    const dangerousPatterns = [
      /rm\s+-rf\s+\//, // rm -rf /
      /:\(\)\{.*\}/, // Fork bomb pattern
      /mkfs/, // Format filesystem
      /dd\s+if=.*of=\/dev/, // Direct disk write
      /shutdown/, // System shutdown
      /reboot/, // System reboot
      /halt/, // System halt
      /init\s+0/, // System shutdown via init
      /kill\s+-9\s+1/, // Kill init process
    ];

    return dangerousPatterns.some(pattern => pattern.test(command));
  }

  /**
   * 终止所有活动进程
   */
  async killAllProcesses(): Promise<void> {
    const killPromises = Array.from(this.activeProcesses.entries()).map(
      async ([processId, process]) => {
        try {
          process.kill('SIGTERM');
          
          // 等待一下，如果仍在运行则强制终止
          setTimeout(() => {
            if (!process.killed) {
              process.kill('SIGKILL');
            }
          }, 5000);
          
          this.eventEmitter.emit('processKilled', { processId });
        } catch (error) {
          this.eventEmitter.emit('processKillError', { processId, error });
        }
      }
    );

    await Promise.allSettled(killPromises);
    this.activeProcesses.clear();
  }

  /**
   * 获取活动进程数量
   */
  getActiveProcessCount(): number {
    return this.activeProcesses.size;
  }

  /**
   * 监听进程事件
   */
  on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * 清理资源
   */
  async close(): Promise<void> {
    await this.killAllProcesses();
    this.eventEmitter.removeAllListeners();
  }
}
```

**Bash工具详细分析：**

**安全检查：**
```typescript
private isDangerousCommand(command: string): boolean {
  const dangerousPatterns = [
    /rm\s+-rf\s+\//, // rm -rf /
    /:\(\)\{.*\}/, // Fork bomb pattern
    /mkfs/, // Format filesystem
    /dd\s+if=.*of=\/dev/, // Direct disk write
    /shutdown/, // System shutdown
    // ... more patterns
  ];

  return dangerousPatterns.some(pattern => pattern.test(command));
}
```
- **语法层面**：正则表达式数组和some方法检查
- **功能层面**：检测和阻止危险的系统命令
- **设计层面**：白名单安全模型，预防恶意命令执行
- **架构层面**：为系统安全提供重要的防护机制

**进程管理：**
```typescript
private async executeCommand(
  command: string,
  workingDirectory?: string,
  timeout: number = 30000,
  captureOutput: boolean = true,
  processId: string = 'default'
): Promise<{ output: string; error?: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const shell = process.platform === 'win32' ? 'cmd' : 'bash';
    const shellArgs = process.platform === 'win32' ? ['/c', command] : ['-c', command];

    const childProcess = spawn(shell, shellArgs, {
      cwd: workingDirectory,
      stdio: captureOutput ? 'pipe' : 'inherit',
      env: { ...process.env },
    });

    this.activeProcesses.set(processId, childProcess);
    
    // ... 进程处理逻辑
  });
}
```
- **语法层面**：Promise包装和spawn函数调用
- **功能层面**：跨平台的命令执行，支持工作目录和环境变量
- **设计层面**：完整的进程生命周期管理，包括超时和强制终止
- **架构层面**：为系统集成提供可靠的命令执行能力

### 3.2 文件编辑工具实现

```typescript
// src/tools/EditTool.ts

import { Tool } from './base/Tool';
import { ToolParameter, ToolExecResult, ToolCallArguments } from './base/types';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 使用字符串替换编辑文件的工具
 */
export class EditTool extends Tool {
  constructor(modelProvider?: string) {
    super(modelProvider);
  }

  getName(): string {
    return 'str_replace_based_edit_tool';
  }

  getDescription(): string {
    return '通过替换特定文本内容来编辑文件。此工具允许您通过指定要替换的确切文本和新内容来对文件进行精确编辑。';
  }

  getParameters(): ToolParameter[] {
    return [
      {
        name: 'command',
        type: 'string',
        description: '要执行的编辑命令',
        enum: ['str_replace', 'view', 'create'],
        required: true,
      },
      {
        name: 'path',
        type: 'string',
        description: '要编辑的文件路径',
        required: true,
      },
      {
        name: 'old_str',
        type: 'string',
        description: '要替换的确切字符串（str_replace必需）',
        required: false,
      },
      {
        name: 'new_str',
        type: 'string',
        description: '要替换的新字符串（str_replace必需）',
        required: false,
      },
      {
        name: 'file_text',
        type: 'string',
        description: '新文件的内容（create必需）',
        required: false,
      },
      {
        name: 'view_range',
        type: 'array',
        description: '要查看的行范围 [start, end]（view可选）',
        items: { type: 'number' },
        required: false,
      },
    ];
  }

  async execute(arguments: ToolCallArguments): Promise<ToolExecResult> {
    const command = arguments.command as string;
    const filePath = arguments.path as string;

    if (!command || !filePath) {
      return {
        error: '命令和路径参数是必需的',
        errorCode: 1,
      };
    }

    try {
      switch (command) {
        case 'view':
          return await this.viewFile(filePath, arguments.view_range as number[]);
        
        case 'str_replace':
          return await this.replaceString(
            filePath,
            arguments.old_str as string,
            arguments.new_str as string
          );
        
        case 'create':
          return await this.createFile(filePath, arguments.file_text as string);
        
        default:
          return {
            error: `未知命令: ${command}`,
            errorCode: 1,
          };
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        errorCode: 1,
      };
    }
  }

  /**
   * 查看文件内容，可选择行范围
   */
  private async viewFile(filePath: string, viewRange?: number[]): Promise<ToolExecResult> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');

      let displayContent: string;
      let startLine = 1;
      let endLine = lines.length;

      if (viewRange && Array.isArray(viewRange) && viewRange.length === 2) {
        startLine = Math.max(1, viewRange[0]);
        endLine = Math.min(lines.length, viewRange[1]);
        
        const selectedLines = lines.slice(startLine - 1, endLine);
        displayContent = selectedLines
          .map((line, index) => `${startLine + index}|${line}`)
          .join('\n');
      } else {
        displayContent = lines
          .map((line, index) => `${index + 1}|${line}`)
          .join('\n');
      }

      return {
        output: `文件: ${filePath} (行 ${startLine}-${endLine})\n${displayContent}`,
        errorCode: 0,
      };

    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          error: `文件未找到: ${filePath}`,
          errorCode: 2,
        };
      }
      throw error;
    }
  }

  /**
   * 替换文件中的字符串
   */
  private async replaceString(
    filePath: string,
    oldStr: string,
    newStr: string
  ): Promise<ToolExecResult> {
    if (!oldStr) {
      return {
        error: 'str_replace命令需要old_str参数',
        errorCode: 1,
      };
    }

    if (newStr === undefined) {
      return {
        error: 'str_replace命令需要new_str参数',
        errorCode: 1,
      };
    }

    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      if (!content.includes(oldStr)) {
        return {
          error: `文件中未找到字符串: "${oldStr}"`,
          errorCode: 3,
        };
      }

      // 计算出现次数
      const occurrences = (content.match(new RegExp(this.escapeRegex(oldStr), 'g')) || []).length;
      
      if (occurrences > 1) {
        return {
          error: `字符串 "${oldStr}" 在文件中出现 ${occurrences} 次。请更具体地匹配恰好一次出现。`,
          errorCode: 4,
        };
      }

      const newContent = content.replace(oldStr, newStr);
      await fs.writeFile(filePath, newContent, 'utf8');

      return {
        output: `成功替换 ${filePath} 中的字符串`,
        errorCode: 0,
      };

    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          error: `文件未找到: ${filePath}`,
          errorCode: 2,
        };
      }
      throw error;
    }
  }

  /**
   * 创建包含内容的新文件
   */
  private async createFile(filePath: string, fileText: string): Promise<ToolExecResult> {
    if (fileText === undefined) {
      return {
        error: 'create命令需要file_text参数',
        errorCode: 1,
      };
    }

    try {
      // 检查文件是否已存在
      try {
        await fs.access(filePath);
        return {
          error: `文件已存在: ${filePath}`,
          errorCode: 5,
        };
      } catch {
        // 文件不存在，这正是我们想要的
      }

      // 确保目录存在
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(filePath, fileText, 'utf8');

      return {
        output: `成功创建文件: ${filePath}`,
        errorCode: 0,
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * 转义特殊正则表达式字符
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
```

**文件编辑工具分析：**

**多命令支持：**
```typescript
switch (command) {
  case 'view':
    return await this.viewFile(filePath, arguments.view_range as number[]);
  
  case 'str_replace':
    return await this.replaceString(
      filePath,
      arguments.old_str as string,
      arguments.new_str as string
    );
  
  case 'create':
    return await this.createFile(filePath, arguments.file_text as string);
  
  default:
    return {
            error: `未知命令: ${command}`,
      errorCode: 1,
    };
}
```
- **语法层面**：switch语句处理不同的编辑命令
- **功能层面**：支持文件查看、字符串替换和文件创建
- **设计层面**：统一的工具接口支持多种操作模式
- **架构层面**：为文件操作提供完整的功能集合

**精确替换验证：**
```typescript
if (!content.includes(oldStr)) {
  return {
    error: `文件中未找到字符串: "${oldStr}"`,
    errorCode: 3,
  };
}

// Count occurrences
const occurrences = (content.match(new RegExp(this.escapeRegex(oldStr), 'g')) || []).length;

if (occurrences > 1) {
  return {
    error: `字符串 "${oldStr}" 在文件中出现 ${occurrences} 次。请更具体地匹配恰好一次出现。`,
    errorCode: 4,
  };
}
```
- **语法层面**：字符串包含检查和正则表达式匹配计数
- **功能层面**：确保字符串替换的精确性，避免意外的多处替换
- **设计层面**：严格的验证逻辑，保证文件编辑的安全性
- **架构层面**：为代码编辑提供可靠的精确性保障

## 4. Docker工具执行器

### 4.1 Docker工具执行器实现

```typescript
// src/tools/DockerToolExecutor.ts

import { ToolExecutor } from './base/ToolExecutor';
import { ToolCall, ToolResult } from './base/types';
import { DockerManager } from '../utils/DockerManager';
import { EventEmitter } from 'events';

/**
 * 在Docker容器中运行特定工具的工具执行器
 */
export class DockerToolExecutor extends EventEmitter {
  private originalExecutor: ToolExecutor;
  private dockerManager: DockerManager;
  private dockerTools: Set<string>;
  private hostWorkspaceDir: string;
  private containerWorkspaceDir: string;

  constructor(options: {
    originalExecutor: ToolExecutor;
    dockerManager: DockerManager;
    dockerTools: string[];
    hostWorkspaceDir: string;
    containerWorkspaceDir: string;
  }) {
    super();
    
    this.originalExecutor = options.originalExecutor;
    this.dockerManager = options.dockerManager;
    this.dockerTools = new Set(options.dockerTools.map(name => name.toLowerCase().replace(/_/g, '')));
    this.hostWorkspaceDir = options.hostWorkspaceDir;
    this.containerWorkspaceDir = options.containerWorkspaceDir;

    this.emit('dockerToolExecutorInit', {
      dockerTools: Array.from(this.dockerTools),
      hostWorkspaceDir: this.hostWorkspaceDir,
      containerWorkspaceDir: this.containerWorkspaceDir,
    });
  }

  /**
   * 执行工具调用，路由到Docker或本地执行
   */
  async executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
    const normalizedName = toolCall.name.toLowerCase().replace(/_/g, '');
    const shouldUseDocker = this.dockerTools.has(normalizedName);

    this.emit('toolCallRouting', {
      toolCall,
      normalizedName,
      shouldUseDocker,
      dockerTools: Array.from(this.dockerTools),
    });

    if (shouldUseDocker) {
      return await this.executeInDocker(toolCall);
    } else {
      return await this.originalExecutor.executeToolCall(toolCall);
    }
  }

  /**
   * 在Docker容器内执行工具调用
   */
  private async executeInDocker(toolCall: ToolCall): Promise<ToolResult> {
    const startTime = Date.now();
    
    this.emit('dockerExecutionStart', { toolCall, startTime });

    try {
      // 确保Docker容器正在运行
      if (!this.dockerManager.isRunning()) {
        await this.dockerManager.start();
      }

      // 准备工具执行命令
      const toolCommand = this.buildToolCommand(toolCall);
      
      this.emit('dockerCommandPrepared', { toolCall, toolCommand });

      // 在容器中执行
      const result = await this.dockerManager.executeCommand(toolCommand, {
        workingDirectory: this.containerWorkspaceDir,
        timeout: 300000, // 5分钟超时
      });

      const toolResult: ToolResult = {
        name: toolCall.name,
        success: result.exitCode === 0,
        result: result.stdout,
        error: result.stderr || undefined,
        callId: toolCall.callId,
        id: toolCall.id,
      };

      const duration = Date.now() - startTime;

      this.emit('dockerExecutionComplete', { 
        toolCall, 
        toolResult, 
        duration,
        exitCode: result.exitCode 
      });

      return toolResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const toolResult: ToolResult = {
        name: toolCall.name,
        success: false,
        error: `Docker执行失败: ${errorMessage}`,
        callId: toolCall.callId,
        id: toolCall.id,
      };

      this.emit('dockerExecutionError', { 
        toolCall, 
        error, 
        toolResult, 
        duration 
      });

      return toolResult;
    }
  }

  /**
   * 为Docker构建工具执行命令
   */
  private buildToolCommand(toolCall: ToolCall): string {
    const toolName = toolCall.name;
    const args = JSON.stringify(toolCall.arguments);
    
    // 将工具名称映射到容器中的可执行命令
    const toolCommands: Record<string, string> = {
      'bash': `echo '${args.replace(/'/g, "'\\''")}' | python3 /tools/bash_tool.py`,
      'str_replace_based_edit_tool': `echo '${args.replace(/'/g, "'\\''")}' | python3 /tools/edit_tool.py`,
      'json_edit_tool': `echo '${args.replace(/'/g, "'\\''")}' | python3 /tools/json_edit_tool.py`,
    };

    const command = toolCommands[toolName];
    if (!command) {
      throw new Error(`未找到工具的Docker命令映射: ${toolName}`);
    }

    return command;
  }

  /**
   * 并行执行多个工具调用
   */
  async parallelToolCall(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    if (toolCalls.length === 0) {
      return [];
    }

    this.emit('parallelExecutionStart', { toolCalls, count: toolCalls.length });

    const startTime = Date.now();
    const promises = toolCalls.map(call => this.executeToolCall(call));
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    this.emit('parallelExecutionComplete', { 
      toolCalls, 
      results, 
      duration,
      dockerExecutions: results.filter((_, index) => {
        const normalizedName = toolCalls[index].name.toLowerCase().replace(/_/g, '');
        return this.dockerTools.has(normalizedName);
      }).length,
    });

    return results;
  }

  /**
   * 顺序执行多个工具调用
   */
  async sequentialToolCall(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    if (toolCalls.length === 0) {
      return [];
    }

    this.emit('sequentialExecutionStart', { toolCalls, count: toolCalls.length });

    const results: ToolResult[] = [];
    const startTime = Date.now();

    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i];
      
      this.emit('sequentialToolStart', { toolCall, index: i, total: toolCalls.length });
      
      const result = await this.executeToolCall(toolCall);
      results.push(result);
      
      this.emit('sequentialToolComplete', { 
        toolCall, 
        result, 
        index: i, 
        total: toolCalls.length 
      });
    }

    const duration = Date.now() - startTime;

    this.emit('sequentialExecutionComplete', { 
      toolCalls, 
      results, 
      duration,
      dockerExecutions: results.filter((_, index) => {
        const normalizedName = toolCalls[index].name.toLowerCase().replace(/_/g, '');
        return this.dockerTools.has(normalizedName);
      }).length,
    });

    return results;
  }

  /**
   * 关闭所有工具并清理Docker资源
   */
  async closeTools(): Promise<void[]> {
    this.emit('dockerToolsCloseStart');

    try {
      // 关闭原始执行器工具
      const results = await this.originalExecutor.closeTools();
      
      // 如需要则清理Docker管理器
      if (this.dockerManager && this.dockerManager.isRunning()) {
        await this.dockerManager.cleanup();
      }

      this.emit('dockerToolsCloseComplete');
      return results;

    } catch (error) {
      this.emit('dockerToolsCloseError', { error });
      throw error;
    }
  }

  /**
   * 获取执行统计信息
   */
  getStats(): Record<string, any> {
    return {
      ...this.originalExecutor.getStats(),
      dockerTools: Array.from(this.dockerTools),
      dockerManagerRunning: this.dockerManager?.isRunning() || false,
      hostWorkspaceDir: this.hostWorkspaceDir,
      containerWorkspaceDir: this.containerWorkspaceDir,
    };
  }
}
```

**Docker工具执行器分析：**

**路由决策：**
```typescript
async executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
  const normalizedName = toolCall.name.toLowerCase().replace(/_/g, '');
  const shouldUseDocker = this.dockerTools.has(normalizedName);

  this.emit('toolCallRouting', {
    toolCall,
    normalizedName,
    shouldUseDocker,
    dockerTools: Array.from(this.dockerTools),
  });

  if (shouldUseDocker) {
    return await this.executeInDocker(toolCall);
  } else {
    return await this.originalExecutor.executeToolCall(toolCall);
  }
}
```
- **语法层面**：条件判断和方法调用路由
- **功能层面**：根据工具类型决定执行环境
- **设计层面**：透明的执行环境切换，保持接口一致性
- **架构层面**：为混合执行环境提供智能路由机制

**Docker命令构建：**
```typescript
private buildToolCommand(toolCall: ToolCall): string {
  const toolName = toolCall.name;
  const args = JSON.stringify(toolCall.arguments);
  
  // Map tool names to their executable commands in the container
  const toolCommands: Record<string, string> = {
    'bash': `echo '${args.replace(/'/g, "'\\''")}' | python3 /tools/bash_tool.py`,
    'str_replace_based_edit_tool': `echo '${args.replace(/'/g, "'\\''")}' | python3 /tools/edit_tool.py`,
    'json_edit_tool': `echo '${args.replace(/'/g, "'\\''")}' | python3 /tools/json_edit_tool.py`,
  };

  const command = toolCommands[toolName];
  if (!command) {
    throw new Error(`未找到工具的Docker命令映射: ${toolName}`);
  }

  return command;
}
```
- **语法层面**：字符串模板和参数转义处理
- **功能层面**：将工具调用转换为容器内的执行命令
- **设计层面**：映射表模式，支持不同工具的命令定制
- **架构层面**：为容器化工具提供标准化的执行接口

这个完整的Node.js工具系统实现不仅保持了原版的所有功能，还通过TypeScript的类型系统、事件驱动架构和现代异步模式提供了更好的开发体验和系统可靠性。所有工具都支持完整的参数验证、错误处理和资源管理。
