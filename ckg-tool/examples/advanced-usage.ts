/**
 * CKG工具高级使用示例
 * 演示高级功能和最佳实践
 */

import { CKGTool, ToolArguments, ParserFactory } from '../src/index';
import * as path from 'path';
import * as fs from 'fs-extra';

async function advancedUsageExample() {
  const ckgTool = new CKGTool();
  
  console.log('=== CKG工具高级使用示例 ===\n');
  
  try {
    // 示例1：批量搜索多个代码库
    console.log('1. 批量搜索多个代码库:');
    const codebases = [
      path.join(__dirname, '../test-projects/python-project'),
      path.join(__dirname, '../test-projects/javascript-project'),
      path.join(__dirname, '../test-projects/typescript-project')
    ];
    
    for (const codebase of codebases) {
      if (fs.existsSync(codebase)) {
        console.log(`\n搜索代码库: ${codebase}`);
        
        const args: ToolArguments = {
          command: 'search_function',
          path: codebase,
          identifier: 'main',
          printBody: false
        };
        
        const result = await ckgTool.execute(args);
        if (result.success) {
          console.log('找到main函数:', result.output?.split('\n')[0]);
        }
      }
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 示例2：代码库结构分析
    console.log('2. 代码库结构分析:');
    const analysisCodebase = path.join(__dirname, '../test-projects/python-project');
    
    if (fs.existsSync(analysisCodebase)) {
      // 分析项目结构
      const structureAnalysis = await analyzeCodebaseStructure(ckgTool, analysisCodebase);
      console.log('项目结构分析结果:');
      console.log(structureAnalysis);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 示例3：代码依赖关系分析
    console.log('3. 代码依赖关系分析:');
    if (fs.existsSync(analysisCodebase)) {
      const dependencyAnalysis = await analyzeDependencies(ckgTool, analysisCodebase);
      console.log('依赖关系分析结果:');
      console.log(dependencyAnalysis);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 示例4：性能测试
    console.log('4. 性能测试:');
    await performanceTest(ckgTool, analysisCodebase);
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 示例5：错误处理演示
    console.log('5. 错误处理演示:');
    await errorHandlingDemo(ckgTool);
    
  } catch (error) {
    console.error('高级示例执行失败:', error);
  } finally {
    ckgTool.closeAll();
    console.log('\n资源清理完成');
  }
}

/**
 * 分析代码库结构
 */
async function analyzeCodebaseStructure(ckgTool: CKGTool, codebasePath: string): Promise<string> {
  const analysis: string[] = [];
  
  // 搜索所有类
  const classResult = await ckgTool.execute({
    command: 'search_class',
    path: codebasePath,
    identifier: '', // 空字符串会匹配所有类
    printBody: false
  });
  
  if (classResult.success) {
    const classCount = (classResult.output?.match(/找到 \d+ 个名为/g) || []).length;
    analysis.push(`- 类数量: ${classCount}`);
  }
  
  // 搜索所有函数
  const functionResult = await ckgTool.execute({
    command: 'search_function',
    path: codebasePath,
    identifier: '', // 空字符串会匹配所有函数
    printBody: false
  });
  
  if (functionResult.success) {
    const functionCount = (functionResult.output?.match(/找到 \d+ 个名为/g) || []).length;
    analysis.push(`- 函数数量: ${functionCount}`);
  }
  
  // 搜索所有方法
  const methodResult = await ckgTool.execute({
    command: 'search_class_method',
    path: codebasePath,
    identifier: '', // 空字符串会匹配所有方法
    printBody: false
  });
  
  if (methodResult.success) {
    const methodCount = (methodResult.output?.match(/找到 \d+ 个名为/g) || []).length;
    analysis.push(`- 方法数量: ${methodCount}`);
  }
  
  return analysis.join('\n');
}

/**
 * 分析代码依赖关系
 */
async function analyzeDependencies(ckgTool: CKGTool, codebasePath: string): Promise<string> {
  const dependencies: string[] = [];
  
  // 查找导入相关的函数
  const importFunctions = await ckgTool.execute({
    command: 'search_function',
    path: codebasePath,
    identifier: 'import',
    printBody: false
  });
  
  if (importFunctions.success && importFunctions.output?.includes('找到')) {
    dependencies.push('- 发现导入相关函数');
  }
  
  // 查找数据库相关类
  const dbClasses = await ckgTool.execute({
    command: 'search_class',
    path: codebasePath,
    identifier: 'Database',
    printBody: false
  });
  
  if (dbClasses.success && dbClasses.output?.includes('找到')) {
    dependencies.push('- 发现数据库相关类');
  }
  
  // 查找API相关类
  const apiClasses = await ckgTool.execute({
    command: 'search_class',
    path: codebasePath,
    identifier: 'API',
    printBody: false
  });
  
  if (apiClasses.success && apiClasses.output?.includes('找到')) {
    dependencies.push('- 发现API相关类');
  }
  
  return dependencies.length > 0 ? dependencies.join('\n') : '未发现明显的依赖关系';
}

/**
 * 性能测试
 */
async function performanceTest(ckgTool: CKGTool, codebasePath: string): Promise<void> {
  const testCases = [
    { command: 'search_function' as const, identifier: 'test' },
    { command: 'search_class' as const, identifier: 'Test' },
    { command: 'search_class_method' as const, identifier: 'run' }
  ];
  
  for (const testCase of testCases) {
    const startTime = Date.now();
    
    const result = await ckgTool.execute({
      command: testCase.command,
      path: codebasePath,
      identifier: testCase.identifier,
      printBody: false
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`${testCase.command}(${testCase.identifier}): ${duration}ms - ${result.success ? '成功' : '失败'}`);
  }
}

/**
 * 错误处理演示
 */
async function errorHandlingDemo(ckgTool: CKGTool): Promise<void> {
  const errorCases = [
    {
      name: '无效路径',
      args: {
        command: 'search_function' as const,
        path: '/invalid/path',
        identifier: 'test'
      }
    },
    {
      name: '无效命令',
      args: {
        command: 'invalid_command' as const,
        path: __dirname,
        identifier: 'test'
      }
    },
    {
      name: '缺少参数',
      args: {
        command: 'search_function' as const,
        path: __dirname,
        identifier: ''
      }
    }
  ];
  
  for (const errorCase of errorCases) {
    console.log(`\n测试错误情况: ${errorCase.name}`);
    const result = await ckgTool.execute(errorCase.args as ToolArguments);
    console.log(`结果: ${result.success ? '成功' : '失败'}`);
    if (!result.success) {
      console.log(`错误信息: ${result.error}`);
    }
  }
}

// 运行示例
if (require.main === module) {
  advancedUsageExample().catch(console.error);
}

export { advancedUsageExample };
