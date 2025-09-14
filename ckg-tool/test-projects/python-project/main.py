"""
示例Python项目
用于测试CKG工具的功能
"""

import os
import sys
from typing import List, Dict, Optional


class UserManager:
    """用户管理类"""
    
    def __init__(self, db_connection):
        """初始化用户管理器"""
        self.db = db_connection
        self.users: Dict[str, str] = {}
    
    def create_user(self, username: str, email: str) -> bool:
        """创建新用户"""
        if username in self.users:
            return False
        
        self.users[username] = email
        return True
    
    def authenticate(self, username: str, password: str) -> bool:
        """验证用户身份"""
        if username not in self.users:
            return False
        
        # 简单的密码验证逻辑
        return len(password) >= 6
    
    def get_user_info(self, username: str) -> Optional[Dict[str, str]]:
        """获取用户信息"""
        if username not in self.users:
            return None
        
        return {
            'username': username,
            'email': self.users[username]
        }


class DatabaseManager:
    """数据库管理类"""
    
    def __init__(self, connection_string: str):
        """初始化数据库管理器"""
        self.connection_string = connection_string
        self.connected = False
    
    def connect(self) -> bool:
        """连接到数据库"""
        try:
            # 模拟数据库连接
            self.connected = True
            return True
        except Exception as e:
            print(f"数据库连接失败: {e}")
            return False
    
    def execute_query(self, query: str) -> List[Dict]:
        """执行数据库查询"""
        if not self.connected:
            raise Exception("数据库未连接")
        
        # 模拟查询结果
        return [{'id': 1, 'name': 'test'}]
    
    def close(self):
        """关闭数据库连接"""
        self.connected = False


def calculate_total(items: List[Dict[str, float]]) -> float:
    """计算商品总价"""
    total = 0.0
    for item in items:
        if 'price' in item and 'quantity' in item:
            total += item['price'] * item['quantity']
    return total


def validate_input(data: Dict) -> bool:
    """验证输入数据"""
    required_fields = ['name', 'email', 'age']
    
    for field in required_fields:
        if field not in data:
            return False
        
        if not data[field]:
            return False
    
    return True


def format_output(data: Dict) -> str:
    """格式化输出数据"""
    return f"Name: {data.get('name', 'N/A')}, Email: {data.get('email', 'N/A')}"


def process_user_data(user_data: Dict) -> Dict:
    """处理用户数据"""
    if not validate_input(user_data):
        return {'error': 'Invalid input data'}
    
    # 处理数据
    processed_data = {
        'name': user_data['name'].strip().title(),
        'email': user_data['email'].strip().lower(),
        'age': int(user_data['age'])
    }
    
    return processed_data


def main():
    """主函数"""
    print("Python项目示例")
    
    # 创建数据库管理器
    db_manager = DatabaseManager("sqlite:///test.db")
    
    if db_manager.connect():
        print("数据库连接成功")
        
        # 创建用户管理器
        user_manager = UserManager(db_manager)
        
        # 创建用户
        if user_manager.create_user("john_doe", "john@example.com"):
            print("用户创建成功")
        
        # 验证用户
        if user_manager.authenticate("john_doe", "password123"):
            print("用户验证成功")
        
        # 获取用户信息
        user_info = user_manager.get_user_info("john_doe")
        if user_info:
            print(f"用户信息: {user_info}")
        
        db_manager.close()
    else:
        print("数据库连接失败")


if __name__ == "__main__":
    main()
