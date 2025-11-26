# 架构说明

## 项目结构

```
ControlBarReading/
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
├── README.md                # 项目主文档
├── QUICKSTART.md            # 快速开始指南
├── ARCHITECTURE.md          # 本文档
└── 使用指南.md              # 详细使用指南
```

## 核心实现

### 1. 配置系统

#### 配置接口 (`PluginConfig`)

```typescript
interface PluginConfig {
    filePath?: string;
    enableEncryption?: boolean;
    enableClickDialog?: boolean;
    icon?: string;
    maxDisplayLength?: number;
    pageSize?: number;
    enableCache?: boolean;
    files?: string[];
    showRealContentKey?: string;
    showDecoyContentKey?: string;
    previousPageKey?: string;
    nextPageKey?: string;
    showPageInfo?: boolean;
}
```

#### 配置加载优先级

1. **JSON 配置文件** (`secret-status-bar.config.json`)
   - 位置：工作区根目录
   - 优先级：最高

2. **VS Code 设置** (`.vscode/settings.json` 或用户设置)
   - 优先级：次之

#### 配置加载函数

- `loadConfigFromFile()` - 从 JSON 配置文件加载配置
- `getFilePath()` - 获取文件路径（优先从 JSON 文件）
- `getConfigValue<T>()` - 获取配置值（优先从 JSON 文件）

### 2. 文件读取 (`readFileContent`)

```typescript
async function readFileContent(filePath: string, context?: vscode.ExtensionContext): Promise<string>
```

**功能：**
- 使用 `vscode.workspace.fs.readFile` 读取文件
- 支持 Base64 解码（如果启用加密）
- 自动清理内容（去除首尾空白，清理多余空行）
- 返回 UTF-8 编码的文本内容

**处理流程：**
1. 读取文件内容
2. 检查是否启用加密
3. 如果启用，进行 Base64 解码
4. 清理内容（去除空白、清理空行）
5. 返回处理后的内容

### 3. 内容处理

#### 文本清理 (`cleanTextContent`)

```typescript
function cleanTextContent(content: string): string
```

- 移除所有空白字符（空格、制表符、换行符等）
- 只保留单个空格分隔
- 用于状态栏显示

#### 内容分页 (`paginateContent`)

```typescript
function paginateContent(content: string, pageSize: number): string[]
```

**功能：**
- 将内容按字符数分页
- 尽量在单词边界处断开（避免截断单词）
- 返回页面数组

**分页逻辑：**
1. 清理内容（移除所有空白）
2. 按 `pageSize` 字符数分页
3. 如果不是最后一页，尝试在空格处断开（如果空格位置在 70% 之后）
4. 返回页面数组

### 4. 状态栏管理 (`updateStatusBar`)

```typescript
async function updateStatusBar(
    statusBarItem: vscode.StatusBarItem,
    content: string,
    filePath: string,
    currentPage: number,
    totalPages: number,
    showRealContent: boolean,
    context?: vscode.ExtensionContext
)
```

**功能：**
- 创建或更新状态栏项
- 支持真实内容/迷惑内容切换
- 支持页码显示
- 智能截断（在单词边界处）

**显示模式：**

1. **真实内容模式** (`showRealContent = true`)
   - 显示文件内容
   - 清理空白和换行
   - 超过最大长度时智能截断

2. **迷惑内容模式** (`showRealContent = false`)
   - 显示迷惑性文案（模拟 VS Code 状态栏信息）
   - 如："Ln 1, Col 1"、"UTF-8"、"Plain Text" 等

**页码显示：**
- 如果启用 `showPageInfo` 且总页数 > 1
- 在状态栏显示页码信息：`内容... [1/5]`

### 5. 迷惑内容生成 (`generateDecoyText`)

```typescript
function generateDecoyText(): string
```

**功能：**
- 生成模拟 VS Code 状态栏信息的迷惑性文案
- 随机选择，增加隐蔽性

**迷惑文案类型：**
- 光标位置信息：`Ln 1, Col 1`
- 文件编码信息：`UTF-8`、`GBK`
- 语言模式：`Plain Text`、`Markdown`
- 缩进信息：`Spaces: 4`、`Tab Size: 2`
- 行尾符信息：`LF`、`CRLF`
- 文件统计：`100 lines`
- 时间信息：`14:30`
- 组合信息：`UTF-8 • LF • Spaces: 4`
- 简单状态：`●`、`○`、`◉`

### 6. 文件监听 (`watchFile`)

```typescript
function watchFile(filePath: string, callback: () => void): vscode.FileSystemWatcher | null
```

**功能：**
- 使用 `vscode.workspace.createFileSystemWatcher` 创建监听器
- 监听文件创建、修改、删除事件
- 自动触发内容更新

**监听事件：**
- `onDidChange` - 文件内容变化
- `onDidCreate` - 文件创建
- `onDidDelete` - 文件删除（显示警告）

### 7. 阅读状态管理

#### 阅读状态接口 (`ReadingState`)

```typescript
interface ReadingState {
    currentPage: number;
    currentFile: string;
    lastUpdateTime: number;
}
```

#### 状态管理函数

- `getReadingState()` - 从缓存获取阅读状态
- `saveReadingState()` - 保存阅读状态到缓存

**缓存机制：**
- 使用 `context.globalState` 存储
- 每个文件独立保存阅读位置
- 键名格式：`readingState_${filePath}`

### 8. 内容显示 (`showContentDialog`)

```typescript
async function showContentDialog(
    content: string,
    currentPage: number,
    totalPages: number,
    context?: vscode.ExtensionContext
)
```

**功能：**
- 在输出面板显示完整内容
- 显示页码信息（如果有多页）
- 同时显示信息提示

## 数据流

### 文件变化流程

```
文件变化 
  → FileSystemWatcher.onDidChange 
    → loadAndUpdate() 
      → readFileContent() 
        → paginateContent() 
          → updateStatusBar() 
            → 状态栏更新
```

### 用户交互流程

#### 点击状态栏图标

```
用户点击状态栏 
  → secretStatusBar.showContent 
    → showContentDialog() 
      → 输出面板显示
```

#### 切换显示模式

```
用户按 Ctrl+Shift+T 
  → secretStatusBar.toggleDisplay 
    → toggleDisplayMode() 
      → refreshStatusBar() 
        → updateStatusBar() 
          → 状态栏更新（真实内容 ↔ 迷惑内容）
```

#### 切换页码

```
用户按 Ctrl+Up/Down 
  → secretStatusBar.previousPage/nextPage 
    → goToPreviousPage()/goToNextPage() 
      → updateStatusBar() 
        → saveReadingState() 
          → 状态栏更新 + 保存位置
```

### 配置变化流程

```
配置变化（JSON 文件或 VS Code 设置）
  → onDidChangeConfiguration 
    → loadAndUpdate() 
      → 重新加载文件并更新状态栏
```

## 命令系统

### 注册的命令

| 命令 ID | 功能 | 说明 |
|---------|------|------|
| `secretStatusBar.showContent` | 显示完整内容 | 在输出面板显示 |
| `secretStatusBar.reload` | 重新加载文件 | 手动触发重新加载 |
| `secretStatusBar.config` | 配置文件路径 | 交互式配置 |
| `secretStatusBar.selectFile` | 选择文件 | 文件选择器 |
| `secretStatusBar.switchFile` | 切换文件 | 多文件模式切换 |
| `secretStatusBar.previousPage` | 上一页 | 切换页码 |
| `secretStatusBar.nextPage` | 下一页 | 切换页码 |
| `secretStatusBar.toggleDisplay` | 切换显示模式 | 真实内容 ↔ 迷惑内容 |
| `secretStatusBar.showRealContent` | 显示真实内容 | 强制显示真实内容 |
| `secretStatusBar.showDecoyContent` | 显示迷惑内容 | 强制显示迷惑内容 |
| `secretStatusBar.toggleDisplayMode` | 切换显示模式（备用） | 备用命令 |
| `secretStatusBar.configureKeybindings` | 配置快捷键 | 快速配置快捷键 |
| `secretStatusBar.openSettings` | 打开设置界面 | 可视化设置界面 |

### 快捷键绑定

在 `package.json` 中定义的默认快捷键：

```json
{
  "command": "secretStatusBar.toggleDisplay",
  "key": "ctrl+shift+t",
  "mac": "cmd+shift+t"
},
{
  "command": "secretStatusBar.previousPage",
  "key": "ctrl+up",
  "mac": "cmd+up"
},
{
  "command": "secretStatusBar.nextPage",
  "key": "ctrl+down",
  "mac": "cmd+down"
}
```

## 生命周期

### 激活 (`activate`)

1. **初始化默认配置**
   - 检查是否已配置
   - 如果未配置，创建默认配置和示例文件

2. **创建状态栏项**
   - 使用 `vscode.window.createStatusBarItem` 创建
   - 位置：右侧，优先级 1000

3. **注册所有命令**
   - 注册 13 个命令
   - 绑定到对应的处理函数

4. **设置监听器**
   - 文件监听器（`FileSystemWatcher`）
   - 配置监听器（`onDidChangeConfiguration`）
   - 配置文件监听器（`FileSystemWatcher`）

5. **初始加载**
   - 调用 `loadAndUpdate()` 加载文件内容
   - 更新状态栏显示

6. **注册订阅**
   - 将所有订阅添加到 `context.subscriptions`
   - 确保插件停用时正确清理

### 停用 (`deactivate`)

1. **清理监听器**
   - 文件监听器
   - 配置监听器
   - 配置文件监听器

2. **释放资源**
   - 状态栏项
   - WebView 面板
   - 其他订阅

## 核心函数说明

### 文件操作

#### `loadAndUpdate(fileIndex?: number)`

**功能：** 加载文件内容并更新状态栏

**流程：**
1. 获取文件列表
2. 确定要加载的文件索引
3. 读取文件内容
4. 分页处理
5. 获取阅读状态（缓存）
6. 更新状态栏
7. 保存阅读状态
8. 设置文件监听器

#### `getFileList(): Promise<string[]>`

**功能：** 获取文件列表

**逻辑：**
1. 从配置获取 `files` 数组
2. 从配置获取 `filePath`
3. 合并文件列表（去重）
4. 处理 `${workspaceFolder}` 变量
5. 返回文件列表

### 分页操作

#### `goToPreviousPage()`

**功能：** 切换到上一页

**限制：** 只有在显示真实内容时才能切换

**流程：**
1. 检查是否显示真实内容
2. 获取当前页码
3. 计算上一页页码
4. 更新状态栏
5. 保存阅读状态

#### `goToNextPage()`

**功能：** 切换到下一页

**限制：** 只有在显示真实内容时才能切换

**流程：** 同 `goToPreviousPage()`，但计算下一页

#### `switchToNextFile()`

**功能：** 切换到下一个文件

**流程：**
1. 检查文件列表长度
2. 计算下一个文件索引（循环）
3. 调用 `loadAndUpdate()` 加载新文件
4. 显示提示信息

### 显示模式

#### `toggleDisplayMode()`

**功能：** 切换显示模式

**流程：**
1. 切换 `showRealContent` 标志
2. 调用 `refreshStatusBar()` 刷新状态栏

#### `refreshStatusBar()`

**功能：** 刷新状态栏显示

**流程：**
1. 检查是否有内容
2. 获取当前页码
3. 调用 `updateStatusBar()` 更新状态栏

## 错误处理

### 文件读取错误

- 捕获异常并显示错误图标
- 在状态栏 tooltip 中显示错误信息
- 在控制台输出详细错误

### 文件监听错误

- 静默处理监听器创建失败
- 在控制台记录错误
- 返回 `null`，不影响其他功能

### 配置错误

- 路径变量未替换时显示错误提示
- 文件不存在时显示错误提示
- 配置文件格式错误时回退到 VS Code 设置

## 性能考虑

### 文件监听

- 使用 VS Code 内置的 `FileSystemWatcher`
- 自动处理文件系统事件
- 避免轮询检查

### 内存管理

- 及时释放监听器资源
- 使用 `context.subscriptions` 管理生命周期
- 阅读状态使用全局状态存储（持久化）

### 更新频率

- 文件变化时立即更新
- 避免频繁的状态栏刷新
- 分页内容按需计算

### 内容处理

- 内容清理和分页在内存中进行
- 对于大文件，分页处理避免一次性加载过多内容
- 阅读状态缓存减少重复计算

## 安全考虑

### 内容保护

- 状态栏默认不显示明文（显示迷惑内容）
- 内容仅在 tooltip 和对话框中显示（已移除 tooltip）
- 支持加密存储（Base64）

### 文件访问

- 使用 VS Code 的文件系统 API
- 遵循工作区权限限制
- 路径变量替换确保安全性

### 配置安全

- 配置文件支持版本控制
- 敏感信息可以加密存储
- 支持相对路径和绝对路径

## 扩展点

### 可扩展功能

1. **加密算法**
   - 当前使用 Base64
   - 可扩展为 AES 等加密算法

2. **内容格式**
   - 当前支持纯文本
   - 可扩展支持 JSON、YAML 等格式解析

3. **显示方式**
   - 当前使用状态栏和输出面板
   - 可扩展为 WebView、通知等

4. **多文件支持**
   - 当前支持多文件切换
   - 可扩展为文件列表管理界面

5. **阅读功能**
   - 当前支持分页
   - 可扩展为书签、高亮等功能

## 测试建议

### 单元测试

- 文件读取函数
- 内容处理函数（清理、分页）
- 配置解析函数
- 迷惑内容生成函数

### 集成测试

- 文件监听功能
- 状态栏更新
- 命令执行
- 配置变化响应

### 手动测试场景

1. **文件操作**
   - 文件创建、修改、删除
   - 文件路径变化

2. **配置变更**
   - JSON 配置文件变化
   - VS Code 设置变化
   - 配置优先级测试

3. **命令执行**
   - 所有命令功能测试
   - 快捷键测试

4. **错误处理**
   - 文件不存在
   - 路径错误
   - 配置格式错误

5. **性能测试**
   - 大文件处理
   - 多文件切换
   - 频繁更新
