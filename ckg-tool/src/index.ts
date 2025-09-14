/**
 * CKG工具主入口文件
 * 导出所有公共API和类型定义
 */

// 导出核心类型
export * from './types';

// 导出常量
export * from './constants';

// 导出工具类
export { CKGTool } from './CKGTool';

// 导出数据库类
export { CKGDatabase } from './database/CKGDatabase';

// 导出解析器
export { ASTParser } from './parsers/ASTParser';
export { PythonParser } from './parsers/PythonParser';
export { JavaScriptParser, TypeScriptParser } from './parsers/JavaScriptParser';
export { ParserFactory } from './parsers/ParserFactory';

// 导出工具函数
export * from './utils/hash';

/**
 * 创建CKG工具实例的便捷函数
 * @returns CKG工具实例
 */
export function createCKGTool(): CKGTool {
  return new CKGTool();
}

/**
 * 默认导出的CKG工具类
 */
export default CKGTool;
