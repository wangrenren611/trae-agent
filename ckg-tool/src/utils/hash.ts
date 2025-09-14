/**
 * 哈希计算工具
 * 用于生成代码库快照哈希，判断代码是否发生变化
 */

import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * 检查目录是否为Git仓库
 * @param folderPath 目录路径
 * @returns 是否为Git仓库
 */
export function isGitRepository(folderPath: string): boolean {
  try {
    const result = execSync(
      'git rev-parse --is-inside-work-tree',
      { 
        cwd: folderPath, 
        encoding: 'utf8',
        timeout: 5000 
      }
    );
    return result.trim() === 'true';
  } catch (error) {
    return false;
  }
}

/**
 * 获取Git仓库的状态哈希
 * 包括当前commit hash和是否有未提交的更改
 * @param folderPath Git仓库路径
 * @returns Git状态哈希
 */
export function getGitStatusHash(folderPath: string): string {
  try {
    // 获取当前commit hash
    const commitHash = execSync(
      'git rev-parse HEAD',
      { cwd: folderPath, encoding: 'utf8' }
    ).trim();
    
    // 检查是否有未提交的更改
    const status = execSync(
      'git status --porcelain',
      { cwd: folderPath, encoding: 'utf8' }
    ).trim();
    
    // 组合commit hash和状态信息
    const combined = `${commitHash}-${status}`;
    return `git-${crypto.createHash('md5').update(combined).digest('hex')}`;
  } catch (error) {
    throw new Error(`获取Git状态哈希失败: ${error}`);
  }
}

/**
 * 获取文件元数据哈希
 * 基于文件的修改时间、大小等信息生成哈希
 * @param folderPath 目录路径
 * @returns 文件元数据哈希
 */
export function getFileMetadataHash(folderPath: string): string {
  const hash = crypto.createHash('md5');
  
  try {
    // 递归遍历目录，收集文件元数据
    const collectMetadata = (dirPath: string): void => {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);
        
        // 跳过隐藏文件和目录
        if (item.startsWith('.')) {
          continue;
        }
        
        if (stat.isDirectory()) {
          collectMetadata(itemPath);
        } else if (stat.isFile()) {
          // 收集文件元数据：路径、大小、修改时间
          const metadata = `${itemPath}-${stat.size}-${stat.mtime.getTime()}`;
          hash.update(metadata);
        }
      }
    };
    
    collectMetadata(folderPath);
    return `metadata-${hash.digest('hex')}`;
  } catch (error) {
    throw new Error(`获取文件元数据哈希失败: ${error}`);
  }
}

/**
 * 获取目录快照哈希
 * 优先使用Git状态，否则使用文件元数据
 * @param folderPath 目录路径
 * @returns 目录快照哈希
 */
export function getFolderSnapshotHash(folderPath: string): string {
  // 策略1：Git仓库
  if (isGitRepository(folderPath)) {
    return getGitStatusHash(folderPath);
  }
  
  // 策略2：非Git仓库 - 文件元数据
  return getFileMetadataHash(folderPath);
}

/**
 * 获取CKG数据库路径
 * @param codebaseSnapshotHash 代码库快照哈希
 * @returns 数据库文件路径
 */
export function getCkgDatabasePath(codebaseSnapshotHash: string): string {
  return path.join('./ckg-storage', `${codebaseSnapshotHash}.db`);
}
