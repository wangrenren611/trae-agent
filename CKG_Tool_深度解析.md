# 🧠 CKGTool (代码知识图谱工具) 深度解析

## 📋 概述

CKGTool是Trae Agent中的核心工具之一，用于构建和查询代码知识图谱(Code Knowledge Graph)。它通过AST解析技术将代码库转换为结构化的知识图谱，支持快速搜索函数、类和方法。

---

## 🏗️ 架构设计

### 1. **整体架构图**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   代码库文件     │ -> │   Tree-sitter   │ -> │   AST解析       │
│  (.py, .java,   │    │   解析器        │    │   递归遍历      │
│   .cpp, .js)    │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         v                       v                       v
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   快照哈希      │    │   语言检测      │    │   结构化数据    │
│   (Git/文件)    │    │   (扩展名)      │    │   (Entry对象)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         v                       v                       v
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   缓存管理      │    │   数据库存储    │    │   查询接口      │
│   (7天过期)     │    │   (SQLite)      │    │   (搜索API)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 2. **核心组件**

#### **CKGTool类**
- 工具接口层，处理用户请求
- 管理多个代码库的CKG数据库
- 提供统一的搜索接口

#### **CKGDatabase类**
- 核心数据库管理
- AST解析和索引构建
- 查询执行和结果返回

#### **数据结构**
```python
@dataclass
class FunctionEntry:
    name: str                    # 函数名
    file_path: str              # 文件路径
    body: str                   # 函数体代码
    start_line: int             # 起始行号
    end_line: int               # 结束行号
    parent_function: str | None # 父函数（嵌套函数）
    parent_class: str | None    # 所属类（方法）

@dataclass
class ClassEntry:
    name: str                   # 类名
    file_path: str              # 文件路径
    body: str                   # 类体代码
    start_line: int             # 起始行号
    end_line: int               # 结束行号
    fields: str | None          # 字段列表
    methods: str | None         # 方法列表
```

---

## 🔧 技术实现详解

### 1. **多语言支持**

#### **支持的语言和文件扩展名**
```python
extension_to_language = {
    ".py": "python",           # Python
    ".java": "java",           # Java
    ".cpp": "cpp",             # C++
    ".hpp": "cpp",
    ".c++": "cpp",
    ".cxx": "cpp",
    ".cc": "cpp",
    ".c": "c",                 # C
    ".h": "c",
    ".ts": "typescript",       # TypeScript
    ".tsx": "typescript",
    ".js": "javascript",       # JavaScript
    ".jsx": "javascript",
}
```

#### **Tree-sitter解析器**
- 使用`tree-sitter-languages`库获取语言解析器
- 支持增量解析和错误恢复
- 提供精确的语法树结构

### 2. **AST解析机制**

#### **Python解析示例**
```python
def _recursive_visit_python(self, root_node: Node, file_path: str, 
                           parent_class: ClassEntry | None = None,
                           parent_function: FunctionEntry | None = None):
    if root_node.type == "function_definition":
        # 提取函数信息
        function_name_node = root_node.child_by_field_name("name")
        if function_name_node:
            function_entry = FunctionEntry(
                name=function_name_node.text.decode(),
                file_path=file_path,
                body=root_node.text.decode(),
                start_line=root_node.start_point[0] + 1,
                end_line=root_node.end_point[0] + 1,
            )
            # 处理嵌套关系
            if parent_class:
                function_entry.parent_class = parent_class.name
            self._insert_entry(function_entry)
    
    elif root_node.type == "class_definition":
        # 提取类信息
        class_name_node = root_node.child_by_field_name("name")
        if class_name_node:
            class_entry = ClassEntry(...)
            # 提取类方法和字段
            self._extract_class_members(root_node, class_entry)
            self._insert_entry(class_entry)
    
    # 递归处理子节点
    for child in root_node.children:
        self._recursive_visit_python(child, file_path, parent_class, parent_function)
```

#### **Java解析特点**
- 支持`class_declaration`和`method_declaration`
- 提取字段声明(`field_declaration`)
- 处理访问修饰符和返回类型

#### **C++解析特点**
- 支持`class_specifier`和`function_definition`
- 区分字段和方法声明
- 处理复杂的模板语法

### 3. **数据库设计**

#### **SQLite表结构**
```sql
-- 函数表
CREATE TABLE IF NOT EXISTS functions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                    -- 函数名
    file_path TEXT NOT NULL,              -- 文件路径
    body TEXT NOT NULL,                   -- 函数体
    start_line INTEGER NOT NULL,          -- 起始行
    end_line INTEGER NOT NULL,            -- 结束行
    parent_function TEXT,                 -- 父函数
    parent_class TEXT                     -- 所属类
);

-- 类表
CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                   -- 类名
    file_path TEXT NOT NULL,              -- 文件路径
    body TEXT NOT NULL,                   -- 类体
    fields TEXT,                          -- 字段列表
    methods TEXT,                         -- 方法列表
    start_line INTEGER NOT NULL,          -- 起始行
    end_line INTEGER NOT NULL             -- 结束行
);
```

### 4. **缓存和版本管理**

#### **快照哈希机制**
```python
def get_folder_snapshot_hash(folder_path: Path) -> str:
    """获取代码库快照哈希"""
    if is_git_repository(folder_path):
        return get_git_status_hash(folder_path)  # Git仓库使用commit hash
    else:
        return get_file_metadata_hash(folder_path)  # 普通目录使用文件元数据
```

#### **缓存策略**
- **Git仓库**: 使用`git rev-parse HEAD`获取commit hash
- **普通目录**: 使用文件修改时间和大小计算哈希
- **过期时间**: 7天自动清理旧数据库
- **增量更新**: 相同哈希复用现有数据库

---

## 🔍 搜索功能详解

### 1. **三种搜索类型**

#### **函数搜索** (`search_function`)
```python
def _search_function(self, ckg_database: CKGDatabase, identifier: str, print_body: bool = True) -> str:
    entries = ckg_database.query_function(identifier, entry_type="function")
    # 只返回独立函数，排除类方法
```

#### **类搜索** (`search_class`)
```python
def _search_class(self, ckg_database: CKGDatabase, identifier: str, print_body: bool = True) -> str:
    entries = ckg_database.query_class(identifier)
    # 返回类定义，包含字段和方法信息
```

#### **类方法搜索** (`search_class_method`)
```python
def _search_class_method(self, ckg_database: CKGDatabase, identifier: str, print_body: bool = True) -> str:
    entries = ckg_database.query_function(identifier, entry_type="class_method")
    # 只返回类方法，排除独立函数
```

### 2. **查询实现**

#### **函数查询**
```python
def query_function(self, identifier: str, entry_type: Literal["function", "class_method"] = "function") -> list[FunctionEntry]:
    records = self._db_connection.execute(
        """SELECT name, file_path, body, start_line, end_line, parent_function, parent_class 
           FROM functions WHERE name = ?""",
        (identifier,),
    ).fetchall()
    
    function_entries: list[FunctionEntry] = []
    for record in records:
        match entry_type:
            case "function":
                if record[6] is None:  # parent_class为None表示独立函数
                    function_entries.append(FunctionEntry(...))
            case "class_method":
                if record[6] is not None:  # parent_class不为None表示类方法
                    function_entries.append(FunctionEntry(...))
    return function_entries
```

#### **类查询**
```python
def query_class(self, identifier: str) -> list[ClassEntry]:
    records = self._db_connection.execute(
        """SELECT name, file_path, body, fields, methods, start_line, end_line 
           FROM classes WHERE name = ?""",
        (identifier,),
    ).fetchall()
    
    class_entries: list[ClassEntry] = []
    for record in records:
        class_entries.append(ClassEntry(...))
    return class_entries
```

---

## 📊 使用示例和最佳实践

### 1. **基本使用示例**

#### **搜索函数**
```json
{
  "name": "ckg",
  "arguments": {
    "command": "search_function",
    "path": "/path/to/project",
    "identifier": "calculate_total",
    "print_body": true
  }
}
```

**输出示例**:
```
Found 2 functions named calculate_total:

1. /path/to/project/src/utils.py:15-25
def calculate_total(items):
    """计算商品总价"""
    total = 0
    for item in items:
        total += item.price * item.quantity
    return total

2. /path/to/project/src/order.py:42-50
def calculate_total(order_items):
    """计算订单总金额"""
    return sum(item.amount for item in order_items)
```

#### **搜索类**
```json
{
  "name": "ckg",
  "arguments": {
    "command": "search_class",
    "path": "/path/to/project",
    "identifier": "UserManager",
    "print_body": true
  }
}
```

**输出示例**:
```
Found 1 classes named UserManager:

1. /path/to/project/src/auth.py:10-45
Fields:
- username: str
- email: str
- created_at: datetime

Methods:
- def create_user(self, username: str, email: str) -> User
- def authenticate(self, username: str, password: str) -> bool
- def delete_user(self, user_id: int) -> bool

class UserManager:
    def __init__(self, db_connection):
        self.db = db_connection
    
    def create_user(self, username: str, email: str) -> User:
        # 实现代码...
```

#### **搜索类方法**
```json
{
  "name": "ckg",
  "arguments": {
    "command": "search_class_method",
    "path": "/path/to/project",
    "identifier": "authenticate",
    "print_body": true
  }
}
```

**输出示例**:
```
Found 1 class methods named authenticate:

1. /path/to/project/src/auth.py:25-35 within class UserManager
def authenticate(self, username: str, password: str) -> bool:
    """验证用户身份"""
    user = self.get_user_by_username(username)
    if user and verify_password(password, user.password_hash):
        return True
    return False
```

### 2. **高级使用技巧**

#### **批量搜索策略**
```python
# 1. 先搜索类，了解整体结构
ckg.search_class("DatabaseManager")

# 2. 再搜索具体方法
ckg.search_class_method("connect")
ckg.search_class_method("execute_query")

# 3. 搜索相关工具函数
ckg.search_function("format_sql")
```

#### **代码理解工作流**
```python
# 1. 理解项目结构
ckg.search_class("MainApplication")

# 2. 找到入口点
ckg.search_function("main")
ckg.search_function("run")

# 3. 分析核心业务逻辑
ckg.search_class("OrderProcessor")
ckg.search_class_method("process_order")

# 4. 查找工具函数
ckg.search_function("validate_input")
ckg.search_function("format_output")
```

### 3. **性能优化建议**

#### **缓存利用**
- 首次构建CKG需要时间，后续查询很快
- 相同代码库的多次查询会复用缓存
- 建议在项目根目录使用，避免重复构建

#### **查询优化**
- 使用精确的函数/类名进行搜索
- 避免过于通用的名称（如`get`, `set`）
- 结合文件路径信息缩小搜索范围

#### **内存管理**
- CKG数据库按代码库路径缓存
- 7天后自动清理过期数据库
- 大型项目建议定期清理缓存

---

## ⚠️ 已知限制和注意事项

### 1. **解析限制**
```python
"""
Known issues:
1. When a subdirectory of a codebase that has already been indexed, 
   the CKG is built again for this subdirectory.
2. The rebuilding logic can be improved by only rebuilding for files 
   that have been modified.
3. For JavaScript and TypeScript, the AST is not complete: 
   anonymous functions, arrow functions, etc., are not parsed.
"""
```

### 2. **语言支持限制**
- **JavaScript/TypeScript**: 不支持匿名函数、箭头函数
- **Python**: 不支持动态生成的函数
- **C++**: 复杂模板语法可能解析不完整

### 3. **性能考虑**
- 大型代码库首次构建时间较长
- 内存占用与代码库大小成正比
- 建议在SSD上运行以获得更好性能

---

## 🚀 未来改进方向

### 1. **功能增强**
- 支持更多编程语言（Go, Rust, C#等）
- 添加变量和常量搜索
- 支持跨文件引用关系分析

### 2. **性能优化**
- 增量更新机制
- 并行解析支持
- 更智能的缓存策略

### 3. **用户体验**
- 模糊搜索支持
- 搜索结果排序
- 交互式查询界面

---

## 📝 总结

CKGTool是Trae Agent中一个功能强大且设计精良的工具，它通过以下特点实现了高效的代码理解：

### **核心优势**
- 🎯 **精确解析**: 基于Tree-sitter的AST解析
- 🚀 **高性能**: SQLite数据库 + 智能缓存
- 🌍 **多语言**: 支持6种主流编程语言
- 🔍 **灵活搜索**: 三种搜索模式满足不同需求
- 💾 **持久化**: 自动缓存管理，避免重复构建

### **适用场景**
- 大型代码库的快速导航
- 代码重构前的结构分析
- 新项目上手的代码理解
- 自动化代码分析和生成

CKGTool为Trae Agent提供了强大的代码理解能力，是智能体能够高效处理复杂编程任务的重要基础设施。
