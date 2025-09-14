/**
 * CKG工具的核心类型定义
 * 定义了代码知识图谱中使用的数据结构
 */

/**
 * 函数条目数据结构
 * 表示代码库中的一个函数定义
 */
export interface FunctionEntry {
  /** 函数名称 */
  name: string;
  /** 文件路径 */
  filePath: string;
  /** 函数体代码 */
  body: string;
  /** 起始行号 */
  startLine: number;
  /** 结束行号 */
  endLine: number;
  /** 父函数名称（嵌套函数） */
  parentFunction?: string;
  /** 所属类名称（类方法） */
  parentClass?: string;
}

/**
 * 类条目数据结构
 * 表示代码库中的一个类定义
 */
export interface ClassEntry {
  /** 类名称 */
  name: string;
  /** 文件路径 */
  filePath: string;
  /** 类体代码 */
  body: string;
  /** 起始行号 */
  startLine: number;
  /** 结束行号 */
  endLine: number;
  /** 字段列表 */
  fields?: string;
  /** 方法列表 */
  methods?: string;
}

/**
 * CKG工具命令类型
 * 定义支持的操作类型
 */
export type CKGToolCommand = 'search_function' | 'search_class' | 'search_class_method';

/**
 * 工具执行结果
 * 表示工具操作的返回结果
 */
export interface ToolExecResult {
  /** 是否成功 */
  success: boolean;
  /** 输出内容 */
  output?: string;
  /** 错误信息 */
  error?: string;
  /** 错误代码 */
  errorCode?: number;
}

/**
 * 工具参数
 * 定义CKG工具调用时需要的参数
 */
export interface ToolArguments {
  /** 命令类型 */
  command: CKGToolCommand;
  /** 代码库路径 */
  path: string;
  /** 搜索标识符 */
  identifier: string;
  /** 是否打印代码体 */
  printBody?: boolean;
}

/**
 * 语言映射配置
 * 文件扩展名到语言的映射关系
 */
export interface LanguageMapping {
  [extension: string]: string;
}

/**
 * 数据库配置
 * 定义数据库相关的配置信息
 */
export interface DatabaseConfig {
  /** 数据库路径 */
  databasePath: string;
  /** 存储信息文件路径 */
  storageInfoPath: string;
  /** 数据库过期时间（秒） */
  expiryTime: number;
}

/**
 * 代码库快照信息
 * 用于判断代码库是否发生变化
 */
export interface CodebaseSnapshot {
  /** 快照哈希值 */
  hash: string;
  /** 代码库路径 */
  path: string;
  /** 创建时间 */
  createdAt: Date;
  /** 最后修改时间 */
  lastModified: Date;
}
