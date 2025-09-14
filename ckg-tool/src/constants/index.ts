/**
 * CKG工具的常量定义
 * 包含配置信息、映射关系等常量
 */

import { LanguageMapping, DatabaseConfig } from '../types';

/**
 * 文件扩展名到语言的映射关系
 * 支持多种编程语言的代码解析
 */
export const EXTENSION_TO_LANGUAGE: LanguageMapping = {
  '.py': 'python',
  '.java': 'java',
  '.cpp': 'cpp',
  '.hpp': 'cpp',
  '.c++': 'cpp',
  '.cxx': 'cpp',
  '.cc': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
};

/**
 * 支持的CKG工具命令
 */
export const CKG_TOOL_COMMANDS = [
  'search_function',
  'search_class', 
  'search_class_method'
] as const;

/**
 * 数据库配置
 */
export const DATABASE_CONFIG: DatabaseConfig = {
  databasePath: './ckg-storage',
  storageInfoPath: './ckg-storage/storage_info.json',
  expiryTime: 60 * 60 * 24 * 7, // 7天
};

/**
 * SQL表结构定义
 */
export const SQL_TABLES = {
  functions: `
    CREATE TABLE IF NOT EXISTS functions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      body TEXT NOT NULL,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      parent_function TEXT,
      parent_class TEXT
    )
  `,
  classes: `
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      body TEXT NOT NULL,
      fields TEXT,
      methods TEXT,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL
    )
  `
};

/**
 * 最大响应长度限制
 */
export const MAX_RESPONSE_LEN = 16000;

/**
 * 截断消息
 */
export const TRUNCATED_MESSAGE = '<response clipped><NOTE>To save on context only part of this file has been shown to you. You should retry this tool after you have searched inside the file with `grep -n` in order to find the line numbers of what you are looking for.</NOTE>';

/**
 * 已知问题说明
 */
export const KNOWN_ISSUES = `
已知问题:
1. 当对已经索引过的代码库的子目录进行索引时，会重新为该子目录构建CKG
2. 重建逻辑可以通过只重建已修改的文件来改进
3. 对于JavaScript和TypeScript，AST不完整：匿名函数、箭头函数等未被解析
`;
