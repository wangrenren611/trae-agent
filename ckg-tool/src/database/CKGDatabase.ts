/**
 * CKG数据库管理类
 * 负责SQLite数据库的创建、管理和查询操作
 */

import * as sqlite3 from 'sqlite3';
import * as fs from 'fs-extra';
import * as path from 'path';
import { FunctionEntry, ClassEntry, CodebaseSnapshot } from '../types';
import { SQL_TABLES, DATABASE_CONFIG } from '../constants';
import { getFolderSnapshotHash, getCkgDatabasePath } from '../utils/hash';
import { ParserFactory } from '../parsers/ParserFactory';

/**
 * CKG数据库类
 * 管理代码知识图谱的SQLite数据库
 */
export class CKGDatabase {
  private db: sqlite3.Database;
  private codebasePath: string;
  private snapshotHash: string;

  /**
   * 构造函数
   * @param codebasePath 代码库路径
   */
  constructor(codebasePath: string) {
    this.codebasePath = codebasePath;
    this.snapshotHash = getFolderSnapshotHash(codebasePath);
    
    // 确保存储目录存在
    this.ensureStorageDirectory();
    
    // 初始化数据库
    this.initializeDatabase();
  }

  /**
   * 确保存储目录存在
   */
  private ensureStorageDirectory(): void {
    const storageDir = path.dirname(DATABASE_CONFIG.databasePath);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
  }

  /**
   * 初始化数据库
   */
  private initializeDatabase(): void {
    const databasePath = getCkgDatabasePath(this.snapshotHash);
    
    // 检查是否已存在数据库
    if (fs.existsSync(databasePath)) {
      // 复用现有数据库
      this.db = new sqlite3.Database(databasePath);
    } else {
      // 创建新数据库
      this.db = new sqlite3.Database(databasePath);
      this.createTables();
      this.buildCKG();
    }
  }

  /**
   * 创建数据库表
   */
  private createTables(): void {
    return new Promise<void>((resolve, reject) => {
      this.db.serialize(() => {
        // 创建函数表
        this.db.run(SQL_TABLES.functions, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        // 创建类表
        this.db.run(SQL_TABLES.classes, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        this.db.run('COMMIT', (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
  }

  /**
   * 构建代码知识图谱
   */
  private buildCKG(): void {
    console.log(`开始构建代码知识图谱: ${this.codebasePath}`);
    
    // 递归遍历代码库文件
    this.traverseCodebase(this.codebasePath);
    
    console.log(`代码知识图谱构建完成: ${this.codebasePath}`);
  }

  /**
   * 递归遍历代码库
   * @param dirPath 目录路径
   */
  private traverseCodebase(dirPath: string): void {
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);
        
        // 跳过隐藏文件和目录
        if (item.startsWith('.')) {
          continue;
        }
        
        if (stat.isDirectory()) {
          // 递归处理子目录
          this.traverseCodebase(itemPath);
        } else if (stat.isFile()) {
          // 处理文件
          this.processFile(itemPath);
        }
      }
    } catch (error) {
      console.error(`遍历目录失败: ${dirPath}`, error);
    }
  }

  /**
   * 处理单个文件
   * @param filePath 文件路径
   */
  private processFile(filePath: string): void {
    // 检查文件是否支持解析
    if (!ParserFactory.isSupportedFile(filePath)) {
      return;
    }

    try {
      // 读取文件内容
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // 获取解析器
      const parser = ParserFactory.getParserByPath(filePath);
      if (!parser) {
        return;
      }

      // 解析文件
      const { functions, classes } = parser.parseFile(fileContent, filePath);
      
      // 存储到数据库
      this.storeFunctions(functions);
      this.storeClasses(classes);
      
    } catch (error) {
      console.error(`处理文件失败: ${filePath}`, error);
    }
  }

  /**
   * 存储函数到数据库
   * @param functions 函数列表
   */
  private storeFunctions(functions: FunctionEntry[]): void {
    for (const func of functions) {
      this.db.run(
        `INSERT INTO functions (name, file_path, body, start_line, end_line, parent_function, parent_class)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          func.name,
          func.filePath,
          func.body,
          func.startLine,
          func.endLine,
          func.parentFunction || null,
          func.parentClass || null
        ],
        (err) => {
          if (err) {
            console.error(`存储函数失败: ${func.name}`, err);
          }
        }
      );
    }
  }

  /**
   * 存储类到数据库
   * @param classes 类列表
   */
  private storeClasses(classes: ClassEntry[]): void {
    for (const cls of classes) {
      this.db.run(
        `INSERT INTO classes (name, file_path, body, fields, methods, start_line, end_line)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          cls.name,
          cls.filePath,
          cls.body,
          cls.fields || null,
          cls.methods || null,
          cls.startLine,
          cls.endLine
        ],
        (err) => {
          if (err) {
            console.error(`存储类失败: ${cls.name}`, err);
          }
        }
      );
    }
  }

  /**
   * 查询函数
   * @param identifier 函数标识符
   * @param entryType 条目类型
   * @returns 函数列表
   */
  public queryFunction(identifier: string, entryType: 'function' | 'class_method' = 'function'): Promise<FunctionEntry[]> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT name, file_path, body, start_line, end_line, parent_function, parent_class
        FROM functions
        WHERE name = ?
      `;
      
      this.db.all(query, [identifier], (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const functions: FunctionEntry[] = [];
        for (const row of rows) {
          if (entryType === 'function' && !row.parent_class) {
            // 独立函数
            functions.push({
              name: row.name,
              filePath: row.file_path,
              body: row.body,
              startLine: row.start_line,
              endLine: row.end_line,
              parentFunction: row.parent_function,
              parentClass: row.parent_class
            });
          } else if (entryType === 'class_method' && row.parent_class) {
            // 类方法
            functions.push({
              name: row.name,
              filePath: row.file_path,
              body: row.body,
              startLine: row.start_line,
              endLine: row.end_line,
              parentFunction: row.parent_function,
              parentClass: row.parent_class
            });
          }
        }

        resolve(functions);
      });
    });
  }

  /**
   * 查询类
   * @param identifier 类标识符
   * @returns 类列表
   */
  public queryClass(identifier: string): Promise<ClassEntry[]> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT name, file_path, body, fields, methods, start_line, end_line
        FROM classes
        WHERE name = ?
      `;
      
      this.db.all(query, [identifier], (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const classes: ClassEntry[] = [];
        for (const row of rows) {
          classes.push({
            name: row.name,
            filePath: row.file_path,
            body: row.body,
            startLine: row.start_line,
            endLine: row.end_line,
            fields: row.fields,
            methods: row.methods
          });
        }

        resolve(classes);
      });
    });
  }

  /**
   * 更新CKG数据库
   * 重新构建代码知识图谱
   */
  public update(): void {
    console.log(`更新代码知识图谱: ${this.codebasePath}`);
    
    // 清空现有数据
    this.clearDatabase();
    
    // 重新构建
    this.buildCKG();
  }

  /**
   * 清空数据库
   */
  private clearDatabase(): void {
    this.db.serialize(() => {
      this.db.run('DELETE FROM functions');
      this.db.run('DELETE FROM classes');
    });
  }

  /**
   * 关闭数据库连接
   */
  public close(): void {
    if (this.db) {
      this.db.close();
    }
  }

  /**
   * 获取代码库快照信息
   * @returns 快照信息
   */
  public getSnapshot(): CodebaseSnapshot {
    const stat = fs.statSync(this.codebasePath);
    return {
      hash: this.snapshotHash,
      path: this.codebasePath,
      createdAt: stat.birthtime,
      lastModified: stat.mtime
    };
  }
}
