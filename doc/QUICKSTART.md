# 快速开始指南

## 5 分钟快速上手

### 步骤 1: 安装依赖

```bash
cd vscode插件开发/控制栏阅读
npm install
```

### 步骤 2: 编译代码

```bash
npm run compile
```

### 步骤 3: 创建测试文件

在工作区根目录创建 `secret.txt`：

```bash
echo "这是我的秘密内容" > secret.txt
```

### 步骤 4: 运行调试

1. 在 VS Code 中打开插件目录
2. 按 `F5` 启动调试
3. 在新打开的窗口中，状态栏右侧会显示一个圆圈图标
4. 鼠标悬停在图标上可看到 tooltip
5. 点击图标可在输出面板查看完整内容

## 常用命令

### 开发命令

```bash
# 编译 TypeScript
npm run compile

# 监听模式编译（自动重新编译）
npm run watch

# 打包为 VSIX
npm run package
```

### VS Code 命令

在命令面板（`Ctrl+Shift+P`）中：

- `控制栏阅读: 显示隐藏内容` - 查看完整内容
- `控制栏阅读: 重新加载文件` - 重新读取文件
- `控制栏阅读: 配置文件路径` - 修改文件路径

## 配置示例

### 基本配置

在 `.vscode/settings.json` 中：

```json
{
  "secretStatusBar.filePath": "${workspaceFolder}/secret.txt"
}
```

### 启用加密

```json
{
  "secretStatusBar.enableEncryption": true,
  "secretStatusBar.filePath": "${workspaceFolder}/secret.txt"
}
```

然后文件内容需要是 Base64 编码的。

### 自定义图标

```json
{
  "secretStatusBar.icon": "$(lock)"
}
```

## 故障排除

### 问题：状态栏没有显示

**解决方案：**
1. 检查文件路径是否正确
2. 查看输出面板的错误信息
3. 使用命令 `控制栏阅读: 重新加载文件`

### 问题：文件更新后没有刷新

**解决方案：**
1. 确保文件已保存
2. 手动触发重新加载命令
3. 检查文件监听器是否正常工作

### 问题：TypeScript 编译错误

**解决方案：**
```bash
npm install
npm run compile
```

如果仍有问题，检查 `node_modules` 是否完整安装。

