/**
 * AST解析器基类
 * 提供通用的AST解析功能，支持多种编程语言
 */

import * as Parser from 'tree-sitter';
import { FunctionEntry, ClassEntry } from '../types';

/**
 * AST解析器抽象基类
 * 定义了解析器的通用接口和基础功能
 */
export abstract class ASTParser {
  protected parser: Parser;
  protected language: string;

  constructor(language: string) {
    this.language = language;
    this.parser = new Parser();
  }

  /**
   * 解析文件内容
   * @param fileContent 文件内容
   * @param filePath 文件路径
   * @returns 解析结果
   */
  public parseFile(fileContent: string, filePath: string): {
    functions: FunctionEntry[];
    classes: ClassEntry[];
  } {
    const tree = this.parser.parse(fileContent);
    const functions: FunctionEntry[] = [];
    const classes: ClassEntry[] = [];

    // 递归遍历AST节点
    this.recursiveVisit(tree.rootNode, filePath, functions, classes);

    return { functions, classes };
  }

  /**
   * 递归访问AST节点
   * 子类需要实现具体的解析逻辑
   * @param node AST节点
   * @param filePath 文件路径
   * @param functions 函数列表
   * @param classes 类列表
   * @param parentClass 父类
   * @param parentFunction 父函数
   */
  protected abstract recursiveVisit(
    node: Parser.SyntaxNode,
    filePath: string,
    functions: FunctionEntry[],
    classes: ClassEntry[],
    parentClass?: ClassEntry,
    parentFunction?: FunctionEntry
  ): void;

  /**
   * 创建函数条目
   * @param name 函数名
   * @param filePath 文件路径
   * @param body 函数体
   * @param startLine 起始行
   * @param endLine 结束行
   * @param parentClass 父类
   * @param parentFunction 父函数
   * @returns 函数条目
   */
  protected createFunctionEntry(
    name: string,
    filePath: string,
    body: string,
    startLine: number,
    endLine: number,
    parentClass?: ClassEntry,
    parentFunction?: FunctionEntry
  ): FunctionEntry {
    const entry: FunctionEntry = {
      name,
      filePath,
      body,
      startLine,
      endLine
    };

    // 设置父关系
    if (parentFunction && parentClass) {
      // 判断函数是类方法还是嵌套函数
      if (parentFunction.startLine >= parentClass.startLine && 
          parentFunction.endLine <= parentClass.endLine) {
        entry.parentFunction = parentFunction.name;
      } else {
        entry.parentClass = parentClass.name;
      }
    } else if (parentFunction) {
      entry.parentFunction = parentFunction.name;
    } else if (parentClass) {
      entry.parentClass = parentClass.name;
    }

    return entry;
  }

  /**
   * 创建类条目
   * @param name 类名
   * @param filePath 文件路径
   * @param body 类体
   * @param startLine 起始行
   * @param endLine 结束行
   * @param fields 字段列表
   * @param methods 方法列表
   * @returns 类条目
   */
  protected createClassEntry(
    name: string,
    filePath: string,
    body: string,
    startLine: number,
    endLine: number,
    fields?: string,
    methods?: string
  ): ClassEntry {
    return {
      name,
      filePath,
      body,
      startLine,
      endLine,
      fields,
      methods
    };
  }

  /**
   * 获取节点文本内容
   * @param node AST节点
   * @returns 节点文本
   */
  protected getNodeText(node: Parser.SyntaxNode): string {
    return node.text;
  }

  /**
   * 获取节点行号（从1开始）
   * @param node AST节点
   * @returns 行号
   */
  protected getNodeLine(node: Parser.SyntaxNode): number {
    return node.startPosition.row + 1;
  }

  /**
   * 获取节点结束行号（从1开始）
   * @param node AST节点
   * @returns 结束行号
   */
  protected getNodeEndLine(node: Parser.SyntaxNode): number {
    return node.endPosition.row + 1;
  }

  /**
   * 查找子节点
   * @param node 父节点
   * @param fieldName 字段名
   * @returns 子节点
   */
  protected findChildByField(node: Parser.SyntaxNode, fieldName: string): Parser.SyntaxNode | null {
    return node.childForFieldName(fieldName);
  }

  /**
   * 查找所有子节点
   * @param node 父节点
   * @param type 节点类型
   * @returns 子节点列表
   */
  protected findChildrenByType(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode[] {
    const children: Parser.SyntaxNode[] = [];
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === type) {
        children.push(child);
      }
    }
    
    return children;
  }
}
