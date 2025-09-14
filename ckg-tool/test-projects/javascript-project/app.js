/**
 * 示例JavaScript项目
 * 用于测试CKG工具的功能
 */

const fs = require('fs');
const path = require('path');

/**
 * 用户管理类
 */
class UserManager {
    constructor(dbConnection) {
        this.db = dbConnection;
        this.users = new Map();
    }

    /**
     * 创建新用户
     * @param {string} username - 用户名
     * @param {string} email - 邮箱
     * @returns {boolean} 是否创建成功
     */
    createUser(username, email) {
        if (this.users.has(username)) {
            return false;
        }
        
        this.users.set(username, email);
        return true;
    }

    /**
     * 验证用户身份
     * @param {string} username - 用户名
     * @param {string} password - 密码
     * @returns {boolean} 是否验证成功
     */
    authenticate(username, password) {
        if (!this.users.has(username)) {
            return false;
        }
        
        // 简单的密码验证逻辑
        return password.length >= 6;
    }

    /**
     * 获取用户信息
     * @param {string} username - 用户名
     * @returns {Object|null} 用户信息
     */
    getUserInfo(username) {
        if (!this.users.has(username)) {
            return null;
        }
        
        return {
            username: username,
            email: this.users.get(username)
        };
    }
}

/**
 * 数据库管理类
 */
class DatabaseManager {
    constructor(connectionString) {
        this.connectionString = connectionString;
        this.connected = false;
    }

    /**
     * 连接到数据库
     * @returns {boolean} 是否连接成功
     */
    connect() {
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
     * @param {string} query - SQL查询语句
     * @returns {Array} 查询结果
     */
    executeQuery(query) {
        if (!this.connected) {
            throw new Error('数据库未连接');
        }
        
        // 模拟查询结果
        return [{ id: 1, name: 'test' }];
    }

    /**
     * 关闭数据库连接
     */
    close() {
        this.connected = false;
    }
}

/**
 * 计算商品总价
 * @param {Array} items - 商品列表
 * @returns {number} 总价
 */
function calculateTotal(items) {
    let total = 0;
    for (const item of items) {
        if (item.price && item.quantity) {
            total += item.price * item.quantity;
        }
    }
    return total;
}

/**
 * 验证输入数据
 * @param {Object} data - 输入数据
 * @returns {boolean} 是否有效
 */
function validateInput(data) {
    const requiredFields = ['name', 'email', 'age'];
    
    for (const field of requiredFields) {
        if (!(field in data) || !data[field]) {
            return false;
        }
    }
    
    return true;
}

/**
 * 格式化输出数据
 * @param {Object} data - 数据对象
 * @returns {string} 格式化后的字符串
 */
function formatOutput(data) {
    return `Name: ${data.name || 'N/A'}, Email: ${data.email || 'N/A'}`;
}

/**
 * 处理用户数据
 * @param {Object} userData - 用户数据
 * @returns {Object} 处理后的数据
 */
function processUserData(userData) {
    if (!validateInput(userData)) {
        return { error: 'Invalid input data' };
    }
    
    // 处理数据
    const processedData = {
        name: userData.name.trim(),
        email: userData.email.trim().toLowerCase(),
        age: parseInt(userData.age)
    };
    
    return processedData;
}

/**
 * 异步文件读取函数
 * @param {string} filePath - 文件路径
 * @returns {Promise<string>} 文件内容
 */
async function readFileAsync(filePath) {
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
 * 箭头函数示例
 */
const arrowFunction = (x, y) => {
    return x + y;
};

/**
 * 匿名函数示例
 */
const anonymousFunction = function(x) {
    return x * 2;
};

/**
 * 主函数
 */
function main() {
    console.log('JavaScript项目示例');
    
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
        
        dbManager.close();
    } else {
        console.log('数据库连接失败');
    }
}

// 导出模块
module.exports = {
    UserManager,
    DatabaseManager,
    calculateTotal,
    validateInput,
    formatOutput,
    processUserData,
    readFileAsync,
    arrowFunction,
    anonymousFunction,
    main
};

// 如果直接运行此文件，执行主函数
if (require.main === module) {
    main();
}
