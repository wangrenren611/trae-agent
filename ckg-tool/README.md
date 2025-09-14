# CKG工具 - Node.js版本

一个强大的代码知识图谱工具，用于构建和查询代码库的结构化索引。支持多种编程语言，提供高效的代码搜索和分析功能。

## 🚀 特性

- **多语言支持**: 支持Python、JavaScript、TypeScript、Java、C/C++等主流编程语言
- **智能缓存**: 基于代码库快照哈希的智能缓存机制，避免重复构建
- **高效查询**: 基于SQLite的快速精确匹配查询
- **AST解析**: 使用Tree-sitter进行精确的语法树解析
- **类型安全**: 完整的TypeScript类型定义
- **易于使用**: 简洁的API设计，支持异步操作

## 📦 安装

```bash
# 克隆项目
git clone <repository-url>
cd ckg-tool

# 安装依赖
npm install

# 构建项目
npm run build
```

## 🛠️ 快速开始

### 基本使用

```typescript
import { CKGTool, ToolArguments } from './src/index';

async function example() {
  // 创建CKG工具实例
  const ckgTool = new CKGTool();
  
  // 搜索函数
  const result = await ckgTool.execute({
    command: 'search_function',
    path: '/path/to/your/codebase',
    identifier: 'calculate_total',
    printBody: true
  });
  
  if (result.success) {
    console.log('搜索结果:', result.output);
  } else {
    console.error('搜索失败:', result.error);
  }
  
  // 清理资源
  ckgTool.closeAll();
}
```

### 支持的命令

1. **search_function**: 搜索独立函数
2. **search_class**: 搜索类定义
3. **search_class_method**: 搜索类方法

## 📚 API文档

### CKGTool类

#### 构造函数
```typescript
const ckgTool = new CKGTool();
```

#### 主要方法

##### execute(arguments: ToolArguments): Promise<ToolExecResult>
执行CKG工具命令

**参数:**
- `command`: 命令类型 ('search_function' | 'search_class' | 'search_class_method')
- `path`: 代码库路径
- `identifier`: 搜索标识符
- `printBody`: 是否打印代码体 (可选，默认true)

**返回值:**
```typescript
interface ToolExecResult {
  success: boolean;
  output?: string;
  error?: string;
  errorCode?: number;
}
```

##### updateCodebase(codebasePath: string): Promise<ToolExecResult>
更新代码库的CKG

##### getCodebaseSnapshot(codebasePath: string): CodebaseSnapshot | null
获取代码库快照信息

##### closeAll(): void
关闭所有数据库连接

## 🔧 配置

### 支持的编程语言

| 语言 | 文件扩展名 |
|------|------------|
| Python | .py |
| JavaScript | .js, .jsx |
| TypeScript | .ts, .tsx |
| Java | .java |
| C++ | .cpp, .hpp, .c++, .cxx, .cc |
| C | .c, .h |

### 数据库配置

```typescript
// 默认配置
const DATABASE_CONFIG = {
  databasePath: './ckg-storage',
  storageInfoPath: './ckg-storage/storage_info.json',
  expiryTime: 60 * 60 * 24 * 7, // 7天
};
```

## 📊 使用示例

### 示例1: 搜索函数

```typescript
const result = await ckgTool.execute({
  command: 'search_function',
  path: '/path/to/project',
  identifier: 'main',
  printBody: true
});
```

**输出示例:**
```
找到 1 个名为 main 的函数:

1. /path/to/project/src/app.py:10-25
def main():
    """应用程序入口点"""
    app = create_app()
    app.run(debug=True)
```

### 示例2: 搜索类

```typescript
const result = await ckgTool.execute({
  command: 'search_class',
  path: '/path/to/project',
  identifier: 'UserManager',
  printBody: true
});
```

**输出示例:**
```
找到 1 个名为 UserManager 的类:

1. /path/to/project/src/auth.py:15-45
字段:
- username: str
- email: str

方法:
- def create_user(self, username: str, email: str) -> User
- def authenticate(self, username: str, password: str) -> bool

class UserManager:
    def __init__(self, db_connection):
        self.db = db_connection
    
    def create_user(self, username: str, email: str) -> User:
        # 实现代码...
```

### 示例3: 搜索类方法

```typescript
const result = await ckgTool.execute({
  command: 'search_class_method',
  path: '/path/to/project',
  identifier: 'authenticate',
  printBody: true
});
```

**输出示例:**
```
找到 1 个名为 authenticate 的类方法:

1. /path/to/project/src/auth.py:25-35 在类 UserManager 中
def authenticate(self, username: str, password: str) -> bool:
    """验证用户身份"""
    user = self.get_user_by_username(username)
    if user and verify_password(password, user.password_hash):
        return True
    return False
```

## 🏗️ 架构设计

### 核心组件

1. **CKGTool**: 主工具类，提供统一的API接口
2. **CKGDatabase**: 数据库管理类，处理SQLite操作
3. **ASTParser**: AST解析器基类，定义解析接口
4. **ParserFactory**: 解析器工厂，根据文件类型创建解析器
5. **HashUtils**: 哈希工具，计算代码库快照哈希

### 工作流程

1. **初始化**: 创建CKG工具实例
2. **参数验证**: 验证输入参数的有效性
3. **数据库管理**: 获取或创建代码库的CKG数据库
4. **AST解析**: 使用Tree-sitter解析代码文件
5. **数据存储**: 将解析结果存储到SQLite数据库
6. **查询执行**: 根据命令类型执行相应的查询
7. **结果返回**: 格式化并返回查询结果

## 🔍 代码逻辑流程

详细的代码逻辑流程图请参考 [flowchart.md](./docs/flowchart.md)

## 🧪 测试

```bash
# 运行测试
npm test

# 运行示例
npm run dev
```

## 📝 开发指南

### 项目结构

```
ckg-tool/
├── src/                    # 源代码
│   ├── types/             # 类型定义
│   ├── constants/         # 常量定义
│   ├── utils/             # 工具函数
│   ├── parsers/           # AST解析器
│   ├── database/          # 数据库操作
│   ├── CKGTool.ts         # 主工具类
│   └── index.ts           # 入口文件
├── examples/              # 使用示例
├── docs/                  # 文档
├── dist/                  # 构建输出
└── test-projects/         # 测试项目
```

### 添加新语言支持

1. 安装对应的Tree-sitter语言包
2. 创建新的解析器类，继承自`ASTParser`
3. 在`ParserFactory`中注册新解析器
4. 更新`EXTENSION_TO_LANGUAGE`映射

### 性能优化

- 使用智能缓存避免重复构建
- 支持增量更新
- 异步处理提高响应速度
- 内存管理避免内存泄漏

## ⚠️ 已知限制

1. 当对已经索引过的代码库的子目录进行索引时，会重新为该子目录构建CKG
2. 重建逻辑可以通过只重建已修改的文件来改进
3. 对于JavaScript和TypeScript，AST不完整：匿名函数、箭头函数等未被解析

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个项目。

## 📄 许可证

MIT License

## 🔗 相关链接

- [Tree-sitter](https://tree-sitter.github.io/)
- [SQLite](https://www.sqlite.org/)
- [TypeScript](https://www.typescriptlang.org/)

---

**注意**: 这是一个Node.js版本的CKG工具实现，基于原始的Python版本进行重新设计和优化。
