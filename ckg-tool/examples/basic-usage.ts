/**
 * CKG工具基本使用示例
 * 演示如何使用CKG工具进行代码搜索和分析
 */

import { CKGTool, ToolArguments } from '../src/index';
import * as path from 'path';

async function basicUsageExample() {
  // 创建CKG工具实例
  const ckgTool = new CKGTool();
  
  // 示例代码库路径（请替换为实际的代码库路径）
  const codebasePath = path.join(__dirname, '../test-projects/python-project');
  
  console.log('=== CKG工具基本使用示例 ===\n');
  
  try {
    // 示例1：搜索函数
    console.log('1. 搜索函数示例:');
    const functionArgs: ToolArguments = {
      command: 'search_function',
      path: codebasePath,
      identifier: 'calculate_total',
      printBody: true
    };
    
    const functionResult = await ckgTool.execute(functionArgs);
    if (functionResult.success) {
      console.log('搜索结果:');
      console.log(functionResult.output);
    } else {
      console.log('搜索失败:', functionResult.error);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 示例2：搜索类
    console.log('2. 搜索类示例:');
    const classArgs: ToolArguments = {
      command: 'search_class',
      path: codebasePath,
      identifier: 'UserManager',
      printBody: true
    };
    
    const classResult = await ckgTool.execute(classArgs);
    if (classResult.success) {
      console.log('搜索结果:');
      console.log(classResult.output);
    } else {
      console.log('搜索失败:', classResult.error);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 示例3：搜索类方法
    console.log('3. 搜索类方法示例:');
    const methodArgs: ToolArguments = {
      command: 'search_class_method',
      path: codebasePath,
      identifier: 'authenticate',
      printBody: true
    };
    
    const methodResult = await ckgTool.execute(methodArgs);
    if (methodResult.success) {
      console.log('搜索结果:');
      console.log(methodResult.output);
    } else {
      console.log('搜索失败:', methodResult.error);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 示例4：获取代码库快照信息
    console.log('4. 获取代码库快照信息:');
    const snapshot = ckgTool.getCodebaseSnapshot(codebasePath);
    if (snapshot) {
      console.log('快照信息:');
      console.log(`- 哈希值: ${snapshot.hash}`);
      console.log(`- 路径: ${snapshot.path}`);
      console.log(`- 创建时间: ${snapshot.createdAt}`);
      console.log(`- 最后修改: ${snapshot.lastModified}`);
    } else {
      console.log('未找到代码库快照信息');
    }
    
  } catch (error) {
    console.error('示例执行失败:', error);
  } finally {
    // 清理资源
    ckgTool.closeAll();
    console.log('\n资源清理完成');
  }
}

// 运行示例
if (require.main === module) {
  basicUsageExample().catch(console.error);
}

export { basicUsageExample };
