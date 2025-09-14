/**
 * Docker工具执行器 - 负责在Docker容器中执行工具调用
 */

import { spawn, ChildProcess } from '@types/node/child_process';
import * as path from '@types/node/path';
import * as fs from '@types/node/fs';

/**
 * Docker容器配置接口
 */
interface DockerConfig {
  image: string;          // Docker镜像名称
  container?: string;     // 容器ID/名称(可选)
  workdir: string;        // 容器内工作目录
  hostDir: string;        // 主机挂载目录
  shell: string;          // 使用的shell类型
  env?: Record<string, string>; // 环境变量(可选)
}

/**
 * 工具调用结果接口
 */
interface ToolCallResult {
  success: boolean;      // 执行是否成功
  output: string;        // 输出内容
  error?: string;        // 错误信息(如果有)
}

/**
 * Docker管理器类 - 管理Docker容器的生命周期
 */
class DockerManager {
  private config: DockerConfig;
  private container: string | null = null;
  private shell: ChildProcess | null = null;

  constructor(config: DockerConfig) {
    this.config = config;
  }

  /**
   * 启动Docker容器
   */
  async start(): Promise<void> {
    try {
      if (this.config.container) {
        // 使用现有容器
        await this.attachContainer();
      } else {
        // 创建新容器
        await this.createContainer();
      }
      // 启动交互式shell
      await this.startShell();
    } catch (error) {
      throw new Error(`启动Docker容器失败: ${error.message}`);
    }
  }

  /**
   * 连接到现有容器
   */
  private async attachContainer(): Promise<void> {
    const { stdout } = await this.execCommand(
      `docker container inspect ${this.config.container}`
    );
    if (!stdout) {
      throw new Error(`容器 ${this.config.container} 不存在`);
    }
    this.container = this.config.container || null;
  }

  /**
   * 创建新容器
   */
  private async createContainer(): Promise<void> {
    const envArgs = this.config.env 
      ? Object.entries(this.config.env).map(([k, v]) => `-e ${k}=${v}`).join(' ')
      : '';

    const { stdout } = await this.execCommand(
      `docker run -d \
        -v ${this.config.hostDir}:${this.config.workdir} \
        -w ${this.config.workdir} \
        ${envArgs} \
        ${this.config.image} \
        tail -f /dev/null`
    );

    this.container = stdout.trim();
  }

  /**
   * 启动交互式shell
   */
  private async startShell(): Promise<void> {
    if (!this.container) {
      throw new Error('容器未启动');
    }

    this.shell = spawn('docker', [
      'exec',
      '-i',
      this.container,
      this.config.shell
    ]);

    // 处理shell错误
    this.shell.on('error', (error) => {
      console.error('Shell错误:', error);
    });
  }

  /**
   * 在容器中执行命令
   */
  async executeCommand(command: string): Promise<ToolCallResult> {
    if (!this.shell) {
      throw new Error('Shell未启动');
    }

    return new Promise((resolve) => {
      let output = '';
      let error = '';

      // 写入命令
      this.shell!.stdin!.write(`${command}\n`);

      // 收集输出
      const outputHandler = (data: Buffer) => {
        output += data.toString();
      };

      const errorHandler = (data: Buffer) => {
        error += data.toString();
      };

      this.shell!.stdout!.on('data', outputHandler);
      this.shell!.stderr!.on('data', errorHandler);

      // 设置超时
      setTimeout(() => {
        this.shell!.stdout!.removeListener('data', outputHandler);
        this.shell!.stderr!.removeListener('data', errorHandler);

        resolve({
          success: !error,
          output: output,
          error: error || undefined
        });
      }, 5000); // 5秒超时
    });
  }

  /**
   * 停止容器
   */
  async stop(): Promise<void> {
    if (this.shell) {
      this.shell.kill();
      this.shell = null;
    }

    if (this.container && !this.config.container) {
      await this.execCommand(`docker rm -f ${this.container}`);
      this.container = null;
    }
  }

  /**
   * 执行系统命令
   */
  private execCommand(command: string): Promise<{stdout: string; stderr: string}> {
    return new Promise((resolve, reject) => {
      const child = spawn('sh', ['-c', command]);
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`命令执行失败: ${stderr}`));
        }
      });
    });
  }
}

/**
 * Docker工具执行器类 - 处理工具调用的执行
 */
export class DockerToolExecutor {
  private manager: DockerManager;
  private hostToContainerPath: (path: string) => string;
  private containerToHostPath: (path: string) => string;

  constructor(config: DockerConfig) {
    this.manager = new DockerManager(config);

    // 路径转换函数
    this.hostToContainerPath = (hostPath: string) => {
      const relativePath = path.relative(config.hostDir, hostPath);
      return path.join(config.workdir, relativePath);
    };

    this.containerToHostPath = (containerPath: string) => {
      const relativePath = path.relative(config.workdir, containerPath);
      return path.join(config.hostDir, relativePath);
    };
  }

  /**
   * 初始化Docker环境
   */
  async initialize(): Promise<void> {
    await this.manager.start();
  }

  /**
   * 执行工具调用
   */
  async executeToolCall(toolCall: any): Promise<ToolCallResult> {
    try {
      // 转换路径
      const convertedToolCall = this.convertPaths(toolCall);

      // 执行工具调用
      const result = await this.manager.executeCommand(
        JSON.stringify(convertedToolCall)
      );

      // 转换结果中的路径
      return this.convertResultPaths(result);
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error.message
      };
    }
  }

  /**
   * 转换工具调用中的路径
   */
  private convertPaths(toolCall: any): any {
    const converted = { ...toolCall };

    // 递归转换对象中的路径
    const convert = (obj: any) => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && this.isPath(value)) {
          obj[key] = this.hostToContainerPath(value);
        } else if (typeof value === 'object' && value !== null) {
          convert(value);
        }
      }
    };

    convert(converted);
    return converted;
  }

  /**
   * 转换结果中的路径
   */
  private convertResultPaths(result: ToolCallResult): ToolCallResult {
    const converted = { ...result };

    if (typeof converted.output === 'string') {
      converted.output = this.convertPathsInString(converted.output);
    }

    if (converted.error) {
      converted.error = this.convertPathsInString(converted.error);
    }

    return converted;
  }

  /**
   * 转换字符串中的路径
   */
  private convertPathsInString(str: string): string {
    return str.replace(/(['"])([\w/.-]+)(['"]/g, (match, quote, path) => {
      if (this.isPath(path)) {
        return `${quote}${this.containerToHostPath(path)}${quote}`;
      }
      return match;
    });
  }

  /**
   * 判断字符串是否为路径
   */
  private isPath(str: string): boolean {
    return (
      str.startsWith('/') ||
      str.startsWith('./') ||
      str.startsWith('../') ||
      /^[a-zA-Z]:\//.test(str)
    );
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    await this.manager.stop();
  }
}