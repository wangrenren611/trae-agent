/**
 * CKG工具主类
 * 提供代码知识图谱的构建和查询功能
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { FunctionEntry, ClassEntry, ToolArguments, ToolExecResult, CKGToolCommand } from './types';
import { CKGDatabase } from './database/CKGDatabase';
import { MAX_RESPONSE_LEN, TRUNCATED_MESSAGE } from './constants';

/**
 * CKG工具类
 * 实现代码知识图谱的构建、查询和管理功能
 */
export class CKGTool {
  private databases: Map<string, CKGDatabase> = new Map();

  /**
   * 执行CKG工具命令
   * @param arguments 工具参数
   * @returns 执行结果
   */
  public async execute(arguments: ToolArguments): Promise<ToolExecResult> {
    try {
      // 验证参数
      const validationResult = this.validateArguments(arguments);
      if (!validationResult.success) {
        return validationResult;
      }

      // 获取或创建数据库
      const database = await this.getOrCreateDatabase(arguments.path);

      // 执行具体命令
      switch (arguments.command) {
        case 'search_function':
          return await this.searchFunction(database, arguments.identifier, arguments.printBody);
        case 'search_class':
          return await this.searchClass(database, arguments.identifier, arguments.printBody);
        case 'search_class_method':
          return await this.searchClassMethod(database, arguments.identifier, arguments.printBody);
        default:
          return {
            success: false,
            error: `不支持的命令: ${arguments.command}`,
            errorCode: -1
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `执行CKG工具时发生错误: ${error}`,
        errorCode: -1
      };
    }
  }

  /**
   * 验证工具参数
   * @param arguments 工具参数
   * @returns 验证结果
   */
  private validateArguments(arguments: ToolArguments): ToolExecResult {
    if (!arguments.command) {
      return {
        success: false,
        error: '缺少命令参数',
        errorCode: -1
      };
    }

    if (!arguments.path) {
      return {
        success: false,
        error: '缺少路径参数',
        errorCode: -1
      };
    }

    if (!arguments.identifier) {
      return {
        success: false,
        error: '缺少标识符参数',
        errorCode: -1
      };
    }

    // 检查路径是否存在
    if (!fs.existsSync(arguments.path)) {
      return {
        success: false,
        error: `代码库路径不存在: ${arguments.path}`,
        errorCode: -1
      };
    }

    // 检查路径是否为目录
    if (!fs.statSync(arguments.path).isDirectory()) {
      return {
        success: false,
        error: `代码库路径不是目录: ${arguments.path}`,
        errorCode: -1
      };
    }

    return { success: true };
  }

  /**
   * 获取或创建数据库
   * @param codebasePath 代码库路径
   * @returns CKG数据库实例
   */
  private async getOrCreateDatabase(codebasePath: string): Promise<CKGDatabase> {
    const normalizedPath = path.resolve(codebasePath);
    
    if (this.databases.has(normalizedPath)) {
      return this.databases.get(normalizedPath)!;
    }

    const database = new CKGDatabase(normalizedPath);
    this.databases.set(normalizedPath, database);
    return database;
  }

  /**
   * 搜索函数
   * @param database 数据库实例
   * @param identifier 函数标识符
   * @param printBody 是否打印函数体
   * @returns 搜索结果
   */
  private async searchFunction(
    database: CKGDatabase,
    identifier: string,
    printBody: boolean = true
  ): Promise<ToolExecResult> {
    try {
      const functions = await database.queryFunction(identifier, 'function');

      if (functions.length === 0) {
        return {
          success: true,
          output: `未找到名为 ${identifier} 的函数`
        };
      }

      let output = `找到 ${functions.length} 个名为 ${identifier} 的函数:\n\n`;
      let index = 1;

      for (const func of functions) {
        output += `${index}. ${func.filePath}:${func.startLine}-${func.endLine}\n`;
        
        if (printBody) {
          output += `${func.body}\n\n`;
        }

        index++;

        // 检查输出长度限制
        if (output.length > MAX_RESPONSE_LEN) {
          output = output.substring(0, MAX_RESPONSE_LEN) + 
                   `\n${TRUNCATED_MESSAGE} ${functions.length - index + 1} 个条目未显示`;
          break;
        }
      }

      return {
        success: true,
        output: output.trim()
      };
    } catch (error) {
      return {
        success: false,
        error: `搜索函数时发生错误: ${error}`,
        errorCode: -1
      };
    }
  }

  /**
   * 搜索类
   * @param database 数据库实例
   * @param identifier 类标识符
   * @param printBody 是否打印类体
   * @returns 搜索结果
   */
  private async searchClass(
    database: CKGDatabase,
    identifier: string,
    printBody: boolean = true
  ): Promise<ToolExecResult> {
    try {
      const classes = await database.queryClass(identifier);

      if (classes.length === 0) {
        return {
          success: true,
          output: `未找到名为 ${identifier} 的类`
        };
      }

      let output = `找到 ${classes.length} 个名为 ${identifier} 的类:\n\n`;
      let index = 1;

      for (const cls of classes) {
        output += `${index}. ${cls.filePath}:${cls.startLine}-${cls.endLine}\n`;
        
        if (cls.fields) {
          output += `字段:\n${cls.fields}\n`;
        }
        
        if (cls.methods) {
          output += `方法:\n${cls.methods}\n`;
        }
        
        if (printBody) {
          output += `${cls.body}\n\n`;
        }

        index++;

        // 检查输出长度限制
        if (output.length > MAX_RESPONSE_LEN) {
          output = output.substring(0, MAX_RESPONSE_LEN) + 
                   `\n${TRUNCATED_MESSAGE} ${classes.length - index + 1} 个条目未显示`;
          break;
        }
      }

      return {
        success: true,
        output: output.trim()
      };
    } catch (error) {
      return {
        success: false,
        error: `搜索类时发生错误: ${error}`,
        errorCode: -1
      };
    }
  }

  /**
   * 搜索类方法
   * @param database 数据库实例
   * @param identifier 方法标识符
   * @param printBody 是否打印方法体
   * @returns 搜索结果
   */
  private async searchClassMethod(
    database: CKGDatabase,
    identifier: string,
    printBody: boolean = true
  ): Promise<ToolExecResult> {
    try {
      const methods = await database.queryFunction(identifier, 'class_method');

      if (methods.length === 0) {
        return {
          success: true,
          output: `未找到名为 ${identifier} 的类方法`
        };
      }

      let output = `找到 ${methods.length} 个名为 ${identifier} 的类方法:\n\n`;
      let index = 1;

      for (const method of methods) {
        output += `${index}. ${method.filePath}:${method.startLine}-${method.endLine} 在类 ${method.parentClass} 中\n`;
        
        if (printBody) {
          output += `${method.body}\n\n`;
        }

        index++;

        // 检查输出长度限制
        if (output.length > MAX_RESPONSE_LEN) {
          output = output.substring(0, MAX_RESPONSE_LEN) + 
                   `\n${TRUNCATED_MESSAGE} ${methods.length - index + 1} 个条目未显示`;
          break;
        }
      }

      return {
        success: true,
        output: output.trim()
      };
    } catch (error) {
      return {
        success: false,
        error: `搜索类方法时发生错误: ${error}`,
        errorCode: -1
      };
    }
  }

  /**
   * 更新代码库的CKG
   * @param codebasePath 代码库路径
   * @returns 更新结果
   */
  public async updateCodebase(codebasePath: string): Promise<ToolExecResult> {
    try {
      const normalizedPath = path.resolve(codebasePath);
      const database = this.databases.get(normalizedPath);
      
      if (!database) {
        return {
          success: false,
          error: `未找到代码库的CKG数据库: ${codebasePath}`,
          errorCode: -1
        };
      }

      database.update();
      
      return {
        success: true,
        output: `代码库CKG更新完成: ${codebasePath}`
      };
    } catch (error) {
      return {
        success: false,
        error: `更新代码库CKG时发生错误: ${error}`,
        errorCode: -1
      };
    }
  }

  /**
   * 获取代码库快照信息
   * @param codebasePath 代码库路径
   * @returns 快照信息
   */
  public getCodebaseSnapshot(codebasePath: string) {
    const normalizedPath = path.resolve(codebasePath);
    const database = this.databases.get(normalizedPath);
    
    if (!database) {
      return null;
    }

    return database.getSnapshot();
  }

  /**
   * 关闭所有数据库连接
   */
  public closeAll(): void {
    for (const database of this.databases.values()) {
      database.close();
    }
    this.databases.clear();
  }

  /**
   * 获取工具描述
   * @returns 工具描述
   */
  public getDescription(): string {
    return `查询代码库的代码知识图谱。
* 状态在命令调用和用户讨论之间保持持久
* \`search_function\` 命令在代码库中搜索函数
* \`search_class\` 命令在代码库中搜索类
* \`search_class_method\` 命令在代码库中搜索类方法
* 如果命令生成长输出，将被截断并标记为 \`<response clipped>\`
* 如果找到多个条目，工具将返回所有条目直到达到截断限制
* 默认情况下，工具将打印函数或类的主体以及文件路径和行号。您可以通过将 \`print_body\` 参数设置为 \`false\` 来禁用此功能
* CKG不是完全准确的，可能无法找到代码库中的所有函数或类`;
  }

  /**
   * 获取支持的命令列表
   * @returns 命令列表
   */
  public getSupportedCommands(): CKGToolCommand[] {
    return ['search_function', 'search_class', 'search_class_method'];
  }
}
