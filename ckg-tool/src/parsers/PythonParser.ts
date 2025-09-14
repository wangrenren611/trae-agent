/**
 * Python AST解析器
 * 专门用于解析Python代码的AST结构
 */

import * as Parser from 'tree-sitter';
import Python from 'tree-sitter-python';
import { ASTParser } from './ASTParser';
import { FunctionEntry, ClassEntry } from '../types';

/**
 * Python代码AST解析器
 * 继承自ASTParser，实现Python特定的解析逻辑
 */
export class PythonParser extends ASTParser {
  constructor() {
    super('python');
    this.parser.setLanguage(Python);
  }

  /**
   * 递归访问Python AST节点
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
    // 处理函数定义
    if (node.type === 'function_definition') {
      const functionEntry = this.parseFunctionDefinition(node, filePath, parentClass, parentFunction);
      if (functionEntry) {
        functions.push(functionEntry);
        parentFunction = functionEntry;
      }
    }
    // 处理类定义
    else if (node.type === 'class_definition') {
      const classEntry = this.parseClassDefinition(node, filePath);
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
   * 解析函数定义节点
   * @param node 函数定义节点
   * @param filePath 文件路径
   * @param parentClass 父类
   * @param parentFunction 父函数
   * @returns 函数条目
   */
  private parseFunctionDefinition(
    node: Parser.SyntaxNode,
    filePath: string,
    parentClass?: ClassEntry,
    parentFunction?: FunctionEntry
  ): FunctionEntry | null {
    // 获取函数名
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
   * 解析类定义节点
   * @param node 类定义节点
   * @param filePath 文件路径
   * @returns 类条目
   */
  private parseClassDefinition(node: Parser.SyntaxNode, filePath: string): ClassEntry | null {
    // 获取类名
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

        // 处理装饰器定义（如@staticmethod）
        if (child.type === 'decorated_definition') {
          const definition = this.findChildByField(child, 'definition');
          if (definition && definition.type === 'function_definition') {
            const methodInfo = this.extractMethodInfo(definition);
            if (methodInfo) {
              methods += `- ${methodInfo}\n`;
            }
          }
        }
        // 处理普通函数定义
        else if (child.type === 'function_definition') {
          const methodInfo = this.extractMethodInfo(child);
          if (methodInfo) {
            methods += `- ${methodInfo}\n`;
          }
        }
        // 处理类变量/字段
        else if (child.type === 'expression_statement') {
          const assignment = this.findChildByField(child, 'expression');
          if (assignment && assignment.type === 'assignment') {
            const fieldInfo = this.extractFieldInfo(assignment);
            if (fieldInfo) {
              fields += `- ${fieldInfo}\n`;
            }
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

    // 添加返回类型注解
    const returnTypeNode = this.findChildByField(methodNode, 'return_type');
    if (returnTypeNode) {
      methodInfo += ` -> ${this.getNodeText(returnTypeNode)}`;
    }

    return methodInfo;
  }

  /**
   * 提取字段信息
   * @param assignmentNode 赋值节点
   * @returns 字段信息字符串
   */
  private extractFieldInfo(assignmentNode: Parser.SyntaxNode): string | null {
    const leftNode = this.findChildByField(assignmentNode, 'left');
    if (!leftNode) {
      return null;
    }

    return this.getNodeText(assignmentNode);
  }
}
