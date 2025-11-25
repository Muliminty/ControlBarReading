# 架构说明

## 项目结构

```
控制栏阅读/
├── src/
│   └── extension.ts          # 主扩展入口文件
├── out/                      # TypeScript 编译输出（自动生成）
├── .vscode/
│   ├── launch.json          # 调试配置
│   └── tasks.json           # 构建任务配置
├── package.json              # 插件清单和依赖
├── tsconfig.json             # TypeScript 编译配置
├── .vscodeignore            # VSIX 打包忽略文件
├── .gitignore               # Git 忽略文件
├── README.md                # 完整文档
├── QUICKSTART.md            # 快速开始指南
├── ARCHITECTURE.md          # 本文档
└── secret.txt.example       # 示例文件
```

## 核心实现

### 1. 文件读取 (`readFileContent`)

```typescript
async function readFileContent(filePath: string): Promise<string>
```

- 使用 `vscode.workspace.fs.readFile` 读取文件
- 支持 Base64 解码（如果启用加密）
- 返回 UTF-8 编码的文本内容

### 2. 状态栏管理 (`updateStatusBar`)

```typescript
function updateStatusBar(statusBarItem: vscode.StatusBarItem, content: string, filePath: string)
```

- 创建状态栏项，只显示图标
- 在 tooltip 中显示内容摘要
- 绑定点击命令

### 3. 文件监听 (`watchFile`)

```typescript
function watchFile(filePath: string, callback: () => void): vscode.FileSystemWatcher | null
```

- 使用 `vscode.workspace.createFileSystemWatcher` 创建监听器
- 监听文件创建、修改、删除事件
- 自动触发内容更新

### 4. 内容显示 (`showContentDialog`)

```typescript
async function showContentDialog(content: string)
```

- 在输出面板显示完整内容
- 同时显示信息提示

## 数据流

```
文件变化 → FileSystemWatcher → loadAndUpdate() → readFileContent() 
    → updateStatusBar() → 状态栏更新
```

```
用户点击状态栏 → showContentCommand → showContentDialog() 
    → 输出面板显示
```

## 配置系统

### 配置项

| 配置键 | 类型 | 说明 |
|--------|------|------|
| `secretStatusBar.filePath` | string | 文件路径（支持变量） |
| `secretStatusBar.enableEncryption` | boolean | 是否启用加密 |
| `secretStatusBar.enableClickDialog` | boolean | 是否启用点击对话框 |
| `secretStatusBar.icon` | string | 状态栏图标 |

### 配置监听

```typescript
vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('secretStatusBar')) {
        loadAndUpdate();
    }
});
```

## 命令系统

### 注册的命令

1. **secretStatusBar.showContent**
   - 显示完整内容对话框
   - 可通过状态栏点击触发

2. **secretStatusBar.reload**
   - 手动重新加载文件
   - 用于故障排除

3. **secretStatusBar.config**
   - 交互式配置文件路径
   - 使用 `showInputBox` 获取用户输入

## 生命周期

### 激活 (`activate`)

1. 创建状态栏项
2. 注册所有命令
3. 加载初始内容
4. 设置文件监听器
5. 设置配置监听器

### 停用 (`deactivate`)

1. 清理文件监听器
2. 释放资源

## 错误处理

### 文件读取错误

- 捕获异常并显示错误图标
- 在 tooltip 中显示错误信息
- 在控制台输出详细错误

### 文件监听错误

- 静默处理监听器创建失败
- 在控制台记录错误

## 扩展点

### 可扩展功能

1. **加密算法**
   - 当前使用 Base64
   - 可扩展为 AES 等加密算法

2. **内容格式**
   - 当前支持纯文本
   - 可扩展支持 JSON、YAML 等

3. **显示方式**
   - 当前使用输出面板
   - 可扩展为 WebView、通知等

4. **多文件支持**
   - 当前支持单个文件
   - 可扩展为多文件切换

## 性能考虑

### 文件监听

- 使用 VS Code 内置的 `FileSystemWatcher`
- 自动处理文件系统事件
- 避免轮询检查

### 内存管理

- 及时释放监听器资源
- 使用 `context.subscriptions` 管理生命周期

### 更新频率

- 文件变化时立即更新
- 避免频繁的状态栏刷新

## 安全考虑

### 内容保护

- 状态栏不显示明文
- 内容仅在 tooltip 和对话框中显示
- 支持加密存储

### 文件访问

- 使用 VS Code 的文件系统 API
- 遵循工作区权限限制

## 测试建议

### 单元测试

- 文件读取函数
- 内容处理函数
- 配置解析函数

### 集成测试

- 文件监听功能
- 状态栏更新
- 命令执行

### 手动测试场景

1. 文件创建、修改、删除
2. 配置变更
3. 命令执行
4. 错误处理

