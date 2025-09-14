# CKG工具代码流程详细说明

## 概述

CKG工具是一个用于构建和查询代码知识图谱的Node.js工具。它通过AST解析技术将代码库转换为结构化的知识图谱，支持快速搜索函数、类和方法。

## 核心流程详解

### 1. 工具初始化流程

```typescript
// 1. 创建CKG工具实例
const ckgTool = new CKGTool();

// 2. 内部初始化
class CKGTool {
  constructor() {
    this.databases = new Map(); // 初始化数据库映射
  }
}
```

**流程说明:**
- 创建工具实例时，初始化内部数据库映射表
- 数据库映射表用于缓存不同代码库的CKG数据库实例
- 采用懒加载策略，只有在实际使用时才创建数据库

### 2. 命令执行流程

```typescript
// 执行命令的完整流程
async execute(arguments: ToolArguments): Promise<ToolExecResult> {
  // 步骤1: 参数验证
  const validationResult = this.validateArguments(arguments);
  if (!validationResult.success) {
    return validationResult;
  }

  // 步骤2: 获取或创建数据库
  const database = await this.getOrCreateDatabase(arguments.path);

  // 步骤3: 执行具体命令
  switch (arguments.command) {
    case 'search_function':
      return await this.searchFunction(database, arguments.identifier, arguments.printBody);
    case 'search_class':
      return await this.searchClass(database, arguments.identifier, arguments.printBody);
    case 'search_class_method':
      return await this.searchClassMethod(database, arguments.identifier, arguments.printBody);
  }
}
```

**详细步骤:**

#### 步骤1: 参数验证
```typescript
private validateArguments(arguments: ToolArguments): ToolExecResult {
  // 检查必需参数
  if (!arguments.command) return { success: false, error: '缺少命令参数' };
  if (!arguments.path) return { success: false, error: '缺少路径参数' };
  if (!arguments.identifier) return { success: false, error: '缺少标识符参数' };

  // 检查路径有效性
  if (!fs.existsSync(arguments.path)) {
    return { success: false, error: `代码库路径不存在: ${arguments.path}` };
  }

  if (!fs.statSync(arguments.path).isDirectory()) {
    return { success: false, error: `代码库路径不是目录: ${arguments.path}` };
  }

  return { success: true };
}
```

#### 步骤2: 数据库管理
```typescript
private async getOrCreateDatabase(codebasePath: string): Promise<CKGDatabase> {
  const normalizedPath = path.resolve(codebasePath);
  
  // 检查是否已有缓存
  if (this.databases.has(normalizedPath)) {
    return this.databases.get(normalizedPath)!;
  }

  // 创建新数据库实例
  const database = new CKGDatabase(normalizedPath);
  this.databases.set(normalizedPath, database);
  return database;
}
```

### 3. CKG数据库构建流程

```typescript
class CKGDatabase {
  constructor(codebasePath: string) {
    this.codebasePath = codebasePath;
    this.snapshotHash = getFolderSnapshotHash(codebasePath);
    
    // 确保存储目录存在
    this.ensureStorageDirectory();
    
    // 初始化数据库
    this.initializeDatabase();
  }
}
```

**详细流程:**

#### 3.1 快照哈希计算
```typescript
function getFolderSnapshotHash(folderPath: string): string {
  // 策略1: Git仓库
  if (isGitRepository(folderPath)) {
    return getGitStatusHash(folderPath); // 使用Git commit hash
  }
  
  // 策略2: 普通目录
  return getFileMetadataHash(folderPath); // 使用文件元数据hash
}
```

#### 3.2 数据库初始化
```typescript
private initializeDatabase(): void {
  const databasePath = getCkgDatabasePath(this.snapshotHash);
  
  if (fs.existsSync(databasePath)) {
    // 复用现有数据库
    this.db = new sqlite3.Database(databasePath);
  } else {
    // 创建新数据库
    this.db = new sqlite3.Database(databasePath);
    this.createTables();    // 创建表结构
    this.buildCKG();        // 构建代码知识图谱
  }
}
```

#### 3.3 表结构创建
```typescript
private createTables(): void {
  // 创建函数表
  this.db.run(`
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
  `);

  // 创建类表
  this.db.run(`
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
  `);
}
```

### 4. 代码解析流程

```typescript
private buildCKG(): void {
  console.log(`开始构建代码知识图谱: ${this.codebasePath}`);
  
  // 递归遍历代码库文件
  this.traverseCodebase(this.codebasePath);
  
  console.log(`代码知识图谱构建完成: ${this.codebasePath}`);
}
```

**详细步骤:**

#### 4.1 文件遍历
```typescript
private traverseCodebase(dirPath: string): void {
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stat = fs.statSync(itemPath);
    
    // 跳过隐藏文件和目录
    if (item.startsWith('.')) continue;
    
    if (stat.isDirectory()) {
      // 递归处理子目录
      this.traverseCodebase(itemPath);
    } else if (stat.isFile()) {
      // 处理文件
      this.processFile(itemPath);
    }
  }
}
```

#### 4.2 文件处理
```typescript
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
    if (!parser) return;

    // 解析文件
    const { functions, classes } = parser.parseFile(fileContent, filePath);
    
    // 存储到数据库
    this.storeFunctions(functions);
    this.storeClasses(classes);
    
  } catch (error) {
    console.error(`处理文件失败: ${filePath}`, error);
  }
}
```

### 5. AST解析流程

```typescript
// 以Python解析器为例
export class PythonParser extends ASTParser {
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
}
```

**解析步骤:**

1. **节点类型识别**: 根据AST节点类型判断是函数、类还是其他结构
2. **信息提取**: 从节点中提取名称、位置、代码体等信息
3. **关系建立**: 建立父子关系（嵌套函数、类方法等）
4. **递归遍历**: 深度优先遍历所有子节点
5. **结果收集**: 将解析结果添加到结果列表中

### 6. 数据存储流程

```typescript
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
```

**存储特点:**
- 使用参数化查询防止SQL注入
- 异步执行提高性能
- 错误处理确保数据完整性
- 支持事务操作

### 7. 查询执行流程

```typescript
// 函数查询示例
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
```

**查询特点:**
- 精确匹配查询
- 支持类型过滤（函数vs方法）
- 返回完整代码上下文
- 异步Promise接口

### 8. 结果格式化流程

```typescript
private async searchFunction(
  database: CKGDatabase,
  identifier: string,
  printBody: boolean = true
): Promise<ToolExecResult> {
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
}
```

**格式化特点:**
- 结构化输出格式
- 支持代码体显示控制
- 长度限制和截断处理
- 错误信息友好显示

## 性能优化策略

### 1. 智能缓存
- 基于代码库快照哈希的缓存机制
- 避免重复构建相同代码库的CKG
- 自动检测代码变化并重新构建

### 2. 懒加载
- 只有在实际使用时才创建数据库
- 解析器实例复用
- 按需加载语言支持

### 3. 异步处理
- 所有I/O操作都是异步的
- 数据库查询使用Promise接口
- 支持并发处理

### 4. 内存管理
- 及时关闭数据库连接
- 清理解析器缓存
- 避免内存泄漏

## 错误处理机制

### 1. 参数验证
- 严格的参数类型检查
- 路径有效性验证
- 友好的错误消息

### 2. 异常捕获
- 文件操作异常处理
- 数据库操作异常处理
- AST解析异常处理

### 3. 资源清理
- 自动关闭数据库连接
- 清理临时文件
- 释放系统资源

## 扩展性设计

### 1. 语言支持扩展
- 插件化的解析器架构
- 统一的AST解析接口
- 易于添加新语言支持

### 2. 功能扩展
- 模块化的工具设计
- 可扩展的查询接口
- 灵活的配置系统

### 3. 性能扩展
- 支持分布式处理
- 可配置的缓存策略
- 可扩展的存储后端

这个详细的代码流程说明展示了CKG工具的完整工作流程，从初始化到查询执行的每个步骤都有详细的说明和代码示例。
