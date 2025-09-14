/**
 * 示例TypeScript项目
 * 用于测试CKG工具的功能
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * 用户接口定义
 */
interface User {
    username: string;
    email: string;
    age: number;
}

/**
 * 用户数据接口
 */
interface UserData {
    name: string;
    email: string;
    age: string;
}

/**
 * 商品接口
 */
interface Item {
    price: number;
    quantity: number;
    name: string;
}

/**
 * 用户管理类
 */
class UserManager {
    private db: any;
    private users: Map<string, User>;

    constructor(dbConnection: any) {
        this.db = dbConnection;
        this.users = new Map<string, User>();
    }

    /**
     * 创建新用户
     * @param username - 用户名
     * @param email - 邮箱
     * @returns 是否创建成功
     */
    public createUser(username: string, email: string): boolean {
        if (this.users.has(username)) {
            return false;
        }
        
        this.users.set(username, {
            username,
            email,
            age: 0
        });
        return true;
    }

    /**
     * 验证用户身份
     * @param username - 用户名
     * @param password - 密码
     * @returns 是否验证成功
     */
    public authenticate(username: string, password: string): boolean {
        if (!this.users.has(username)) {
            return false;
        }
        
        // 简单的密码验证逻辑
        return password.length >= 6;
    }

    /**
     * 获取用户信息
     * @param username - 用户名
     * @returns 用户信息或null
     */
    public getUserInfo(username: string): User | null {
        if (!this.users.has(username)) {
            return null;
        }
        
        return this.users.get(username) || null;
    }

    /**
     * 更新用户信息
     * @param username - 用户名
     * @param userData - 用户数据
     * @returns 是否更新成功
     */
    public updateUser(username: string, userData: Partial<User>): boolean {
        if (!this.users.has(username)) {
            return false;
        }
        
        const user = this.users.get(username);
        if (user) {
            Object.assign(user, userData);
            return true;
        }
        
        return false;
    }
}

/**
 * 数据库管理类
 */
class DatabaseManager {
    private connectionString: string;
    private connected: boolean;

    constructor(connectionString: string) {
        this.connectionString = connectionString;
        this.connected = false;
    }

    /**
     * 连接到数据库
     * @returns 是否连接成功
     */
    public connect(): boolean {
        try {
            // 模拟数据库连接
            this.connected = true;
            return true;
        } catch (error) {
            console.error('数据库连接失败:', error);
            return false;
        }
    }

    /**
     * 执行数据库查询
     * @param query - SQL查询语句
     * @returns 查询结果
     */
    public executeQuery(query: string): any[] {
        if (!this.connected) {
            throw new Error('数据库未连接');
        }
        
        // 模拟查询结果
        return [{ id: 1, name: 'test' }];
    }

    /**
     * 关闭数据库连接
     */
    public close(): void {
        this.connected = false;
    }

    /**
     * 获取连接状态
     * @returns 是否已连接
     */
    public isConnected(): boolean {
        return this.connected;
    }
}

/**
 * 计算商品总价
 * @param items - 商品列表
 * @returns 总价
 */
function calculateTotal(items: Item[]): number {
    let total = 0;
    for (const item of items) {
        total += item.price * item.quantity;
    }
    return total;
}

/**
 * 验证输入数据
 * @param data - 输入数据
 * @returns 是否有效
 */
function validateInput(data: UserData): boolean {
    const requiredFields: (keyof UserData)[] = ['name', 'email', 'age'];
    
    for (const field of requiredFields) {
        if (!(field in data) || !data[field]) {
            return false;
        }
    }
    
    return true;
}

/**
 * 格式化输出数据
 * @param data - 数据对象
 * @returns 格式化后的字符串
 */
function formatOutput(data: Partial<User>): string {
    return `Name: ${data.username || 'N/A'}, Email: ${data.email || 'N/A'}`;
}

/**
 * 处理用户数据
 * @param userData - 用户数据
 * @returns 处理后的数据
 */
function processUserData(userData: UserData): User | { error: string } {
    if (!validateInput(userData)) {
        return { error: 'Invalid input data' };
    }
    
    // 处理数据
    const processedData: User = {
        username: userData.name.trim(),
        email: userData.email.trim().toLowerCase(),
        age: parseInt(userData.age)
    };
    
    return processedData;
}

/**
 * 异步文件读取函数
 * @param filePath - 文件路径
 * @returns Promise<string> 文件内容
 */
async function readFileAsync(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

/**
 * 泛型函数示例
 * @param items - 项目列表
 * @returns 处理后的项目列表
 */
function processItems<T extends Item>(items: T[]): T[] {
    return items.map(item => ({
        ...item,
        price: Math.round(item.price * 100) / 100 // 保留两位小数
    }));
}

/**
 * 箭头函数示例
 */
const arrowFunction = (x: number, y: number): number => {
    return x + y;
};

/**
 * 匿名函数示例
 */
const anonymousFunction = function(x: number): number {
    return x * 2;
};

/**
 * 枚举定义
 */
enum UserRole {
    ADMIN = 'admin',
    USER = 'user',
    GUEST = 'guest'
}

/**
 * 类型别名
 */
type UserStatus = 'active' | 'inactive' | 'pending';

/**
 * 主函数
 */
function main(): void {
    console.log('TypeScript项目示例');
    
    // 创建数据库管理器
    const dbManager = new DatabaseManager('sqlite:///test.db');
    
    if (dbManager.connect()) {
        console.log('数据库连接成功');
        
        // 创建用户管理器
        const userManager = new UserManager(dbManager);
        
        // 创建用户
        if (userManager.createUser('john_doe', 'john@example.com')) {
            console.log('用户创建成功');
        }
        
        // 验证用户
        if (userManager.authenticate('john_doe', 'password123')) {
            console.log('用户验证成功');
        }
        
        // 获取用户信息
        const userInfo = userManager.getUserInfo('john_doe');
        if (userInfo) {
            console.log('用户信息:', userInfo);
        }
        
        // 更新用户信息
        userManager.updateUser('john_doe', { age: 25 });
        
        dbManager.close();
    } else {
        console.log('数据库连接失败');
    }
}

// 导出模块
export {
    UserManager,
    DatabaseManager,
    calculateTotal,
    validateInput,
    formatOutput,
    processUserData,
    readFileAsync,
    processItems,
    arrowFunction,
    anonymousFunction,
    UserRole,
    UserStatus,
    main
};

// 如果直接运行此文件，执行主函数
if (require.main === module) {
    main();
}
