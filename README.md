# 控制栏阅读 - VS Code 插件

一个隐蔽的状态栏插件，可以从指定的 txt 文件中读取内容并在状态栏显示，但只显示图标，真实内容隐藏在 tooltip 中。

## 功能特性

### 核心功能

- ✅ **文件读取**：从指定的 txt 文件读取内容
- ✅ **隐蔽显示**：状态栏只显示极简图标，内容在 tooltip 中
- ✅ **动态更新**：自动监听文件变化并更新显示
- ✅ **点击查看**：点击状态栏图标可查看完整内容

### 可选功能

- ✅ **加密支持**：支持 Base64 编码的内容
- ✅ **配置灵活**：支持通过设置配置文件路径
- ✅ **命令面板**：提供多个便捷命令

## 安装与使用

### 开发模式运行

1. **安装依赖**

```bash
cd vscode插件开发/控制栏阅读
npm install
```

2. **编译 TypeScript**

```bash
npm run compile
```

或者使用监听模式：

```bash
npm run watch
```

3. **调试运行**

- 按 `F5` 或点击 VS Code 的"运行和调试"
- 这会打开一个新的 VS Code 窗口（扩展开发宿主）
- 在新窗口中，插件会自动激活

4. **创建测试文件**

在工作区根目录创建 `secret.txt` 文件，例如：

```
这是一个隐藏的秘密内容
只有鼠标悬停在状态栏图标上才能看到
```

### 打包为 VSIX

1. **安装 vsce（VS Code Extension Manager）**

```bash
npm install -g @vscode/vsce
```

2. **打包插件**

```bash
npm run package
```

或者：

```bash
vsce package
```

3. **安装 VSIX**

- 在 VS Code 中按 `Ctrl+Shift+P`（Mac: `Cmd+Shift+P`）
- 输入 `Extensions: Install from VSIX...`
- 选择生成的 `.vsix` 文件

## 配置说明

### 配置文件路径

在 VS Code 设置中搜索 `控制栏阅读` 或 `secretStatusBar.filePath`，或直接编辑 `.vscode/settings.json`：

```json
{
  "secretStatusBar.filePath": "${workspaceFolder}/secret.txt"
}
```

**支持的变量：**
- `${workspaceFolder}` - 工作区根目录

### 其他配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `secretStatusBar.filePath` | string | `"${workspaceFolder}/secret.txt"` | 要读取的文件路径 |
| `secretStatusBar.enableEncryption` | boolean | `false` | 是否启用 Base64 加密 |
| `secretStatusBar.enableClickDialog` | boolean | `true` | 点击图标时是否显示对话框 |
| `secretStatusBar.icon` | string | `"$(circle-outline)"` | 状态栏图标（VS Code 图标 ID） |

### 常用图标

- `$(circle-outline)` - 圆圈轮廓（默认）
- `$(blank)` - 空白
- `$(eye)` - 眼睛
- `$(lock)` - 锁
- `$(key)` - 钥匙
- `$(shield)` - 盾牌

## 命令说明

### 1. 显示隐藏内容

- **命令 ID**: `secretStatusBar.showContent`
- **触发方式**: 
  - 点击状态栏图标
  - 命令面板输入 `控制栏阅读: 显示隐藏内容`

### 2. 重新加载文件

- **命令 ID**: `secretStatusBar.reload`
- **触发方式**: 命令面板输入 `控制栏阅读: 重新加载文件`

### 3. 配置文件路径

- **命令 ID**: `secretStatusBar.config`
- **触发方式**: 命令面板输入 `控制栏阅读: 配置文件路径`

## 使用示例

### 示例 1：基本使用

1. 在工作区创建 `secret.txt` 文件
2. 写入内容：`这是我的秘密信息`
3. 插件会自动读取并在状态栏显示图标
4. 鼠标悬停在图标上可看到 tooltip
5. 点击图标可在输出面板查看完整内容

### 示例 2：使用加密内容

1. 将内容进行 Base64 编码（例如：`这是秘密` → `6L+Z5piv5Yqg5LiL`）
2. 在设置中启用 `secretStatusBar.enableEncryption: true`
3. 将编码后的内容保存到 `secret.txt`
4. 插件会自动解码并显示

### 示例 3：自定义图标

在设置中配置：

```json
{
  "secretStatusBar.icon": "$(lock)"
}
```

## 项目结构

```
控制栏阅读/
├── src/
│   └── extension.ts          # 主扩展文件
├── out/                      # 编译输出目录（自动生成）
├── package.json              # 插件配置清单
├── tsconfig.json             # TypeScript 配置
├── .vscodeignore            # 打包忽略文件
├── .gitignore               # Git 忽略文件
└── README.md                # 本文档
```

## 技术实现

### 核心 API

- `vscode.workspace.fs.readFile` - 读取文件
- `vscode.window.createStatusBarItem` - 创建状态栏项
- `vscode.workspace.createFileSystemWatcher` - 监听文件变化
- `vscode.workspace.onDidChangeConfiguration` - 监听配置变化

### 文件监听

插件使用 `FileSystemWatcher` 监听目标文件的变化：
- `onDidChange` - 文件内容变化
- `onDidCreate` - 文件创建
- `onDidDelete` - 文件删除

### 内容处理

- **普通模式**：直接读取文件内容
- **加密模式**：读取 Base64 编码的内容并解码
- **显示处理**：tooltip 显示完整内容或摘要

## 开发调试

### 调试配置

创建 `.vscode/launch.json`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "运行扩展",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}/vscode插件开发/控制栏阅读"
      ],
      "outFiles": [
        "${workspaceFolder}/vscode插件开发/控制栏阅读/out/**/*.js"
      ],
      "preLaunchTask": "npm: compile"
    }
  ]
}
```

### 调试步骤

1. 在 `extension.ts` 中设置断点
2. 按 `F5` 启动调试
3. 在新打开的窗口中测试插件功能
4. 查看调试控制台的日志输出

## 常见问题

### Q: 状态栏没有显示图标？

A: 检查以下几点：
1. 文件路径是否正确
2. 文件是否存在
3. 查看 VS Code 的输出面板（选择 "控制栏阅读"）查看错误信息

### Q: 文件更新后状态栏没有更新？

A: 确保文件保存后，插件会自动检测变化。如果未更新，可以：
1. 使用命令 `控制栏阅读: 重新加载文件`
2. 检查文件监听器是否正常工作

### Q: 如何更改状态栏图标？

A: 在设置中修改 `secretStatusBar.icon` 配置项，使用 VS Code 内置的图标 ID。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

