# 控制栏阅读 - VS Code 插件

一个隐蔽的状态栏插件，可以在 VS Code 状态栏中显示文本文件内容。支持真实内容/迷惑内容切换、分页阅读、多文件切换等功能，适合在状态栏中隐蔽地阅读文本内容。

## ✨ 功能特性

### 核心功能

- ✅ **文件读取**：从指定的文本文件读取内容
- ✅ **状态栏显示**：在状态栏显示内容（默认显示迷惑性文案，按快捷键显示真实内容）
- ✅ **分页阅读**：支持长文本分页显示，可切换页码
- ✅ **多文件支持**：支持配置多个文件，可快速切换
- ✅ **阅读缓存**：记住每个文件的阅读位置
- ✅ **自动监听**：文件变化时自动更新显示

### 高级功能

- ✅ **显示模式切换**：真实内容 ↔ 迷惑内容（模拟 VS Code 状态栏信息）
- ✅ **Base64 加密**：支持读取 Base64 编码的文件内容
- ✅ **可视化设置**：提供图形化设置界面
- ✅ **快捷键支持**：支持自定义快捷键
- ✅ **页码显示**：可选显示页码信息（第几页/总页数）
- ✅ **配置文件**：支持 JSON 配置文件或 VS Code 设置

## 🚀 快速开始

### 安装方式

#### 方式一：从源码安装（开发模式）

1. **克隆或下载项目**
```bash
cd /path/to/ControlBarReading
```

2. **安装依赖**
```bash
npm install
```

3. **编译 TypeScript**
```bash
npm run compile
```

4. **运行调试**
   - 在 VS Code 中打开项目
   - 按 `F5` 启动调试
   - 在新打开的窗口中测试插件

#### 方式二：打包安装

1. **安装打包工具**
```bash
npm install -g @vscode/vsce
```

2. **打包插件**
```bash
npm run package
```

3. **安装 VSIX**
   - 在 VS Code 中按 `Ctrl+Shift+P`（Mac: `Cmd+Shift+P`）
   - 输入 `Extensions: Install from VSIX...`
   - 选择生成的 `.vsix` 文件

### 基本使用

1. **创建文本文件**
   在工作区根目录创建 `secret.txt` 文件，写入要显示的内容

2. **配置文件路径**
   - 使用命令：`控制栏阅读: 配置文件路径`
   - 或编辑 `.vscode/settings.json`：
   ```json
   {
     "secretStatusBar.filePath": "${workspaceFolder}/secret.txt"
   }
   ```

3. **查看内容**
   - 默认状态栏显示迷惑性文案（如 "Ln 1, Col 1"）
   - 按 `Ctrl+Shift+T`（Mac: `Cmd+Shift+T`）切换显示真实内容
   - 点击状态栏图标可在输出面板查看完整内容

## ⚙️ 配置说明

### 配置方式

插件支持两种配置方式（优先级：JSON 配置文件 > VS Code 设置）：

1. **JSON 配置文件**：在工作区根目录创建 `secret-status-bar.config.json`
2. **VS Code 设置**：在 `.vscode/settings.json` 或用户设置中配置

### 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `secretStatusBar.filePath` | string | `"${workspaceFolder}/secret.txt"` | 要读取的文件路径（支持 `${workspaceFolder}` 变量） |
| `secretStatusBar.files` | string[] | `[]` | 文件列表（支持多个文件切换，支持 `${workspaceFolder}` 变量） |
| `secretStatusBar.enableEncryption` | boolean | `false` | 是否启用 Base64 加密 |
| `secretStatusBar.enableClickDialog` | boolean | `true` | 点击状态栏图标时是否显示对话框 |
| `secretStatusBar.icon` | string | `"$(circle-outline)"` | 状态栏图标（VS Code 图标 ID） |
| `secretStatusBar.maxDisplayLength` | number | `50` | 状态栏最大显示字符数（超过会截断） |
| `secretStatusBar.pageSize` | number | `50` | 每页显示的字符数（用于分页功能） |
| `secretStatusBar.enableCache` | boolean | `true` | 是否启用阅读缓存（记住阅读位置） |
| `secretStatusBar.showPageInfo` | boolean | `false` | 是否在状态栏显示页码信息（第几页/总页数） |

### 配置文件示例

**JSON 配置文件** (`secret-status-bar.config.json`)：
```json
{
  "filePath": "${workspaceFolder}/secret.txt",
  "files": [
    "${workspaceFolder}/secret.txt",
    "${workspaceFolder}/another-secret.txt"
  ],
  "enableEncryption": false,
  "enableClickDialog": true,
  "icon": "$(circle-outline)",
  "maxDisplayLength": 50,
  "pageSize": 50,
  "enableCache": true,
  "showPageInfo": false
}
```

**VS Code 设置** (`.vscode/settings.json`)：
```json
{
  "secretStatusBar.filePath": "${workspaceFolder}/secret.txt",
  "secretStatusBar.files": [
    "${workspaceFolder}/secret.txt",
    "${workspaceFolder}/another-secret.txt"
  ],
  "secretStatusBar.enableEncryption": false,
  "secretStatusBar.enableClickDialog": true,
  "secretStatusBar.icon": "$(circle-outline)",
  "secretStatusBar.maxDisplayLength": 50,
  "secretStatusBar.pageSize": 50,
  "secretStatusBar.enableCache": true,
  "secretStatusBar.showPageInfo": false
}
```

### 常用图标

- `$(circle-outline)` - 圆圈轮廓（默认）
- `$(blank)` - 空白（最隐蔽）
- `$(eye)` - 眼睛
- `$(lock)` - 锁
- `$(key)` - 钥匙
- `$(shield)` - 盾牌

## ⌨️ 命令说明

在命令面板（`Ctrl+Shift+P` / `Cmd+Shift+P`）中输入 `控制栏阅读:` 可查看所有命令：

| 命令 | 说明 |
|------|------|
| `控制栏阅读: 显示隐藏内容` | 在输出面板显示完整内容 |
| `控制栏阅读: 重新加载文件` | 手动重新加载文件 |
| `控制栏阅读: 配置文件路径` | 交互式配置文件路径 |
| `控制栏阅读: 选择文件` | 通过文件选择器选择文件 |
| `控制栏阅读: 切换文件` | 切换到下一个文件（多文件模式） |
| `控制栏阅读: 上一页` | 切换到上一页 |
| `控制栏阅读: 下一页` | 切换到下一页 |
| `控制栏阅读: 切换显示模式（Ctrl+Shift+T）` | 切换真实内容/迷惑内容 |
| `控制栏阅读: 显示真实内容` | 显示真实内容 |
| `控制栏阅读: 显示迷惑内容` | 显示迷惑内容 |
| `控制栏阅读: 配置快捷键` | 快速配置快捷键 |
| `控制栏阅读: 打开设置界面` | 打开可视化设置界面 |

## ⌨️ 快捷键

### 默认快捷键

| 快捷键 | 说明 |
|--------|------|
| `Ctrl+Shift+T` (Mac: `Cmd+Shift+T`) | 切换显示模式（真实内容 ↔ 迷惑内容） |
| `Ctrl+Up` (Mac: `Cmd+Up`) | 上一页（仅在显示真实内容时有效） |
| `Ctrl+Down` (Mac: `Cmd+Down`) | 下一页（仅在显示真实内容时有效） |

### 自定义快捷键

使用命令 `控制栏阅读: 配置快捷键` 可以快速配置自定义快捷键，或在 VS Code 快捷键设置中手动配置。

## 📖 使用示例

### 示例 1：基本使用

1. 在工作区创建 `secret.txt` 文件
2. 写入内容：`这是我的秘密信息`
3. 插件会自动读取并在状态栏显示
4. 按 `Ctrl+Shift+T` 切换显示真实内容
5. 点击状态栏图标可在输出面板查看完整内容

### 示例 2：使用加密内容

1. 将内容进行 Base64 编码（例如：`这是秘密` → `6L+Z5piv5Yqg5LiL`）
2. 在设置中启用 `secretStatusBar.enableEncryption: true`
3. 将编码后的内容保存到 `secret.txt`
4. 插件会自动解码并显示

### 示例 3：多文件切换

1. 配置多个文件：
```json
{
  "secretStatusBar.files": [
    "${workspaceFolder}/file1.txt",
    "${workspaceFolder}/file2.txt",
    "${workspaceFolder}/file3.txt"
  ]
}
```
2. 使用命令 `控制栏阅读: 切换文件` 切换文件

### 示例 4：最隐蔽模式

1. 设置图标为空白：
```json
{
  "secretStatusBar.icon": "$(blank)"
}
```
2. 默认显示迷惑内容，只有按快捷键才显示真实内容

## 🐛 常见问题

### Q: 状态栏没有显示图标？

**A:** 检查以下几点：
1. 文件路径是否正确
2. 文件是否存在
3. 查看 VS Code 的输出面板（选择 "控制栏阅读"）查看错误信息
4. 使用命令 `控制栏阅读: 重新加载文件`

### Q: 文件更新后状态栏没有更新？

**A:** 
1. 确保文件已保存（`Ctrl+S`）
2. 手动触发：`控制栏阅读: 重新加载文件`
3. 检查文件监听器是否正常工作

### Q: 如何更改状态栏图标？

**A:** 在设置中修改 `secretStatusBar.icon` 配置项，使用 VS Code 内置的图标 ID。

### Q: 如何切换显示模式？

**A:** 
- 按 `Ctrl+Shift+T`（Mac: `Cmd+Shift+T`）切换显示模式
- 或使用命令 `控制栏阅读: 切换显示模式`

### Q: 如何切换页码？

**A:** 
1. 先按 `Ctrl+Shift+T` 显示真实内容
2. 然后按 `Ctrl+Up` / `Ctrl+Down` 切换页码

### Q: 支持哪些文件格式？

**A:** 目前支持纯文本文件（`.txt`），内容会自动清理空白和换行。

## 📁 项目结构

```
ControlBarReading/
├── src/
│   └── extension.ts          # 主扩展文件
├── out/                      # 编译输出目录（自动生成）
├── .vscode/
│   ├── launch.json          # 调试配置
│   └── tasks.json           # 构建任务配置
├── package.json              # 插件清单和依赖
├── tsconfig.json             # TypeScript 编译配置
├── .vscodeignore            # VSIX 打包忽略文件
├── .gitignore               # Git 忽略文件
├── README.md                # 本文档
├── QUICKSTART.md            # 快速开始指南
├── ARCHITECTURE.md          # 架构说明文档
└── 使用指南.md              # 详细使用指南
```

## 🔧 开发调试

### 调试配置

项目已包含 `.vscode/launch.json` 调试配置，直接按 `F5` 即可启动调试。

### 调试步骤

1. 在 `extension.ts` 中设置断点
2. 按 `F5` 启动调试
3. 在新打开的窗口中测试插件功能
4. 查看调试控制台的日志输出

### 编译命令

```bash
# 编译 TypeScript
npm run compile

# 监听模式编译（自动重新编译）
npm run watch

# 打包为 VSIX
npm run package
```

## 📝 技术实现

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
- **显示处理**：清理空白和换行，分页显示

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
