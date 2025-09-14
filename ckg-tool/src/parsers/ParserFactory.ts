/**
 * 解析器工厂
 * 根据文件扩展名创建相应的AST解析器
 */

import { ASTParser } from './ASTParser';
import { PythonParser } from './PythonParser';
import { JavaScriptParser, TypeScriptParser } from './JavaScriptParser';
import { EXTENSION_TO_LANGUAGE } from '../constants';

/**
 * 解析器工厂类
 * 负责根据文件类型创建相应的AST解析器实例
 */
export class ParserFactory {
  private static parsers: Map<string, ASTParser> = new Map();

  /**
   * 根据文件扩展名获取解析器
   * @param extension 文件扩展名
   * @returns AST解析器实例
   */
  public static getParser(extension: string): ASTParser | null {
    const language = EXTENSION_TO_LANGUAGE[extension];
    if (!language) {
      return null;
    }

    // 如果已经创建过解析器，直接返回
    if (this.parsers.has(language)) {
      return this.parsers.get(language)!;
    }

    // 创建新的解析器实例
    let parser: ASTParser;
    switch (language) {
      case 'python':
        parser = new PythonParser();
        break;
      case 'javascript':
        parser = new JavaScriptParser();
        break;
      case 'typescript':
        parser = new TypeScriptParser();
        break;
      // 可以在这里添加更多语言的解析器
      // case 'java':
      //   parser = new JavaParser();
      //   break;
      // case 'cpp':
      //   parser = new CppParser();
      //   break;
      // case 'c':
      //   parser = new CParser();
      //   break;
      default:
        return null;
    }

    // 缓存解析器实例
    this.parsers.set(language, parser);
    return parser;
  }

  /**
   * 根据文件路径获取解析器
   * @param filePath 文件路径
   * @returns AST解析器实例
   */
  public static getParserByPath(filePath: string): ASTParser | null {
    const extension = this.getFileExtension(filePath);
    return this.getParser(extension);
  }

  /**
   * 获取文件扩展名
   * @param filePath 文件路径
   * @returns 文件扩展名
   */
  private static getFileExtension(filePath: string): string {
    const lastDotIndex = filePath.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return '';
    }
    return filePath.substring(lastDotIndex);
  }

  /**
   * 检查文件是否支持解析
   * @param filePath 文件路径
   * @returns 是否支持
   */
  public static isSupportedFile(filePath: string): boolean {
    const extension = this.getFileExtension(filePath);
    return extension in EXTENSION_TO_LANGUAGE;
  }

  /**
   * 获取所有支持的文件扩展名
   * @returns 支持的文件扩展名列表
   */
  public static getSupportedExtensions(): string[] {
    return Object.keys(EXTENSION_TO_LANGUAGE);
  }

  /**
   * 获取所有支持的语言
   * @returns 支持的语言列表
   */
  public static getSupportedLanguages(): string[] {
    return Object.values(EXTENSION_TO_LANGUAGE);
  }

  /**
   * 清理解析器缓存
   * 在需要释放内存时调用
   */
  public static clearCache(): void {
    this.parsers.clear();
  }
}
