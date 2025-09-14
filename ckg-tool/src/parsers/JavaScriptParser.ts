/**
 * JavaScript/TypeScript AST解析器
 * 专门用于解析JavaScript和TypeScript代码的AST结构
 */

import * as Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import { ASTParser } from './ASTParser';
import { FunctionEntry, ClassEntry } from '../types';

/**
 * JavaScript代码AST解析器
 * 继承自ASTParser，实现JavaScript特定的解析逻辑
 */
export class JavaScriptParser extends ASTParser {
  constructor() {
    super('javascript');
    this.parser.setLanguage(JavaScript);
  }

  /**
   * 递归访问JavaScript AST节点
   * @param node AST节点
   * @param filePath 文件路径
   * @param functions 函数列表
   * @param classes 类列表
   * @param parentClass 父类
   * @param parentFunction 父函数
   */
  protected recursiveVisit(
    node: Parser.SyntaxNode,
    filePath: string,
    functions: FunctionEntry[],
    classes: ClassEntry[],
    parentClass?: ClassEntry,
    parentFunction?: FunctionEntry
  ): void {
    // 处理函数声明
    if (node.type === 'function_declaration') {
      const functionEntry = this.parseFunctionDeclaration(node, filePath, parentClass, parentFunction);
      if (functionEntry) {
        functions.push(functionEntry);
        parentFunction = functionEntry;
      }
    }
    // 处理函数表达式
    else if (node.type === 'function') {
      const functionEntry = this.parseFunctionExpression(node, filePath, parentClass, parentFunction);
      if (functionEntry) {
        functions.push(functionEntry);
        parentFunction = functionEntry;
      }
    }
    // 处理箭头函数
    else if (node.type === 'arrow_function') {
      const functionEntry = this.parseArrowFunction(node, filePath, parentClass, parentFunction);
      if (functionEntry) {
        functions.push(functionEntry);
        parentFunction = functionEntry;
      }
    }
    // 处理方法定义
    else if (node.type === 'method_definition') {
      const functionEntry = this.parseMethodDefinition(node, filePath, parentClass, parentFunction);
      if (functionEntry) {
        functions.push(functionEntry);
        parentFunction = functionEntry;
      }
    }
    // 处理类声明
    else if (node.type === 'class_declaration') {
      const classEntry = this.parseClassDeclaration(node, filePath);
      if (classEntry) {
        classes.push(classEntry);
        parentClass = classEntry;
      }
    }

    // 递归处理子节点
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        this.recursiveVisit(child, filePath, functions, classes, parentClass, parentFunction);
      }
    }
  }

  /**
   * 解析函数声明
   * @param node 函数声明节点
   * @param filePath 文件路径
   * @param parentClass 父类
   * @param parentFunction 父函数
   * @returns 函数条目
   */
  private parseFunctionDeclaration(
    node: Parser.SyntaxNode,
    filePath: string,
    parentClass?: ClassEntry,
    parentFunction?: FunctionEntry
  ): FunctionEntry | null {
    const nameNode = this.findChildByField(node, 'name');
    if (!nameNode) {
      return null;
    }

    const functionName = this.getNodeText(nameNode);
    const functionBody = this.getNodeText(node);
    const startLine = this.getNodeLine(node);
    const endLine = this.getNodeEndLine(node);

    return this.createFunctionEntry(
      functionName,
      filePath,
      functionBody,
      startLine,
      endLine,
      parentClass,
      parentFunction
    );
  }

  /**
   * 解析函数表达式
   * @param node 函数表达式节点
   * @param filePath 文件路径
   * @param parentClass 父类
   * @param parentFunction 父函数
   * @returns 函数条目
   */
  private parseFunctionExpression(
    node: Parser.SyntaxNode,
    filePath: string,
    parentClass?: ClassEntry,
    parentFunction?: FunctionEntry
  ): FunctionEntry | null {
    // 查找函数名（可能在父节点中）
    let functionName = 'anonymous';
    const parent = node.parent;
    if (parent) {
      if (parent.type === 'variable_declarator') {
        const nameNode = this.findChildByField(parent, 'name');
        if (nameNode) {
          functionName = this.getNodeText(nameNode);
        }
      } else if (parent.type === 'assignment_expression') {
        const leftNode = this.findChildByField(parent, 'left');
        if (leftNode) {
          functionName = this.getNodeText(leftNode);
        }
      }
    }

    const functionBody = this.getNodeText(node);
    const startLine = this.getNodeLine(node);
    const endLine = this.getNodeEndLine(node);

    return this.createFunctionEntry(
      functionName,
      filePath,
      functionBody,
      startLine,
      endLine,
      parentClass,
      parentFunction
    );
  }

  /**
   * 解析箭头函数
   * @param node 箭头函数节点
   * @param filePath 文件路径
   * @param parentClass 父类
   * @param parentFunction 父函数
   * @returns 函数条目
   */
  private parseArrowFunction(
    node: Parser.SyntaxNode,
    filePath: string,
    parentClass?: ClassEntry,
    parentFunction?: FunctionEntry
  ): FunctionEntry | null {
    // 箭头函数通常没有显式名称，尝试从上下文推断
    let functionName = 'arrow_function';
    const parent = node.parent;
    if (parent) {
      if (parent.type === 'variable_declarator') {
        const nameNode = this.findChildByField(parent, 'name');
        if (nameNode) {
          functionName = this.getNodeText(nameNode);
        }
      }
    }

    const functionBody = this.getNodeText(node);
    const startLine = this.getNodeLine(node);
    const endLine = this.getNodeEndLine(node);

    return this.createFunctionEntry(
      functionName,
      filePath,
      functionBody,
      startLine,
      endLine,
      parentClass,
      parentFunction
    );
  }

  /**
   * 解析方法定义
   * @param node 方法定义节点
   * @param filePath 文件路径
   * @param parentClass 父类
   * @param parentFunction 父函数
   * @returns 函数条目
   */
  private parseMethodDefinition(
    node: Parser.SyntaxNode,
    filePath: string,
    parentClass?: ClassEntry,
    parentFunction?: FunctionEntry
  ): FunctionEntry | null {
    const nameNode = this.findChildByField(node, 'name');
    if (!nameNode) {
      return null;
    }

    const methodName = this.getNodeText(nameNode);
    const methodBody = this.getNodeText(node);
    const startLine = this.getNodeLine(node);
    const endLine = this.getNodeEndLine(node);

    return this.createFunctionEntry(
      methodName,
      filePath,
      methodBody,
      startLine,
      endLine,
      parentClass,
      parentFunction
    );
  }

  /**
   * 解析类声明
   * @param node 类声明节点
   * @param filePath 文件路径
   * @returns 类条目
   */
  private parseClassDeclaration(node: Parser.SyntaxNode, filePath: string): ClassEntry | null {
    const nameNode = this.findChildByField(node, 'name');
    if (!nameNode) {
      return null;
    }

    const className = this.getNodeText(nameNode);
    const classBody = this.getNodeText(node);
    const startLine = this.getNodeLine(node);
    const endLine = this.getNodeEndLine(node);

    // 解析类体，提取方法和字段
    const bodyNode = this.findChildByField(node, 'body');
    let methods = '';
    let fields = '';

    if (bodyNode) {
      for (let i = 0; i < bodyNode.childCount; i++) {
        const child = bodyNode.child(i);
        if (!child) continue;

        // 处理方法定义
        if (child.type === 'method_definition') {
          const methodInfo = this.extractMethodInfo(child);
          if (methodInfo) {
            methods += `- ${methodInfo}\n`;
          }
        }
        // 处理字段定义
        else if (child.type === 'field_definition') {
          const fieldInfo = this.extractFieldInfo(child);
          if (fieldInfo) {
            fields += `- ${fieldInfo}\n`;
          }
        }
        // 处理属性定义
        else if (child.type === 'property_signature') {
          const fieldInfo = this.extractPropertyInfo(child);
          if (fieldInfo) {
            fields += `- ${fieldInfo}\n`;
          }
        }
      }
    }

    return this.createClassEntry(
      className,
      filePath,
      classBody,
      startLine,
      endLine,
      fields.trim() || undefined,
      methods.trim() || undefined
    );
  }

  /**
   * 提取方法信息
   * @param methodNode 方法节点
   * @returns 方法信息字符串
   */
  private extractMethodInfo(methodNode: Parser.SyntaxNode): string | null {
    const nameNode = this.findChildByField(methodNode, 'name');
    if (!nameNode) {
      return null;
    }

    let methodInfo = this.getNodeText(nameNode);

    // 添加参数信息
    const parametersNode = this.findChildByField(methodNode, 'parameters');
    if (parametersNode) {
      methodInfo += this.getNodeText(parametersNode);
    }

    // 添加返回类型注解（TypeScript）
    const returnTypeNode = this.findChildByField(methodNode, 'return_type');
    if (returnTypeNode) {
      methodInfo += `: ${this.getNodeText(returnTypeNode)}`;
    }

    return methodInfo;
  }

  /**
   * 提取字段信息
   * @param fieldNode 字段节点
   * @returns 字段信息字符串
   */
  private extractFieldInfo(fieldNode: Parser.SyntaxNode): string | null {
    return this.getNodeText(fieldNode);
  }

  /**
   * 提取属性信息
   * @param propertyNode 属性节点
   * @returns 属性信息字符串
   */
  private extractPropertyInfo(propertyNode: Parser.SyntaxNode): string | null {
    return this.getNodeText(propertyNode);
  }
}

/**
 * TypeScript代码AST解析器
 * 继承自JavaScriptParser，添加TypeScript特定功能
 */
export class TypeScriptParser extends JavaScriptParser {
  constructor() {
    super();
    this.language = 'typescript';
    this.parser.setLanguage(TypeScript);
  }
}
