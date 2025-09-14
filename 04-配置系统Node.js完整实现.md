# Trae Agent 配置系统 Node.js 完整实现

## 文档概述

本文档深入分析 Trae Agent 配置系统的 Node.js/TypeScript 完整实现，包括配置数据结构设计、优先级解析机制、YAML配置处理、以及配置验证逻辑。每行代码都将进行详细的技术分析和设计思路解读，确保实现了原版所有功能。

## 目录

1. [配置数据结构 Node.js 实现](#1-配置数据结构-nodejs-实现)
2. [配置优先级解析完整实现](#2-配置优先级解析完整实现)
3. [YAML配置处理详细实现](#3-yaml配置处理详细实现)
4. [配置验证和类型安全](#4-配置验证和类型安全)

---

## 1. 配置数据结构 Node.js 实现

### 1.1 基础配置接口定义

```typescript
// src/config/types.ts

/**
 * 模型提供商配置
 */
export interface ModelProvider {
  apiKey: string;
  provider: string;
  baseUrl?: string;
  apiVersion?: string;
  organization?: string; // OpenAI特定
  projectId?: string; // Google特定
  region?: string; // Azure特定
}

/**
 * 包含综合设置的模型配置
 */
export interface ModelConfig {
  model: string;
  modelProvider: ModelProvider;
  temperature: number;
  topP: number;
  topK: number;
  parallelToolCalls: boolean;
  maxRetries: number;
  maxTokens?: number; // 遗留参数
  supportsToolCalling: boolean;
  candidateCount?: number; // Google特定
  stopSequences?: string[];
  maxCompletionTokens?: number; // Azure OpenAI特定
  presencePenalty?: number; // OpenAI特定
  frequencyPenalty?: number; // OpenAI特定
  
  // 参数解析方法
  getMaxTokensParam(): number;
  shouldUseMaxCompletionTokens(): boolean;
  resolveConfigValues(options: ConfigResolveOptions): void;
}

/**
 * 配置解析选项
 */
export interface ConfigResolveOptions {
  modelProviders?: Record<string, ModelProvider>;
  provider?: string;
  model?: string;
  modelBaseUrl?: string;
  apiKey?: string;
}
```

**接口设计详细分析：**

**ModelProvider接口：**
```typescript
export interface ModelProvider {
  apiKey: string;
  provider: string;
  baseUrl?: string;
  apiVersion?: string;
  organization?: string; // OpenAI特定
  projectId?: string; // Google特定
  region?: string; // Azure特定
}
```
- **语法层面**：接口定义，包含必需和可选字段，使用注释标明特定用途
- **功能层面**：定义LLM提供商的完整连接信息
- **设计层面**：支持多种提供商的特殊字段，通过可选属性提供灵活性
- **架构层面**：为多提供商架构提供统一而灵活的配置基础

**ModelConfig接口方法：**
```typescript
// 参数解析方法
getMaxTokensParam(): number;
shouldUseMaxCompletionTokens(): boolean;
resolveConfigValues(options: ConfigResolveOptions): void;
```
- **语法层面**：接口中定义的方法签名
- **功能层面**：提供配置参数的解析和处理方法
- **设计层面**：将配置逻辑封装为方法，提高代码的可维护性
- **架构层面**：为配置的动态处理和版本兼容提供接口

### 1.2 配置类实现

```typescript
// src/config/ModelConfig.ts

import { ModelConfig, ModelProvider, ConfigResolveOptions } from './types';
import { ConfigError } from './ConfigError';

/**
 * 具有全面参数处理的模型配置实现
 */
export class ModelConfigImpl implements ModelConfig {
  model: string;
  modelProvider: ModelProvider;
  temperature: number;
  topP: number;
  topK: number;
  parallelToolCalls: boolean;
  maxRetries: number;
  maxTokens?: number;
  supportsToolCalling: boolean = true;
  candidateCount?: number;
  stopSequences?: string[];
  maxCompletionTokens?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;

  constructor(config: Partial<ModelConfig> & Pick<ModelConfig, 'model' | 'modelProvider'>) {
    // 验证必需字段
    if (!config.model) {
      throw new ConfigError('模型名称是必需的');
    }
    if (!config.modelProvider) {
      throw new ConfigError('模型提供商配置是必需的');
    }

    // 设置必需字段
    this.model = config.model;
    this.modelProvider = { ...config.modelProvider };

    // 为可选字段设置默认值
    this.temperature = config.temperature ?? 0.5;
    this.topP = config.topP ?? 1.0;
    this.topK = config.topK ?? 0;
    this.parallelToolCalls = config.parallelToolCalls ?? true;
    this.maxRetries = config.maxRetries ?? 3;
    this.supportsToolCalling = config.supportsToolCalling ?? true;

    // 设置可选字段
    this.maxTokens = config.maxTokens;
    this.candidateCount = config.candidateCount;
    this.stopSequences = config.stopSequences ? [...config.stopSequences] : undefined;
    this.maxCompletionTokens = config.maxCompletionTokens;
    this.presencePenalty = config.presencePenalty;
    this.frequencyPenalty = config.frequencyPenalty;

    // 验证配置
    this.validateConfiguration();
  }

  /**
   * 获取具有优先级处理的最大令牌参数
   */
  getMaxTokensParam(): number {
    // 优先级: maxCompletionTokens > maxTokens > 默认值
    if (this.maxCompletionTokens !== undefined) {
      return this.maxCompletionTokens;
    } else if (this.maxTokens !== undefined) {
      return this.maxTokens;
    } else {
      // 根据模型返回默认值
      return this.getDefaultMaxTokens();
    }
  }

  /**
   * 确定是否应使用max_completion_tokens参数
   */
  shouldUseMaxCompletionTokens(): boolean {
    return (
      this.maxCompletionTokens !== undefined &&
      this.modelProvider.provider === 'azure' &&
      this.isNewGenerationModel()
    );
  }

  /**
   * 检查这是否是支持max_completion_tokens的新一代模型
   */
  private isNewGenerationModel(): boolean {
    const model = this.model.toLowerCase();
    return (
      model.includes('gpt-4o') ||
      model.includes('gpt-5') ||
      model.includes('o3') ||
      model.includes('o4-mini') ||
      model.includes('claude-3.5') ||
      model.includes('gemini-2')
    );
  }

  /**
   * 根据模型获取默认最大令牌数
   */
  private getDefaultMaxTokens(): number {
    const model = this.model.toLowerCase();
    
    // 模型特定的默认值
    if (model.includes('gpt-4')) {
      return 8192;
    } else if (model.includes('gpt-3.5')) {
      return 4096;
    } else if (model.includes('claude')) {
      return 4096;
    } else if (model.includes('gemini')) {
      return 8192;
    } else {
      return 4096; // 通用默认值
    }
  }

  /**
   * 使用优先级处理解析配置值
   */
  resolveConfigValues(options: ConfigResolveOptions): void {
    const {
      modelProviders,
      provider,
      model,
      modelBaseUrl,
      apiKey,
    } = options;

    // 如果提供则解析模型名称
    if (model !== undefined) {
      this.model = resolveConfigValue({
        cliValue: model,
        configValue: this.model,
      }) as string;
    }

    // 处理提供商变更
    if (provider) {
      this.handleProviderChange(provider, modelProviders, apiKey, modelBaseUrl);
    }

    // 使用环境变量支持解析API密钥和基础URL
    this.resolveProviderCredentials(apiKey, modelBaseUrl);

    // 变更后重新验证
    this.validateConfiguration();
  }

  /**
   * 处理提供商变更并进行验证
   */
  private handleProviderChange(
    provider: string,
    modelProviders?: Record<string, ModelProvider>,
    apiKey?: string,
    modelBaseUrl?: string
  ): void {
    if (modelProviders && provider in modelProviders) {
      // 使用现有的提供商配置
      this.modelProvider = { ...modelProviders[provider] };
    } else if (apiKey) {
      // 创建新的提供商配置
      this.modelProvider = {
        apiKey,
        provider,
        baseUrl: modelBaseUrl,
      };
    } else {
      throw new ConfigError(
        `要注册新的模型提供商 '${provider}'，必须提供API密钥`
      );
    }
  }

  /**
   * 使用环境变量解析提供商凭据
   */
  private resolveProviderCredentials(apiKey?: string, modelBaseUrl?: string): void {
    const providerUpper = this.modelProvider.provider.toUpperCase();
    const envVarApiKey = `${providerUpper}_API_KEY`;
    const envVarBaseUrl = `${providerUpper}_BASE_URL`;

    // 解析API密钥
    const resolvedApiKey = resolveConfigValue({
      cliValue: apiKey,
      configValue: this.modelProvider.apiKey,
      envVar: envVarApiKey,
    });

    if (resolvedApiKey) {
      this.modelProvider.apiKey = resolvedApiKey as string;
    }

    // 解析基础URL
    const resolvedBaseUrl = resolveConfigValue({
      cliValue: modelBaseUrl,
      configValue: this.modelProvider.baseUrl,
      envVar: envVarBaseUrl,
    });

    if (resolvedBaseUrl) {
      this.modelProvider.baseUrl = resolvedBaseUrl as string;
    }
  }

  /**
   * 验证配置参数
   */
  private validateConfiguration(): void {
    const errors: string[] = [];

    // 验证温度参数
    if (this.temperature < 0 || this.temperature > 2) {
      errors.push('温度必须在0和2之间');
    }

    // 验证topP参数
    if (this.topP < 0 || this.topP > 1) {
      errors.push('Top-p必须在0和1之间');
    }

    // 验证topK参数
    if (this.topK < 0) {
      errors.push('Top-k必须为非负数');
    }

    // 验证最大重试次数
    if (this.maxRetries < 0 || this.maxRetries > 10) {
      errors.push('最大重试次数必须在0和10之间');
    }

    // 验证令牌限制
    if (this.maxTokens !== undefined && this.maxTokens <= 0) {
      errors.push('最大令牌数必须为正数');
    }

    if (this.maxCompletionTokens !== undefined && this.maxCompletionTokens <= 0) {
      errors.push('最大完成令牌数必须为正数');
    }

    // 验证提供商特定约束
    this.validateProviderConstraints(errors);

    if (errors.length > 0) {
      throw new ConfigError(`配置验证失败: ${errors.join(', ')}`);
    }
  }

  /**
   * 验证提供商特定约束
   */
  private validateProviderConstraints(errors: string[]): void {
    const provider = this.modelProvider.provider.toLowerCase();

    switch (provider) {
      case 'openai':
        this.validateOpenAIConstraints(errors);
        break;
      case 'anthropic':
        this.validateAnthropicConstraints(errors);
        break;
      case 'google':
        this.validateGoogleConstraints(errors);
        break;
      case 'azure':
        this.validateAzureConstraints(errors);
        break;
    }
  }

  /**
   * 验证OpenAI特定约束
   */
  private validateOpenAIConstraints(errors: string[]): void {
    // 验证存在惩罚和频率惩罚
    if (this.presencePenalty !== undefined) {
      if (this.presencePenalty < -2 || this.presencePenalty > 2) {
        errors.push('OpenAI存在惩罚必须在-2和2之间');
      }
    }

    if (this.frequencyPenalty !== undefined) {
      if (this.frequencyPenalty < -2 || this.frequencyPenalty > 2) {
        errors.push('OpenAI频率惩罚必须在-2和2之间');
      }
    }

    // 如果存在则验证组织
    if (this.modelProvider.organization && typeof this.modelProvider.organization !== 'string') {
      errors.push('OpenAI组织必须是字符串');
    }
  }

  /**
   * 验证Anthropic特定约束
   */
  private validateAnthropicConstraints(errors: string[]): void {
    // Anthropic有特定的温度范围
    if (this.temperature > 1) {
      errors.push('Anthropic模型建议温度 <= 1');
    }

    // 验证停止序列
    if (this.stopSequences && this.stopSequences.length > 4) {
      errors.push('Anthropic最多支持4个停止序列');
    }
  }

  /**
   * 验证Google特定约束
   */
  private validateGoogleConstraints(errors: string[]): void {
    // 验证候选数量
    if (this.candidateCount !== undefined) {
      if (this.candidateCount < 1 || this.candidateCount > 8) {
        errors.push('Google候选数量必须在1和8之间');
      }
    }

    // 如果存在则验证项目ID
    if (this.modelProvider.projectId && typeof this.modelProvider.projectId !== 'string') {
      errors.push('Google项目ID必须是字符串');
    }
  }

  /**
   * 验证Azure特定约束
   */
  private validateAzureConstraints(errors: string[]): void {
    // Azure需要API版本
    if (!this.modelProvider.apiVersion) {
      errors.push('Azure提供商需要API版本');
    }

    // 如果存在则验证区域
    if (this.modelProvider.region && typeof this.modelProvider.region !== 'string') {
      errors.push('Azure区域必须是字符串');
    }
  }

  /**
   * 克隆配置
   */
  clone(): ModelConfigImpl {
    return new ModelConfigImpl({
      model: this.model,
      modelProvider: { ...this.modelProvider },
      temperature: this.temperature,
      topP: this.topP,
      topK: this.topK,
      parallelToolCalls: this.parallelToolCalls,
      maxRetries: this.maxRetries,
      maxTokens: this.maxTokens,
      supportsToolCalling: this.supportsToolCalling,
      candidateCount: this.candidateCount,
      stopSequences: this.stopSequences ? [...this.stopSequences] : undefined,
      maxCompletionTokens: this.maxCompletionTokens,
      presencePenalty: this.presencePenalty,
      frequencyPenalty: this.frequencyPenalty,
    });
  }

  /**
   * 转换为JSON用于序列化
   */
  toJSON(): Record<string, any> {
    return {
      model: this.model,
      modelProvider: this.modelProvider,
      temperature: this.temperature,
      topP: this.topP,
      topK: this.topK,
      parallelToolCalls: this.parallelToolCalls,
      maxRetries: this.maxRetries,
      maxTokens: this.maxTokens,
      supportsToolCalling: this.supportsToolCalling,
      candidateCount: this.candidateCount,
      stopSequences: this.stopSequences,
      maxCompletionTokens: this.maxCompletionTokens,
      presencePenalty: this.presencePenalty,
      frequencyPenalty: this.frequencyPenalty,
    };
  }
}
```

**配置类实现详细分析：**

**构造函数验证：**
```typescript
constructor(config: Partial<ModelConfig> & Pick<ModelConfig, 'model' | 'modelProvider'>) {
  // 验证必需字段
  if (!config.model) {
    throw new ConfigError('Model name is required');
  }
  if (!config.modelProvider) {
    throw new ConfigError('Model provider configuration is required');
  }

  // 设置必需字段
  this.model = config.model;
  this.modelProvider = { ...config.modelProvider };
```
- **语法层面**：使用交叉类型确保必需字段存在，对象展开复制避免引用共享
- **功能层面**：验证必需参数并安全复制配置对象
- **设计层面**：早期验证模式，在对象创建时就确保配置正确性
- **架构层面**：为配置系统提供类型安全和数据完整性保障

**参数优先级处理：**
```typescript
getMaxTokensParam(): number {
  // Priority: maxCompletionTokens > maxTokens > default
  if (this.maxCompletionTokens !== undefined) {
    return this.maxCompletionTokens;
  } else if (this.maxTokens !== undefined) {
    return this.maxTokens;
  } else {
    // Return default value based on model
    return this.getDefaultMaxTokens();
  }
}
```
- **语法层面**：条件判断链实现优先级选择
- **功能层面**：处理新旧参数的兼容性，提供智能默认值
- **设计层面**：向后兼容设计，支持API版本演进
- **架构层面**：为参数迁移和版本升级提供平滑过渡

**配置验证机制：**
```typescript
private validateConfiguration(): void {
  const errors: string[] = [];

  // Validate temperature
  if (this.temperature < 0 || this.temperature > 2) {
    errors.push('Temperature must be between 0 and 2');
  }

  // Validate topP
  if (this.topP < 0 || this.topP > 1) {
    errors.push('Top-p must be between 0 and 1');
  }

  // ... 更多验证

  // Validate provider-specific constraints
  this.validateProviderConstraints(errors);

  if (errors.length > 0) {
    throw new ConfigError(`Configuration validation failed: ${errors.join(', ')}`);
  }
}
```
- **语法层面**：错误收集模式，最后统一抛出包含所有错误的异常
- **功能层面**：全面验证配置参数的有效性和合理性
- **设计层面**：提供完整的错误信息，便于用户定位和修复问题
- **架构层面**：为系统稳定性提供输入验证保障

## 2. 配置优先级解析完整实现

### 2.1 配置优先级解析函数

```typescript
// src/config/ConfigResolver.ts

/**
 * 配置值解析选项
 */
export interface ConfigValueOptions<T> {
  cliValue?: T;
  configValue?: T;
  envVar?: string;
  defaultValue?: T;
  validator?: (value: T) => boolean;
  transformer?: (value: any) => T;
}

/**
 * 按优先级解析配置值：CLI > ENV > Config > Default
 */
export function resolveConfigValue<T>(options: ConfigValueOptions<T>): T | undefined {
  const {
    cliValue,
    configValue,
    envVar,
    defaultValue,
    validator,
    transformer,
  } = options;

  // 验证和转换值的辅助函数
  const processValue = (value: any, source: string): T | undefined => {
    if (value === undefined || value === null) {
      return undefined;
    }

    let processedValue = value;

    // 如果提供则应用转换器
    if (transformer) {
      try {
        processedValue = transformer(value);
      } catch (error) {
        throw new ConfigError(
          `转换${source}值失败: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // 如果提供则应用验证器
    if (validator && !validator(processedValue)) {
      throw new ConfigError(`Invalid ${source} value: ${processedValue}`);
    }

    return processedValue;
  };

  // 优先级1：CLI参数具有最高优先级
  if (cliValue !== undefined) {
    const result = processValue(cliValue, 'CLI');
    if (result !== undefined) {
      return result;
    }
  }

  // 优先级2：环境变量具有第二优先级
  if (envVar) {
    const envValue = process.env[envVar];
    if (envValue !== undefined) {
      const result = processValue(envValue, 'environment variable');
      if (result !== undefined) {
        return result;
      }
    }
  }

  // 优先级3：配置文件值具有第三优先级
  if (configValue !== undefined) {
    const result = processValue(configValue, 'configuration file');
    if (result !== undefined) {
      return result;
    }
  }

  // 优先级4：默认值作为后备
  if (defaultValue !== undefined) {
    const result = processValue(defaultValue, 'default');
    if (result !== undefined) {
      return result;
    }
  }

  // 未找到值
  return undefined;
}

/**
 * 解析字符串配置值
 */
export function resolveStringConfig(options: Omit<ConfigValueOptions<string>, 'transformer'>): string | undefined {
  return resolveConfigValue({
    ...options,
    transformer: (value: any) => String(value),
  });
}

/**
 * 解析数字配置值
 */
export function resolveNumberConfig(options: Omit<ConfigValueOptions<number>, 'transformer'>): number | undefined {
  return resolveConfigValue({
    ...options,
    transformer: (value: any) => {
      const num = Number(value);
      if (isNaN(num)) {
        throw new Error(`无法将"${value}"转换为数字`);
      }
      return num;
    },
  });
}

/**
 * 解析布尔配置值
 */
export function resolveBooleanConfig(options: Omit<ConfigValueOptions<boolean>, 'transformer'>): boolean | undefined {
  return resolveConfigValue({
    ...options,
    transformer: (value: any) => {
      if (typeof value === 'boolean') {
        return value;
      }
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'true' || lower === '1' || lower === 'yes') {
          return true;
        }
        if (lower === 'false' || lower === '0' || lower === 'no') {
          return false;
        }
      }
      if (typeof value === 'number') {
        return value !== 0;
      }
      throw new Error(`无法将"${value}"转换为布尔值`);
    },
  });
}

/**
 * 解析数组配置值
 */
export function resolveArrayConfig<T>(
  options: Omit<ConfigValueOptions<T[]>, 'transformer'> & {
    itemTransformer?: (item: any) => T;
    separator?: string;
  }
): T[] | undefined {
  const { itemTransformer, separator = ',', ...resolveOptions } = options;

  return resolveConfigValue({
    ...resolveOptions,
    transformer: (value: any) => {
      if (Array.isArray(value)) {
        return itemTransformer ? value.map(itemTransformer) : value;
      }
      if (typeof value === 'string') {
        const items = value.split(separator).map(item => item.trim()).filter(Boolean);
        return itemTransformer ? items.map(itemTransformer) : items as T[];
      }
      throw new Error(`无法将"${value}"转换为数组`);
    },
  });
}
```

**配置解析函数详细分析：**

**通用解析函数：**
```typescript
export function resolveConfigValue<T>(options: ConfigValueOptions<T>): T | undefined {
  const {
    cliValue,
    configValue,
    envVar,
    defaultValue,
    validator,
    transformer,
  } = options;

  // 验证和转换值的辅助函数
  const processValue = (value: any, source: string): T | undefined => {
    if (value === undefined || value === null) {
      return undefined;
    }

    let processedValue = value;

    // 如果提供则应用转换器
    if (transformer) {
      try {
        processedValue = transformer(value);
      } catch (error) {
        throw new ConfigError(
          `转换${source}值失败: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // 如果提供则应用验证器
    if (validator && !validator(processedValue)) {
      throw new ConfigError(`Invalid ${source} value: ${processedValue}`);
    }

    return processedValue;
  };
```
- **语法层面**：泛型函数定义，内部辅助函数，完整的错误处理
- **功能层面**：提供配置值的转换、验证和优先级处理
- **设计层面**：可扩展的处理流程，支持自定义转换和验证逻辑
- **架构层面**：为配置系统提供统一而灵活的值处理机制

**类型特化函数：**
```typescript
export function resolveNumberConfig(options: Omit<ConfigValueOptions<number>, 'transformer'>): number | undefined {
  return resolveConfigValue({
    ...options,
    transformer: (value: any) => {
      const num = Number(value);
      if (isNaN(num)) {
        throw new Error(`无法将"${value}"转换为数字`);
      }
      return num;
    },
  });
}
```
- **语法层面**：使用Omit类型排除transformer字段，提供特定的转换逻辑
- **功能层面**：为常见数据类型提供专门的解析函数
- **设计层面**：类型安全的转换，提供清晰的错误信息
- **架构层面**：为不同数据类型提供标准化的处理方式

### 2.2 高级配置解析器

```typescript
// src/config/AdvancedConfigResolver.ts

import { EventEmitter } from 'events';
import { ConfigError } from './ConfigError';

/**
 * 配置源信息
 */
export interface ConfigSource {
  type: 'cli' | 'env' | 'config' | 'default';
  source: string;
  value: any;
}

/**
 * 配置解析结果
 */
export interface ConfigResolutionResult<T> {
  value: T;
  source: ConfigSource;
  resolvedAt: Date;
}

/**
 * 带跟踪和事件的高级配置解析器
 */
export class AdvancedConfigResolver extends EventEmitter {
  private resolutionHistory: Map<string, ConfigResolutionResult<any>[]> = new Map();
  private watchers: Map<string, ((value: any) => void)[]> = new Map();

  /**
   * 使用跟踪解析配置值
   */
  resolve<T>(
    key: string,
    options: ConfigValueOptions<T>
  ): ConfigResolutionResult<T> | undefined {
    const startTime = Date.now();

    this.emit('resolutionStart', { key, options });

    try {
      const result = this.performResolution(key, options);
      
      if (result) {
        // 跟踪解析历史
        this.trackResolution(key, result);
        
        // 通知监听器
        this.notifyWatchers(key, result.value);
        
        this.emit('resolutionComplete', {
          key,
          result,
          duration: Date.now() - startTime,
        });
      } else {
        this.emit('resolutionEmpty', { key, duration: Date.now() - startTime });
      }

      return result;

    } catch (error) {
      this.emit('resolutionError', {
        key,
        error,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * 执行实际的解析逻辑
   */
  private performResolution<T>(
    key: string,
    options: ConfigValueOptions<T>
  ): ConfigResolutionResult<T> | undefined {
    const {
      cliValue,
      configValue,
      envVar,
      defaultValue,
      validator,
      transformer,
    } = options;

    // 创建结果的辅助函数
    const createResult = (
      value: T,
      type: ConfigSource['type'],
      source: string
    ): ConfigResolutionResult<T> => ({
      value,
      source: { type, source, value },
      resolvedAt: new Date(),
    });

    // 处理值的辅助函数
    const processValue = (value: any, type: ConfigSource['type'], source: string): T | undefined => {
      if (value === undefined || value === null) {
        return undefined;
      }

      let processedValue = value;

      // Apply transformer
      if (transformer) {
        try {
          processedValue = transformer(value);
        } catch (error) {
          throw new ConfigError(
            `转换键'${key}'的${type}值失败: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // Apply validator
      if (validator && !validator(processedValue)) {
        throw new ConfigError(`Invalid ${type} value for key '${key}': ${processedValue}`);
      }

      return processedValue;
    };

    // Priority 1: CLI arguments
    if (cliValue !== undefined) {
      const processed = processValue(cliValue, 'cli', 'command line');
      if (processed !== undefined) {
        return createResult(processed, 'cli', 'command line');
      }
    }

    // Priority 2: Environment variables
    if (envVar) {
      const envValue = process.env[envVar];
      if (envValue !== undefined) {
        const processed = processValue(envValue, 'env', envVar);
        if (processed !== undefined) {
          return createResult(processed, 'env', envVar);
        }
      }
    }

    // Priority 3: Configuration file
    if (configValue !== undefined) {
      const processed = processValue(configValue, 'config', 'configuration file');
      if (processed !== undefined) {
        return createResult(processed, 'config', 'configuration file');
      }
    }

    // Priority 4: Default value
    if (defaultValue !== undefined) {
      const processed = processValue(defaultValue, 'default', 'default value');
      if (processed !== undefined) {
        return createResult(processed, 'default', 'default value');
      }
    }

    return undefined;
  }

  /**
   * 跟踪解析历史
   */
  private trackResolution<T>(key: string, result: ConfigResolutionResult<T>): void {
    if (!this.resolutionHistory.has(key)) {
      this.resolutionHistory.set(key, []);
    }
    
    const history = this.resolutionHistory.get(key)!;
    history.push(result);
    
    // 仅保留最后10次解析
    if (history.length > 10) {
      history.shift();
    }
  }

  /**
   * 通知值监听器
   */
  private notifyWatchers(key: string, value: any): void {
    const watchers = this.watchers.get(key);
    if (watchers) {
      for (const watcher of watchers) {
        try {
          watcher(value);
        } catch (error) {
          this.emit('watcherError', { key, error });
        }
      }
    }
  }

  /**
   * 监听配置变更
   */
  watch(key: string, callback: (value: any) => void): () => void {
    if (!this.watchers.has(key)) {
      this.watchers.set(key, []);
    }
    
    const watchers = this.watchers.get(key)!;
    watchers.push(callback);
    
    // 返回取消监听函数
    return () => {
      const index = watchers.indexOf(callback);
      if (index > -1) {
        watchers.splice(index, 1);
      }
    };
  }

  /**
   * 获取键的解析历史
   */
  getResolutionHistory(key: string): ConfigResolutionResult<any>[] {
    return [...(this.resolutionHistory.get(key) || [])];
  }

  /**
   * 获取所有已解析的键
   */
  getResolvedKeys(): string[] {
    return Array.from(this.resolutionHistory.keys());
  }

  /**
   * 清除解析历史
   */
  clearHistory(key?: string): void {
    if (key) {
      this.resolutionHistory.delete(key);
    } else {
      this.resolutionHistory.clear();
    }
    
    this.emit('historyCleaned', { key });
  }

  /**
   * 获取配置摘要
   */
  getSummary(): Record<string, any> {
    const summary: Record<string, any> = {};
    
    for (const [key, history] of this.resolutionHistory.entries()) {
      const latest = history[history.length - 1];
      summary[key] = {
        value: latest.value,
        source: latest.source,
        resolvedAt: latest.resolvedAt,
        resolutionCount: history.length,
      };
    }
    
    return summary;
  }
}

// 全局解析器实例
export const configResolver = new AdvancedConfigResolver();

// 使用全局解析器的便利函数
export function resolveConfig<T>(key: string, options: ConfigValueOptions<T>): T | undefined {
  const result = configResolver.resolve(key, options);
  return result?.value;
}

export function watchConfig(key: string, callback: (value: any) => void): () => void {
  return configResolver.watch(key, callback);
}
```

**高级配置解析器分析：**

**解析追踪：**
```typescript
private trackResolution<T>(key: string, result: ConfigResolutionResult<T>): void {
  if (!this.resolutionHistory.has(key)) {
    this.resolutionHistory.set(key, []);
  }
  
  const history = this.resolutionHistory.get(key)!;
  history.push(result);
  
  // Keep only last 10 resolutions
  if (history.length > 10) {
    history.shift();
  }
}
```
- **语法层面**：Map数据结构和数组操作，泛型方法定义
- **功能层面**：记录配置解析的历史，便于调试和审计
- **设计层面**：限制历史记录数量，避免内存泄漏
- **架构层面**：为配置系统提供可观测性和调试能力

**配置监听机制：**
```typescript
watch(key: string, callback: (value: any) => void): () => void {
  if (!this.watchers.has(key)) {
    this.watchers.set(key, []);
  }
  
  const watchers = this.watchers.get(key)!;
  watchers.push(callback);
  
  // Return unwatch function
  return () => {
    const index = watchers.indexOf(callback);
    if (index > -1) {
      watchers.splice(index, 1);
    }
  };
}
```
- **语法层面**：返回清理函数的观察者模式实现
- **功能层面**：支持配置变更的实时监听
- **设计层面**：提供清理机制，避免内存泄漏
- **架构层面**：为动态配置更新提供响应式支持

## 3. YAML配置处理详细实现

### 3.1 配置加载器实现

```typescript
// src/config/ConfigLoader.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';
import { EventEmitter } from 'events';
import { ConfigError } from './ConfigError';
import { ModelProvider, ModelConfig } from './types';
import { ModelConfigImpl } from './ModelConfig';

/**
 * 配置文件格式
 */
export enum ConfigFormat {
  YAML = 'yaml',
  JSON = 'json',
}

/**
 * 来自文件的原始配置结构
 */
export interface RawConfig {
  lakeview?: any;
  model_providers?: Record<string, any>;
  models?: Record<string, any>;
  agents?: Record<string, any>;
  mcp_servers?: Record<string, any>;
}

/**
 * 处理后的配置结构
 */
export interface ProcessedConfig {
  lakeview?: any;
  modelProviders: Record<string, ModelProvider>;
  models: Record<string, ModelConfig>;
  agents: Record<string, any>;
  mcpServers?: Record<string, any>;
}

/**
 * 具有全面验证的配置加载器
 */
export class ConfigLoader extends EventEmitter {
  private loadedConfigs: Map<string, ProcessedConfig> = new Map();
  private configWatchers: Map<string, fs.FSWatcher> = new Map();

  /**
   * 从文件加载配置
   */
  async loadFromFile(filePath: string): Promise<ProcessedConfig> {
    const absolutePath = path.resolve(filePath);
    
    this.emit('loadStart', { filePath: absolutePath });

    try {
      // 检查文件是否存在
      await fs.access(absolutePath);
      
      // 确定文件格式
      const format = this.detectFormat(absolutePath);
      
      // 读取并解析文件
      const rawConfig = await this.parseConfigFile(absolutePath, format);
      
      // 处理并验证配置
      const processedConfig = await this.processConfig(rawConfig, absolutePath);
      
      // 缓存配置
      this.loadedConfigs.set(absolutePath, processedConfig);
      
      this.emit('loadComplete', { 
        filePath: absolutePath,
        format,
        config: processedConfig 
      });

      return processedConfig;

    } catch (error) {
      this.emit('loadError', { filePath: absolutePath, error });
      throw error;
    }
  }

  /**
   * 从字符串加载配置
   */
  async loadFromString(
    configString: string,
    format: ConfigFormat = ConfigFormat.YAML
  ): Promise<ProcessedConfig> {
    this.emit('loadFromStringStart', { format });

    try {
      // 解析配置字符串
      const rawConfig = this.parseConfigString(configString, format);
      
      // 处理并验证配置
      const processedConfig = await this.processConfig(rawConfig);
      
      this.emit('loadFromStringComplete', { format, config: processedConfig });

      return processedConfig;

    } catch (error) {
      this.emit('loadFromStringError', { format, error });
      throw error;
    }
  }

  /**
   * 检测配置文件格式
   */
  private detectFormat(filePath: string): ConfigFormat {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.yaml':
      case '.yml':
        return ConfigFormat.YAML;
      case '.json':
        return ConfigFormat.JSON;
      default:
        // Default to YAML for unknown extensions
        return ConfigFormat.YAML;
    }
  }

  /**
   * 解析配置文件
   */
  private async parseConfigFile(filePath: string, format: ConfigFormat): Promise<RawConfig> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return this.parseConfigString(content, format);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new ConfigError(`配置文件未找到: ${filePath}`);
      }
      throw new ConfigError(`Failed to read configuration file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 解析配置字符串
   */
  private parseConfigString(content: string, format: ConfigFormat): RawConfig {
    try {
      switch (format) {
        case ConfigFormat.YAML:
          return yaml.parse(content) as RawConfig;
        case ConfigFormat.JSON:
          return JSON.parse(content) as RawConfig;
        default:
          throw new ConfigError(`Unsupported configuration format: ${format}`);
      }
    } catch (error) {
      throw new ConfigError(`Failed to parse ${format.toUpperCase()} configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 将原始配置处理为类型化结构
   */
  private async processConfig(
    rawConfig: RawConfig,
    filePath?: string
  ): Promise<ProcessedConfig> {
    this.emit('processStart', { rawConfig, filePath });

    // Process model providers
    const modelProviders = this.processModelProviders(rawConfig.model_providers);
    
    // Process models
    const models = this.processModels(rawConfig.models, modelProviders);
    
    // Process agents
    const agents = this.processAgents(rawConfig.agents, models);
    
    // Process MCP servers
    const mcpServers = rawConfig.mcp_servers;

    const processedConfig: ProcessedConfig = {
      lakeview: rawConfig.lakeview,
      modelProviders,
      models,
      agents,
      mcpServers,
    };

    this.emit('processComplete', { processedConfig, filePath });

    return processedConfig;
  }

  /**
   * 处理模型提供商配置
   */
  private processModelProviders(
    rawProviders?: Record<string, any>
  ): Record<string, ModelProvider> {
    if (!rawProviders || Object.keys(rawProviders).length === 0) {
      throw new ConfigError('未配置模型提供商');
    }

    const providers: Record<string, ModelProvider> = {};

    for (const [name, config] of Object.entries(rawProviders)) {
      try {
        providers[name] = this.validateModelProvider(config, name);
      } catch (error) {
        throw new ConfigError(`Invalid model provider '${name}': ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.emit('modelProvidersProcessed', { 
      providerCount: Object.keys(providers).length,
      providerNames: Object.keys(providers) 
    });

    return providers;
  }

  /**
   * 验证模型提供商配置
   */
  private validateModelProvider(config: any, name: string): ModelProvider {
    if (!config || typeof config !== 'object') {
      throw new ConfigError('模型提供商配置必须是对象');
    }

    if (!config.provider || typeof config.provider !== 'string') {
      throw new ConfigError('模型提供商必须指定提供商类型');
    }

    if (!config.api_key || typeof config.api_key !== 'string') {
      throw new ConfigError('模型提供商必须指定API密钥');
    }

    const provider: ModelProvider = {
      provider: config.provider,
      apiKey: config.api_key,
    };

    // Optional fields
    if (config.base_url) {
      provider.baseUrl = config.base_url;
    }
    if (config.api_version) {
      provider.apiVersion = config.api_version;
    }
    if (config.organization) {
      provider.organization = config.organization;
    }
    if (config.project_id) {
      provider.projectId = config.project_id;
    }
    if (config.region) {
      provider.region = config.region;
    }

    return provider;
  }

  /**
   * 处理模型配置
   */
  private processModels(
    rawModels?: Record<string, any>,
    modelProviders?: Record<string, ModelProvider>
  ): Record<string, ModelConfig> {
    if (!rawModels || Object.keys(rawModels).length === 0) {
      throw new ConfigError('未配置模型');
    }

    if (!modelProviders) {
      throw new ConfigError('必须在处理模型之前处理模型提供商');
    }

    const models: Record<string, ModelConfig> = {};

    for (const [name, config] of Object.entries(rawModels)) {
      try {
        models[name] = this.createModelConfig(config, name, modelProviders);
      } catch (error) {
        throw new ConfigError(`Invalid model '${name}': ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.emit('modelsProcessed', { 
      modelCount: Object.keys(models).length,
      modelNames: Object.keys(models) 
    });

    return models;
  }

  /**
   * 创建模型配置
   */
  private createModelConfig(
    config: any,
    name: string,
    modelProviders: Record<string, ModelProvider>
  ): ModelConfig {
    if (!config || typeof config !== 'object') {
      throw new ConfigError('模型配置必须是对象');
    }

    if (!config.model || typeof config.model !== 'string') {
      throw new ConfigError('模型必须指定模型名称');
    }

    if (!config.model_provider || typeof config.model_provider !== 'string') {
      throw new ConfigError('模型必须指定模型提供商');
    }

    const providerName = config.model_provider;
    const provider = modelProviders[providerName];
    
    if (!provider) {
      throw new ConfigError(`模型提供商 '${providerName}' 未找到`);
    }

    // 使用默认值创建模型配置
    const modelConfig = new ModelConfigImpl({
      model: config.model,
      modelProvider: provider,
      temperature: config.temperature ?? 0.5,
      topP: config.top_p ?? 1.0,
      topK: config.top_k ?? 0,
      parallelToolCalls: config.parallel_tool_calls ?? true,
      maxRetries: config.max_retries ?? 3,
      supportsToolCalling: config.supports_tool_calling ?? true,
      maxTokens: config.max_tokens,
      candidateCount: config.candidate_count,
      stopSequences: config.stop_sequences,
      maxCompletionTokens: config.max_completion_tokens,
      presencePenalty: config.presence_penalty,
      frequencyPenalty: config.frequency_penalty,
    });

    return modelConfig;
  }

  /**
   * 处理智能体配置
   */
  private processAgents(
    rawAgents?: Record<string, any>,
    models?: Record<string, ModelConfig>
  ): Record<string, any> {
    if (!rawAgents || Object.keys(rawAgents).length === 0) {
      throw new ConfigError('未配置智能体');
    }

    if (!models) {
      throw new ConfigError('必须在处理智能体之前处理模型');
    }

    const agents: Record<string, any> = {};

    for (const [name, config] of Object.entries(rawAgents)) {
      try {
        agents[name] = this.processAgentConfig(config, name, models);
      } catch (error) {
        throw new ConfigError(`Invalid agent '${name}': ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.emit('agentsProcessed', { 
      agentCount: Object.keys(agents).length,
      agentNames: Object.keys(agents) 
    });

    return agents;
  }

  /**
   * 处理单个智能体配置
   */
  private processAgentConfig(
    config: any,
    name: string,
    models: Record<string, ModelConfig>
  ): any {
    if (!config || typeof config !== 'object') {
      throw new ConfigError('智能体配置必须是对象');
    }

    if (!config.model || typeof config.model !== 'string') {
      throw new ConfigError('智能体必须指定模型');
    }

    const modelName = config.model;
    const model = models[modelName];
    
    if (!model) {
      throw new ConfigError(`模型 '${modelName}' 未找到`);
    }

    return {
      ...config,
      model, // 用模型对象替换模型名称
    };
  }

  /**
   * 监听配置文件变更
   */
  async watchFile(filePath: string, callback: (config: ProcessedConfig) => void): Promise<() => void> {
    const absolutePath = path.resolve(filePath);
    
    // Load initial configuration
    const initialConfig = await this.loadFromFile(absolutePath);
    
    this.emit('watchStart', { filePath: absolutePath });

    // 设置文件监听器
    const watcher = fs.watch(absolutePath, { persistent: false });
    
    watcher.on('change', async () => {
      try {
        this.emit('fileChanged', { filePath: absolutePath });
        
        const newConfig = await this.loadFromFile(absolutePath);
        callback(newConfig);
        
        this.emit('configReloaded', { filePath: absolutePath, config: newConfig });
      } catch (error) {
        this.emit('reloadError', { filePath: absolutePath, error });
      }
    });

    watcher.on('error', (error) => {
      this.emit('watchError', { filePath: absolutePath, error });
    });

    // 存储监听器以便清理
    this.configWatchers.set(absolutePath, watcher);

    // 返回取消监听函数
    return () => {
      watcher.close();
      this.configWatchers.delete(absolutePath);
      this.emit('watchStop', { filePath: absolutePath });
    };
  }

  /**
   * 获取已加载的配置
   */
  getLoadedConfig(filePath: string): ProcessedConfig | undefined {
    const absolutePath = path.resolve(filePath);
    return this.loadedConfigs.get(absolutePath);
  }

  /**
   * 清除已加载的配置
   */
  clearCache(filePath?: string): void {
    if (filePath) {
      const absolutePath = path.resolve(filePath);
      this.loadedConfigs.delete(absolutePath);
    } else {
      this.loadedConfigs.clear();
    }
    
    this.emit('cacheCleaned', { filePath });
  }

  /**
   * 清理所有监听器和资源
   */
  async cleanup(): Promise<void> {
    // Close all file watchers
    for (const [filePath, watcher] of this.configWatchers.entries()) {
      watcher.close();
      this.emit('watchStop', { filePath });
    }
    
    this.configWatchers.clear();
    this.loadedConfigs.clear();
    this.removeAllListeners();
    
    this.emit('cleanupComplete');
  }
}

// Export singleton instance
export const configLoader = new ConfigLoader();
```

**配置加载器详细分析：**

**文件格式检测：**
```typescript
private detectFormat(filePath: string): ConfigFormat {
  const ext = path.extname(filePath).toLowerCase();
  
  switch (ext) {
    case '.yaml':
    case '.yml':
      return ConfigFormat.YAML;
    case '.json':
      return ConfigFormat.JSON;
    default:
      // Default to YAML for unknown extensions
      return ConfigFormat.YAML;
  }
}
```
- **语法层面**：使用path模块提取文件扩展名，switch语句处理不同格式
- **功能层面**：自动检测配置文件格式，支持YAML和JSON
- **设计层面**：智能默认值，未知格式默认为YAML
- **架构层面**：为多格式配置文件提供统一的加载接口

**配置验证和转换：**
```typescript
private validateModelProvider(config: any, name: string): ModelProvider {
  if (!config || typeof config !== 'object') {
    throw new ConfigError('Model provider configuration must be an object');
  }

  if (!config.provider || typeof config.provider !== 'string') {
    throw new ConfigError('Model provider must specify a provider type');
  }

  if (!config.api_key || typeof config.api_key !== 'string') {
    throw new ConfigError('Model provider must specify an API key');
  }

  const provider: ModelProvider = {
    provider: config.provider,
    apiKey: config.api_key,
  };

  // Optional fields
  if (config.base_url) {
    provider.baseUrl = config.base_url;
  }
  // ... 更多可选字段处理

  return provider;
}
```
- **语法层面**：类型检查、条件判断和对象构建
- **功能层面**：验证原始配置数据并转换为类型化对象
- **设计层面**：完整的输入验证，提供清晰的错误信息
- **架构层面**：为配置安全性和数据完整性提供保障

**文件监听机制：**
```typescript
async watchFile(filePath: string, callback: (config: ProcessedConfig) => void): Promise<() => void> {
  const absolutePath = path.resolve(filePath);
  
  // Load initial configuration
  const initialConfig = await this.loadFromFile(absolutePath);
  
  this.emit('watchStart', { filePath: absolutePath });

  // Set up file watcher
  const watcher = fs.watch(absolutePath, { persistent: false });
  
  watcher.on('change', async () => {
    try {
      this.emit('fileChanged', { filePath: absolutePath });
      
      const newConfig = await this.loadFromFile(absolutePath);
      callback(newConfig);
      
      this.emit('configReloaded', { filePath: absolutePath, config: newConfig });
    } catch (error) {
      this.emit('reloadError', { filePath: absolutePath, error });
    }
  });

  // Return unwatch function
  return () => {
    watcher.close();
    this.configWatchers.delete(absolutePath);
    this.emit('watchStop', { filePath: absolutePath });
  };
}
```
- **语法层面**：异步文件监听和事件处理，返回清理函数
- **功能层面**：监听配置文件变更并自动重新加载
- **设计层面**：提供清理机制，支持动态配置更新
- **架构层面**：为配置热更新提供基础支持

## 4. 配置验证和类型安全

### 4.1 配置错误处理

```typescript
// src/config/ConfigError.ts

/**
 * 配置错误类型
 */
export enum ConfigErrorType {
  VALIDATION = 'validation',
  PARSING = 'parsing',
  FILE_NOT_FOUND = 'file_not_found',
  PERMISSION_DENIED = 'permission_denied',
  CIRCULAR_REFERENCE = 'circular_reference',
  MISSING_DEPENDENCY = 'missing_dependency',
  INVALID_FORMAT = 'invalid_format',
  UNKNOWN = 'unknown',
}

/**
 * 带上下文的详细配置错误
 */
export class ConfigError extends Error {
  public readonly type: ConfigErrorType;
  public readonly path?: string;
  public readonly field?: string;
  public readonly value?: any;
  public readonly suggestions?: string[];

  constructor(
    message: string,
    options: {
      type?: ConfigErrorType;
      path?: string;
      field?: string;
      value?: any;
      suggestions?: string[];
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'ConfigError';
    this.type = options.type || ConfigErrorType.UNKNOWN;
    this.path = options.path;
    this.field = options.field;
    this.value = options.value;
    this.suggestions = options.suggestions;

    if (options.cause && Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigError);
    }
  }

  /**
   * 创建验证错误
   */
  static validation(
    message: string,
    field?: string,
    value?: any,
    suggestions?: string[]
  ): ConfigError {
    return new ConfigError(message, {
      type: ConfigErrorType.VALIDATION,
      field,
      value,
      suggestions,
    });
  }

  /**
   * 创建解析错误
   */
  static parsing(message: string, path?: string, cause?: Error): ConfigError {
    return new ConfigError(message, {
      type: ConfigErrorType.PARSING,
      path,
      cause,
    });
  }

  /**
   * 创建文件未找到错误
   */
  static fileNotFound(path: string): ConfigError {
    return new ConfigError(`配置文件未找到: ${path}`, {
      type: ConfigErrorType.FILE_NOT_FOUND,
      path,
      suggestions: [
        'Check if the file path is correct',
        'Ensure the file exists',
        'Verify read permissions',
      ],
    });
  }

  /**
   * 创建缺少依赖错误
   */
  static missingDependency(
    dependency: string,
    dependent: string,
    suggestions?: string[]
  ): ConfigError {
    return new ConfigError(
      `Missing dependency: ${dependent} requires ${dependency}`,
      {
        type: ConfigErrorType.MISSING_DEPENDENCY,
        field: dependent,
        value: dependency,
        suggestions: suggestions || [
          `Ensure ${dependency} is defined before ${dependent}`,
          `Check the configuration order`,
        ],
      }
    );
  }

  /**
   * 获取带上下文的格式化错误消息
   */
  getFormattedMessage(): string {
    let message = this.message;

    if (this.path) {
      message += `\n  File: ${this.path}`;
    }

    if (this.field) {
      message += `\n  Field: ${this.field}`;
    }

    if (this.value !== undefined) {
      message += `\n  Value: ${JSON.stringify(this.value)}`;
    }

    if (this.suggestions && this.suggestions.length > 0) {
      message += '\n  Suggestions:';
      for (const suggestion of this.suggestions) {
        message += `\n    - ${suggestion}`;
      }
    }

    return message;
  }

  /**
   * 转换为JSON用于序列化
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      path: this.path,
      field: this.field,
      value: this.value,
      suggestions: this.suggestions,
      stack: this.stack,
    };
  }
}
```

### 4.2 配置验证器

```typescript
// src/config/ConfigValidator.ts

import { ConfigError, ConfigErrorType } from './ConfigError';
import { ModelProvider, ModelConfig } from './types';

/**
 * 验证规则接口
 */
export interface ValidationRule<T> {
  name: string;
  validate: (value: T, context?: any) => boolean | string;
  message?: string;
  suggestions?: string[];
}

/**
 * 验证上下文
 */
export interface ValidationContext {
  path: string[];
  field: string;
  value: any;
  parent?: any;
  root?: any;
}

/**
 * 具有全面规则的配置验证器
 */
export class ConfigValidator {
  private rules: Map<string, ValidationRule<any>[]> = new Map();
  private customValidators: Map<string, (value: any, context: ValidationContext) => void> = new Map();

  constructor() {
    this.setupDefaultRules();
  }

  /**
   * 设置默认验证规则
   */
  private setupDefaultRules(): void {
    // Model provider rules
    this.addRule<ModelProvider>('modelProvider', {
      name: 'required_fields',
      validate: (provider) => {
        return !!(provider.apiKey && provider.provider);
      },
      message: 'Model provider must have apiKey and provider fields',
      suggestions: [
        'Ensure apiKey is provided',
        'Ensure provider type is specified',
      ],
    });

    this.addRule<ModelProvider>('modelProvider', {
      name: 'valid_provider',
      validate: (provider) => {
        const validProviders = ['openai', 'anthropic', 'google', 'azure', 'ollama', 'openrouter', 'doubao'];
        return validProviders.includes(provider.provider.toLowerCase());
      },
      message: 'Invalid provider type',
      suggestions: [
        'Use one of: openai, anthropic, google, azure, ollama, openrouter, doubao',
      ],
    });

    // Model configuration rules
    this.addRule<ModelConfig>('modelConfig', {
      name: 'temperature_range',
      validate: (config) => {
        return config.temperature >= 0 && config.temperature <= 2;
      },
      message: 'Temperature must be between 0 and 2',
    });

    this.addRule<ModelConfig>('modelConfig', {
      name: 'top_p_range',
      validate: (config) => {
        return config.topP >= 0 && config.topP <= 1;
      },
      message: 'Top-p must be between 0 and 1',
    });

    // Add more default rules...
  }

  /**
   * 添加验证规则
   */
  addRule<T>(type: string, rule: ValidationRule<T>): void {
    if (!this.rules.has(type)) {
      this.rules.set(type, []);
    }
    this.rules.get(type)!.push(rule);
  }

  /**
   * 添加自定义验证器
   */
  addCustomValidator(
    name: string,
    validator: (value: any, context: ValidationContext) => void
  ): void {
    this.customValidators.set(name, validator);
  }

  /**
   * 验证配置对象
   */
  validate(config: any, type: string, context?: Partial<ValidationContext>): void {
    const fullContext: ValidationContext = {
      path: [],
      field: type,
      value: config,
      parent: undefined,
      root: config,
      ...context,
    };

    // Run type-specific rules
    const rules = this.rules.get(type);
    if (rules) {
      for (const rule of rules) {
        const result = rule.validate(config, fullContext);
        if (result !== true) {
          const message = typeof result === 'string' ? result : (rule.message || `Validation failed: ${rule.name}`);
          throw new ConfigError(message, {
            type: ConfigErrorType.VALIDATION,
            field: fullContext.field,
            value: config,
            suggestions: rule.suggestions,
          });
        }
      }
    }

    // Run custom validators
    for (const [name, validator] of this.customValidators.entries()) {
      try {
        validator(config, fullContext);
      } catch (error) {
        if (error instanceof ConfigError) {
          throw error;
        }
        throw new ConfigError(`Custom validation '${name}' failed: ${error instanceof Error ? error.message : String(error)}`, {
          type: ConfigErrorType.VALIDATION,
          field: fullContext.field,
          value: config,
        });
      }
    }
  }

  /**
   * 验证嵌套对象
   */
  validateNested(
    obj: Record<string, any>,
    validations: Record<string, string>,
    context?: Partial<ValidationContext>
  ): void {
    for (const [field, type] of Object.entries(validations)) {
      if (obj[field] !== undefined) {
        const nestedContext: ValidationContext = {
          path: [...(context?.path || []), field],
          field,
          value: obj[field],
          parent: obj,
          root: context?.root || obj,
        };

        this.validate(obj[field], type, nestedContext);
      }
    }
  }

  /**
   * 验证对象数组
   */
  validateArray<T>(
    array: T[],
    type: string,
    context?: Partial<ValidationContext>
  ): void {
    if (!Array.isArray(array)) {
      throw new ConfigError('期望数组', {
        type: ConfigErrorType.VALIDATION,
        field: context?.field,
        value: array,
      });
    }

    for (let i = 0; i < array.length; i++) {
      const itemContext: ValidationContext = {
        path: [...(context?.path || []), i.toString()],
        field: `${context?.field || 'array'}[${i}]`,
        value: array[i],
        parent: array,
        root: context?.root || array,
      };

      this.validate(array[i], type, itemContext);
    }
  }

  /**
   * 获取类型的所有规则
   */
  getRules(type: string): ValidationRule<any>[] {
    return [...(this.rules.get(type) || [])];
  }

  /**
   * 移除规则
   */
  removeRule(type: string, ruleName: string): boolean {
    const rules = this.rules.get(type);
    if (rules) {
      const index = rules.findIndex(rule => rule.name === ruleName);
      if (index > -1) {
        rules.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * 清除类型的所有规则
   */
  clearRules(type?: string): void {
    if (type) {
      this.rules.delete(type);
    } else {
      this.rules.clear();
    }
  }
}

// Export singleton validator
export const configValidator = new ConfigValidator();
```

**配置验证器分析：**

**规则系统设计：**
```typescript
export interface ValidationRule<T> {
  name: string;
  validate: (value: T, context?: any) => boolean | string;
  message?: string;
  suggestions?: string[];
}
```
- **语法层面**：泛型接口定义，支持布尔值或字符串返回
- **功能层面**：定义可重用的验证规则结构
- **设计层面**：支持自定义错误消息和建议，提高用户体验
- **架构层面**：为配置验证提供灵活而强大的规则系统

**上下文传递机制：**
```typescript
export interface ValidationContext {
  path: string[];
  field: string;
  value: any;
  parent?: any;
  root?: any;
}
```
- **语法层面**：接口定义包含路径、字段和值信息
- **功能层面**：为验证函数提供完整的上下文信息
- **设计层面**：支持嵌套对象的验证和错误定位
- **架构层面**：为复杂配置结构的验证提供精确的错误定位

这个完整的Node.js配置系统实现不仅保持了原版的所有功能，还通过TypeScript的类型系统、事件驱动架构和现代异步模式提供了更好的开发体验、配置验证和系统可靠性。所有配置都支持完整的类型检查、优先级解析、文件监听和错误处理。
