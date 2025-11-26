import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 配置接口
 */
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

/**
 * 阅读状态接口
 */
interface ReadingState {
    currentPage: number;
    currentFile: string;
    lastUpdateTime: number;
}

/**
 * 搜索匹配结果接口
 */
interface SearchMatch {
    index: number;        // 匹配位置在清理后内容中的索引
    page: number;         // 匹配所在的页面（0-based）
    context: string;      // 匹配上下文（用于显示）
}

/**
 * 页面边界接口
 */
interface PageBoundary {
    start: number;        // 页面在清理后内容中的起始位置
    end: number;          // 页面在清理后内容中的结束位置
}

/**
 * 从 JSON 配置文件读取配置
 */
async function loadConfigFromFile(context?: vscode.ExtensionContext): Promise<PluginConfig | null> {
    try {
        // 优先从工作区根目录查找配置文件
        let configPath: string | undefined;
        
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            configPath = path.join(
                vscode.workspace.workspaceFolders[0].uri.fsPath,
                'secret-status-bar.config.json'
            );
        } else if (context) {
            // 如果没有工作区，尝试从扩展目录查找
            configPath = path.join(
                path.dirname(context.extensionPath),
                'secret-status-bar.config.json'
            );
        }
        
        if (configPath && fs.existsSync(configPath)) {
            const configContent = fs.readFileSync(configPath, 'utf-8');
            const config: PluginConfig = JSON.parse(configContent);
            console.log('从配置文件加载:', configPath);
            return config;
        }
    } catch (error) {
        console.error('读取配置文件失败:', error);
    }
    
    return null;
}

/**
 * 获取配置的文件路径（优先从 JSON 文件，其次从 VS Code 设置）
 */
async function getFilePath(context?: vscode.ExtensionContext): Promise<string | undefined> {
    // 先尝试从 JSON 配置文件读取
    const fileConfig = await loadConfigFromFile(context);
    let filePath: string | undefined;
    
    if (fileConfig?.filePath) {
        filePath = fileConfig.filePath;
    } else {
        // 回退到 VS Code 设置
    const config = vscode.workspace.getConfiguration('secretStatusBar');
        filePath = config.get<string>('filePath', '${workspaceFolder}/secret.txt');
    }
    
    // 替换变量
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        filePath = filePath.replace(/\$\{workspaceFolder\}/g, workspaceFolder);
    } else if (filePath.includes('${workspaceFolder}')) {
        // 如果没有工作区文件夹，但路径包含变量，尝试使用扩展上下文路径
        if (context) {
            const extensionPath = path.dirname(context.extensionPath);
            filePath = filePath.replace(/\$\{workspaceFolder\}/g, extensionPath);
        } else {
            // 如果仍然有未替换的变量，返回 undefined 以触发错误提示
            return undefined;
        }
    }
    
    return filePath;
}

/**
 * 获取配置值（优先从 JSON 文件，其次从 VS Code 设置）
 */
async function getConfigValue<T>(
    key: keyof PluginConfig,
    defaultValue: T,
    context?: vscode.ExtensionContext
): Promise<T> {
    const fileConfig = await loadConfigFromFile(context);
    
    if (fileConfig && fileConfig[key] !== undefined) {
        return fileConfig[key] as T;
    }
    
    // 回退到 VS Code 设置
    const config = vscode.workspace.getConfiguration('secretStatusBar');
    const configKey = key === 'filePath' ? 'filePath' :
                     key === 'enableEncryption' ? 'enableEncryption' :
                     key === 'enableClickDialog' ? 'enableClickDialog' :
                     key === 'icon' ? 'icon' :
                     key === 'showPageInfo' ? 'showPageInfo' : key;
    
    return config.get<T>(configKey as string, defaultValue);
}

/**
 * 读取文件内容
 */
async function readFileContent(filePath: string, context?: vscode.ExtensionContext): Promise<string> {
    try {
        const uri = vscode.Uri.file(filePath);
        const data = await vscode.workspace.fs.readFile(uri);
        let content = Buffer.from(data).toString('utf-8');
        
        // 检查是否需要解密（优先从 JSON 配置文件读取）
        const enableEncryption = await getConfigValue('enableEncryption', false, context);
        
        if (enableEncryption) {
            // 简单的 Base64 解码（实际使用中可以用更复杂的加密）
            try {
                content = Buffer.from(content, 'base64').toString('utf-8');
            } catch {
                // 如果解码失败，返回原内容
            }
        }
        
        // 去除首尾空白，并清理多余的空行
        content = content.trim();
        // 将多个连续换行符替换为单个换行符，但保留段落之间的单个换行
        content = content.replace(/\n{3,}/g, '\n\n');
        
        return content;
    } catch (error) {
        throw new Error(`无法读取文件: ${error}`);
    }
}

/**
 * 清理文本内容（移除所有空白和换行）
 */
function cleanTextContent(content: string): string {
    // 移除所有空白字符（空格、制表符、换行符等）
    return content.replace(/\s+/g, ' ').trim();
}

/**
 * 将内容分页
 */
function paginateContent(content: string, pageSize: number): string[] {
    const pages: string[] = [];
    // 清理内容：移除所有空白和换行，只保留单个空格分隔
    const cleanedContent = cleanTextContent(content);
    
    if (cleanedContent.length === 0) {
        return [''];
    }
    
    // 按字符数分页，但尽量在单词边界处断开（如果可能）
    for (let i = 0; i < cleanedContent.length; i += pageSize) {
        let pageContent = cleanedContent.substring(i, i + pageSize);
        
        // 如果不是最后一页，尝试在空格处断开，避免截断单词
        if (i + pageSize < cleanedContent.length && pageContent.length === pageSize) {
            const lastSpaceIndex = pageContent.lastIndexOf(' ');
            if (lastSpaceIndex > pageSize * 0.7) { // 如果空格位置在70%之后，才在空格处断开
                pageContent = pageContent.substring(0, lastSpaceIndex + 1);
                i -= (pageSize - lastSpaceIndex - 1); // 调整索引
            }
        }
        
        pages.push(pageContent.trim());
    }
    return pages;
}

/**
 * 构建页面边界映射表
 * 通过查找每个页面内容在清理后内容中的位置来构建边界
 */
function buildPageBoundaries(
    pages: string[],
    cleanedContent: string,
    pageSize: number
): PageBoundary[] {
    const boundaries: PageBoundary[] = [];
    let searchStart = 0;
    
    for (let i = 0; i < pages.length; i++) {
        const pageContent = pages[i].trim();
        
        if (pageContent.length === 0) {
            // 空页面
            const lastEnd = boundaries.length > 0 
                ? boundaries[boundaries.length - 1].end 
                : 0;
            boundaries.push({
                start: lastEnd,
                end: lastEnd
            });
            continue;
        }
        
        // 从上次搜索位置开始查找页面内容
        const pageIndex = cleanedContent.indexOf(pageContent, searchStart);
        
        if (pageIndex >= 0) {
            // 找到精确匹配
            boundaries.push({
                start: pageIndex,
                end: pageIndex + pageContent.length
            });
            searchStart = pageIndex + pageContent.length;
        } else {
            // 如果找不到精确匹配，使用估算位置（基于 pageSize）
            const estimatedStart = i * pageSize;
            const estimatedEnd = Math.min(estimatedStart + pageContent.length, cleanedContent.length);
            boundaries.push({
                start: estimatedStart,
                end: estimatedEnd
            });
            searchStart = estimatedEnd;
        }
    }
    
    return boundaries;
}

/**
 * 根据位置计算所在的页面
 */
function calculatePageForPosition(
    position: number,
    boundaries: PageBoundary[]
): number {
    for (let i = 0; i < boundaries.length; i++) {
        const boundary = boundaries[i];
        if (position >= boundary.start && position < boundary.end) {
            return i;
        }
    }
    // 如果位置超出范围，返回最后一页
    return Math.max(0, boundaries.length - 1);
}

/**
 * 在内容中搜索匹配的文本
 */
function searchContent(
    cleanedContent: string,
    searchText: string,
    pages: string[],
    pageSize: number
): SearchMatch[] {
    const matches: SearchMatch[] = [];
    
    if (!searchText || searchText.trim().length === 0) {
        return matches;
    }
    
    // 构建页面边界映射
    const boundaries = buildPageBoundaries(pages, cleanedContent, pageSize);
    
    // 转义特殊字符，支持普通文本搜索
    const escapedSearchText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escapedSearchText, 'gi');
    
    // 限制搜索结果数量（最多100个）
    const maxResults = 100;
    let resultCount = 0;
    
    // 在清理后的内容中搜索所有匹配
    let match;
    const searchRegexGlobal = new RegExp(escapedSearchText, 'gi');
    while ((match = searchRegexGlobal.exec(cleanedContent)) !== null && resultCount < maxResults) {
        const matchIndex = match.index;
        const matchLength = match[0].length;
        
        // 计算匹配所在的页面
        const page = calculatePageForPosition(matchIndex, boundaries);
        
        // 提取上下文（前后各30个字符）
        const contextStart = Math.max(0, matchIndex - 30);
        const contextEnd = Math.min(cleanedContent.length, matchIndex + matchLength + 30);
        let context = cleanedContent.substring(contextStart, contextEnd);
        
        // 如果上下文被截断，添加省略号
        if (contextStart > 0) {
            context = '...' + context;
        }
        if (contextEnd < cleanedContent.length) {
            context = context + '...';
        }
        
        matches.push({
            index: matchIndex,
            page: page,
            context: context
        });
        
        resultCount++;
    }
    
    return matches;
}

/**
 * 获取阅读状态（从缓存）
 */
function getReadingState(context: vscode.ExtensionContext, filePath: string): ReadingState {
    const stateKey = `readingState_${filePath}`;
    const cached = context.globalState.get<ReadingState>(stateKey);
    if (cached) {
        return cached;
    }
    return {
        currentPage: 0,
        currentFile: filePath,
        lastUpdateTime: Date.now()
    };
}

/**
 * 保存阅读状态（到缓存）
 */
function saveReadingState(context: vscode.ExtensionContext, state: ReadingState): void {
    const stateKey = `readingState_${state.currentFile}`;
    context.globalState.update(stateKey, state);
}

/**
 * 生成迷惑性文案（模拟VS Code状态栏信息）
 */
function generateDecoyText(): string {
    // 模拟VS Code常见的状态栏信息，更加自然和隐蔽
    const decoyTexts = [
        // 光标位置信息
        `Ln ${Math.floor(Math.random() * 1000) + 1}, Col ${Math.floor(Math.random() * 80) + 1}`,
        `Ln ${Math.floor(Math.random() * 500) + 1}, Col ${Math.floor(Math.random() * 100) + 1}`,
        
        // 文件编码信息
        'UTF-8',
        'UTF-8 with BOM',
        'GBK',
        
        // 语言模式
        'Plain Text',
        'Markdown',
        'Text',
        
        // 缩进信息
        'Spaces: 4',
        'Spaces: 2',
        'Tab Size: 4',
        'Tab Size: 2',
        
        // 行尾符信息
        'LF',
        'CRLF',
        
        // 文件统计（看起来像VS Code的统计信息）
        `${Math.floor(Math.random() * 500) + 50} lines`,
        `${Math.floor(Math.random() * 1000) + 100} lines`,
        
        // 时间信息（简短格式）
        new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        
        // 组合信息（更真实）
        `UTF-8 • LF • Spaces: 4`,
        `Plain Text • ${Math.floor(Math.random() * 200) + 10} lines`,
        `Ln ${Math.floor(Math.random() * 300) + 1} • UTF-8`,
        
        // 简单的状态指示（最隐蔽）
        '●',
        '○',
        '◉'
    ];
    return decoyTexts[Math.floor(Math.random() * decoyTexts.length)];
}

/**
 * 对内容进行加密/哈希处理（用于状态栏显示）
 */
async function processContentForDisplay(content: string, context?: vscode.ExtensionContext): Promise<string> {
    const enableEncryption = await getConfigValue('enableEncryption', false, context);
    
    if (enableEncryption) {
        // 返回内容的哈希摘要（前8个字符）
        const hash = Buffer.from(content).toString('base64').substring(0, 8);
        return `[${hash}...]`;
    }
    
    // 默认返回内容的缩写版本
    if (content.length > 50) {
        return content.substring(0, 47) + '...';
    }
    return content;
}

/**
 * 创建或更新状态栏（支持真实内容和迷惑内容切换）
 */
async function updateStatusBar(
    statusBarItem: vscode.StatusBarItem,
    content: string,
    filePath: string,
    currentPage: number,
    totalPages: number,
    showRealContent: boolean,
    context?: vscode.ExtensionContext
) {
    const maxDisplayLength = await getConfigValue('maxDisplayLength', 50, context);
    
    let displayText: string;
    
    if (showRealContent) {
        // 显示真实内容
        // 清理内容：移除所有空白和换行
        displayText = cleanTextContent(content);
        
        // 如果内容超过最大显示长度，智能截断
        if (displayText.length > maxDisplayLength) {
            // 尝试在单词边界处截断
            const truncated = displayText.substring(0, maxDisplayLength - 3);
            const lastSpaceIndex = truncated.lastIndexOf(' ');
            
            if (lastSpaceIndex > maxDisplayLength * 0.7) {
                // 如果空格位置合理，在空格处截断
                displayText = truncated.substring(0, lastSpaceIndex) + '...';
            } else {
                // 否则直接截断
                displayText = truncated + '...';
            }
        }
    } else {
        // 显示迷惑性文案
        displayText = generateDecoyText();
    }
    
    // 确保文本完整显示，不被截断
    // 如果有分页，根据配置决定是否显示页码信息（只在显示真实内容时显示页码）
    const showPageInfo = await getConfigValue('showPageInfo', false, context);
    if (totalPages > 1 && showRealContent && showPageInfo) {
        // 计算页码信息占用的空间
        const pageInfo = ` [${currentPage + 1}/${totalPages}]`;
        const availableLength = maxDisplayLength - pageInfo.length;
        
        // 如果内容太长，需要进一步截断以容纳页码
        if (displayText.length > availableLength) {
            const truncated = displayText.substring(0, availableLength - 3);
            const lastSpaceIndex = truncated.lastIndexOf(' ');
            if (lastSpaceIndex > availableLength * 0.7) {
                displayText = truncated.substring(0, lastSpaceIndex) + '...';
            } else {
                displayText = truncated + '...';
            }
        }
        
        statusBarItem.text = `${displayText}${pageInfo}`;
    } else {
        statusBarItem.text = displayText;
    }
    
    // 移除 tooltip（不显示气泡框）
    statusBarItem.tooltip = '';
    
    // 设置命令（确保点击有效）
    statusBarItem.command = 'secretStatusBar.showContent';
    statusBarItem.accessibilityInformation = {
        label: `控制栏阅读: ${displayText}`
    };
    
    statusBarItem.show();
}

/**
 * 显示内容对话框
 */
async function showContentDialog(
    content: string,
    currentPage: number,
    totalPages: number,
    context?: vscode.ExtensionContext
) {
    const enableClickDialog = await getConfigValue('enableClickDialog', true, context);
    
    if (!enableClickDialog) {
        return;
    }
    
    // 创建输出通道显示内容
    const outputChannel = vscode.window.createOutputChannel('控制栏阅读');
    outputChannel.clear();
    outputChannel.appendLine('═══════════════════════════════════════');
    outputChannel.appendLine('隐藏内容');
    if (totalPages > 1) {
        outputChannel.appendLine(`第 ${currentPage + 1} 页 / 共 ${totalPages} 页`);
    }
    outputChannel.appendLine('═══════════════════════════════════════');
    outputChannel.appendLine(content);
    outputChannel.appendLine('═══════════════════════════════════════');
    outputChannel.show(true);
    
    // 同时显示信息提示
    const message = totalPages > 1 
        ? `内容已显示在输出面板中（第 ${currentPage + 1}/${totalPages} 页）`
        : '内容已显示在输出面板中';
    await vscode.window.showInformationMessage(message, '确定');
}

/**
 * 监听文件变化
 */
function watchFile(filePath: string, callback: () => void): vscode.FileSystemWatcher | null {
    try {
        const pattern = new vscode.RelativePattern(
            path.dirname(filePath),
            path.basename(filePath)
        );
        
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        
        watcher.onDidChange(() => {
            callback();
        });
        
        watcher.onDidCreate(() => {
            callback();
        });
        
        watcher.onDidDelete(() => {
            vscode.window.showWarningMessage(`文件已删除: ${filePath}`);
        });
        
        return watcher;
    } catch (error) {
        console.error('创建文件监听器失败:', error);
        return null;
    }
}

/**
 * 初始化默认配置
 */
async function initializeDefaultConfig(context: vscode.ExtensionContext): Promise<void> {
    const config = vscode.workspace.getConfiguration('secretStatusBar');
    
    // 检查是否已经配置过
    const hasConfig = config.has('filePath') || 
                     (vscode.workspace.workspaceFolders && 
                      fs.existsSync(path.join(
                          vscode.workspace.workspaceFolders[0].uri.fsPath,
                          'secret-status-bar.config.json'
                      )));
    
    if (!hasConfig) {
        // 设置默认文件路径
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            const defaultPath = path.join(workspaceFolder.uri.fsPath, 'secret.txt');
            const relativePath = path.relative(workspaceFolder.uri.fsPath, defaultPath);
            const configPath = `\${workspaceFolder}/${relativePath}`;
            
            // 如果文件不存在，创建示例文件
            if (!fs.existsSync(defaultPath)) {
                const exampleContent = '这是一个示例文件\n\n你可以在这里放置任何文本内容\n\n插件会自动读取并显示在状态栏';
                fs.writeFileSync(defaultPath, exampleContent, 'utf-8');
            }
            
            // 设置默认配置
            await config.update('filePath', configPath, vscode.ConfigurationTarget.Workspace);
            console.log('已初始化默认配置:', configPath);
        }
    }
}

/**
 * 创建可视化设置界面
 */
function createSettingsWebview(context: vscode.ExtensionContext): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
        'secretStatusBarSettings',
        '控制栏阅读 设置',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );
    
    const config = vscode.workspace.getConfiguration('secretStatusBar');
    const filePath = config.get<string>('filePath', '${workspaceFolder}/secret.txt');
    const maxDisplayLength = config.get<number>('maxDisplayLength', 50);
    const pageSize = config.get<number>('pageSize', 50);
    const enableCache = config.get<boolean>('enableCache', true);
    const enableClickDialog = config.get<boolean>('enableClickDialog', true);
    const enableEncryption = config.get<boolean>('enableEncryption', false);
    const showPageInfo = config.get<boolean>('showPageInfo', false);
    const icon = config.get<string>('icon', '$(circle-outline)');
    const files = config.get<string[]>('files', []);
    
    panel.webview.html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>控制栏阅读 设置</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
        }
        input[type="text"], input[type="number"] {
            width: 100%;
            padding: 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
        }
        input[type="checkbox"] {
            margin-right: 8px;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 2px;
            cursor: pointer;
            margin-right: 10px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .button-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .button-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .help-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }
        .file-list {
            margin-top: 10px;
        }
        .file-item {
            display: flex;
            align-items: center;
            margin-bottom: 5px;
        }
        .file-item input {
            flex: 1;
            margin-right: 10px;
        }
        .remove-btn {
            background-color: var(--vscode-errorForeground);
            padding: 4px 8px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <h2>控制栏阅读 设置</h2>
    
    <div class="form-group">
        <label for="filePath">文件路径：</label>
        <input type="text" id="filePath" value="${filePath}" />
        <div class="help-text">支持 \${workspaceFolder} 变量，或使用绝对路径</div>
    </div>
    
    <div class="form-group">
        <label for="maxDisplayLength">状态栏最大显示长度：</label>
        <input type="number" id="maxDisplayLength" value="${maxDisplayLength}" min="10" max="200" />
        <div class="help-text">超过此长度会截断显示</div>
    </div>
    
    <div class="form-group">
        <label for="pageSize">每页字符数：</label>
        <input type="number" id="pageSize" value="${pageSize}" min="10" max="1000" />
        <div class="help-text">用于分页显示</div>
    </div>
    
    <div class="form-group">
        <label>
            <input type="checkbox" id="enableCache" ${enableCache ? 'checked' : ''} />
            启用阅读缓存（记住阅读位置）
        </label>
    </div>
    
    <div class="form-group">
        <label>
            <input type="checkbox" id="enableClickDialog" ${enableClickDialog ? 'checked' : ''} />
            点击状态栏时显示对话框
        </label>
    </div>
    
    <div class="form-group">
        <label>
            <input type="checkbox" id="enableEncryption" ${enableEncryption ? 'checked' : ''} />
            启用加密（Base64）
        </label>
    </div>
    
    <div class="form-group">
        <label>
            <input type="checkbox" id="showPageInfo" ${showPageInfo ? 'checked' : ''} />
            显示页码信息（第几页/总页数）
        </label>
        <div class="help-text">在状态栏显示页码信息，如 [1/5]</div>
    </div>
    
    <div class="form-group">
        <label for="icon">状态栏图标：</label>
        <input type="text" id="icon" value="${icon}" />
        <div class="help-text">VS Code 图标 ID，如: $(circle-outline), $(lock), $(eye)</div>
    </div>
    
    <div class="form-group">
        <label>文件列表（支持多文件切换）：</label>
        <div id="fileList" class="file-list"></div>
        <button type="button" class="button-secondary" onclick="addFile()">添加文件</button>
    </div>
    
    <div class="form-group" style="margin-top: 30px;">
        <label>快捷键配置：</label>
        <div class="help-text" style="margin-top: 10px; line-height: 1.6;">
            <strong>默认快捷键：</strong><br>
            • 显示真实内容（长按）：<code>Ctrl+Shift+Space</code> (Mac: <code>Cmd+Shift+Space</code>)<br>
            • 显示迷惑内容（释放）：<code>Escape</code>（可选）<br>
            • 上一页：<code>Ctrl+Up</code> (Mac: <code>Cmd+Up</code>)<br>
            • 下一页：<code>Ctrl+Down</code> (Mac: <code>Cmd+Down</code>)<br><br>
            <strong>使用说明：</strong><br>
            长按 <code>Ctrl+Shift+Space</code> 显示真实内容，松开后自动恢复迷惑内容<br>
            只有在显示真实内容时才能切换页码<br><br>
            <strong>自定义快捷键：</strong><br>
            使用命令 <code>控制栏阅读: 配置快捷键</code> 可以快速配置自定义快捷键
        </div>
    </div>
    
    <div style="margin-top: 30px;">
        <button onclick="saveSettings()">保存设置</button>
        <button class="button-secondary" onclick="selectFile()">选择文件</button>
        <button class="button-secondary" onclick="resetSettings()">重置为默认值</button>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        // 初始化文件列表
        const files = ${JSON.stringify(files)};
        const fileListContainer = document.getElementById('fileList');
        
        function renderFileList() {
            fileListContainer.innerHTML = '';
            files.forEach((file, index) => {
                const div = document.createElement('div');
                div.className = 'file-item';
                div.innerHTML = \`
                    <input type="text" value="\${file}" onchange="updateFile(\${index}, this.value)" />
                    <button class="remove-btn" onclick="removeFile(\${index})">删除</button>
                \`;
                fileListContainer.appendChild(div);
            });
        }
        
        function addFile() {
            files.push('\${workspaceFolder}/secret.txt');
            renderFileList();
        }
        
        function updateFile(index, value) {
            files[index] = value;
        }
        
        function removeFile(index) {
            files.splice(index, 1);
            renderFileList();
        }
        
        function saveSettings() {
            const settings = {
                filePath: document.getElementById('filePath').value,
                maxDisplayLength: parseInt(document.getElementById('maxDisplayLength').value),
                pageSize: parseInt(document.getElementById('pageSize').value),
                enableCache: document.getElementById('enableCache').checked,
                enableClickDialog: document.getElementById('enableClickDialog').checked,
                enableEncryption: document.getElementById('enableEncryption').checked,
                showPageInfo: document.getElementById('showPageInfo').checked,
                icon: document.getElementById('icon').value,
                files: files.filter(f => f.trim())
            };
            
            vscode.postMessage({
                command: 'saveSettings',
                settings: settings
            });
        }
        
        function selectFile() {
            vscode.postMessage({
                command: 'selectFile'
            });
        }
        
        function resetSettings() {
            if (confirm('确定要重置所有设置为默认值吗？')) {
                document.getElementById('filePath').value = '\${workspaceFolder}/secret.txt';
                document.getElementById('maxDisplayLength').value = '50';
                document.getElementById('pageSize').value = '50';
                document.getElementById('enableCache').checked = true;
                document.getElementById('enableClickDialog').checked = true;
                document.getElementById('enableEncryption').checked = false;
                document.getElementById('showPageInfo').checked = false;
                document.getElementById('icon').value = '$(circle-outline)';
                files.length = 0;
                renderFileList();
            }
        }
        
        renderFileList();
    </script>
</body>
</html>`;
    
    return panel;
}

/**
 * 主激活函数
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('控制栏阅读 插件已激活');
    
    // 初始化默认配置
    initializeDefaultConfig(context).catch(err => {
        console.error('初始化默认配置失败:', err);
    });
    
    let statusBarItem: vscode.StatusBarItem;
    let fileWatcher: vscode.FileSystemWatcher | null = null;
    let currentContent: string = '';
    let currentPages: string[] = [];
    let currentFileIndex: number = 0;
    let fileList: string[] = [];
    let settingsWebview: vscode.WebviewPanel | undefined = undefined;
    let showRealContent: boolean = false; // 默认显示迷惑内容
    
    // 创建状态栏项
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        1000
    );
    
    /**
     * 获取文件列表
     */
    async function getFileList(): Promise<string[]> {
        const files = await getConfigValue<string[]>('files', [], context);
        const filePath = await getFilePath(context);
        
        const fileList: string[] = [];
        if (filePath) {
            fileList.push(filePath);
        }
        if (files && files.length > 0) {
            // 处理文件列表中的变量
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            files.forEach(f => {
                let processedPath = f;
                if (workspaceFolder) {
                    processedPath = processedPath.replace(/\$\{workspaceFolder\}/g, workspaceFolder);
                }
                if (processedPath && !fileList.includes(processedPath)) {
                    fileList.push(processedPath);
                }
            });
        }
        return fileList;
    }
    
    /**
     * 加载文件内容并更新状态栏
     */
    async function loadAndUpdate(fileIndex?: number) {
        fileList = await getFileList();
        
        if (fileList.length === 0) {
            statusBarItem.text = '$(error) 未配置文件';
            statusBarItem.tooltip = '错误: 未配置文件路径\n\n请使用命令 "控制栏阅读: 配置文件路径" 设置文件路径，或在 secret-status-bar.config.json 中配置';
            statusBarItem.show();
            return;
        }
        
        // 确定要加载的文件索引
        if (fileIndex !== undefined) {
            currentFileIndex = Math.max(0, Math.min(fileIndex, fileList.length - 1));
        } else if (currentFileIndex >= fileList.length) {
            currentFileIndex = 0;
        }
        
        const filePath = fileList[currentFileIndex];
        
        if (!filePath) {
            statusBarItem.text = '$(error) 文件路径无效';
            statusBarItem.tooltip = '错误: 文件路径无效';
            statusBarItem.show();
            return;
        }
        
        // 检查路径中是否还有未替换的变量
        if (filePath.includes('${workspaceFolder}')) {
            statusBarItem.text = '$(error) 路径变量未替换';
            statusBarItem.tooltip = `错误: 路径包含未替换的变量\n\n当前路径: ${filePath}\n\n请在新窗口中打开一个文件夹，或使用命令配置绝对路径`;
            statusBarItem.show();
            return;
        }
        
        try {
            currentContent = await readFileContent(filePath, context);
            
            // 获取分页大小
            const pageSize = await getConfigValue('pageSize', 50, context);
            currentPages = paginateContent(currentContent, pageSize);
            
            // 获取阅读状态（缓存）
            const enableCache = await getConfigValue('enableCache', true, context);
            let currentPage = 0;
            
            if (enableCache && currentPages.length > 0) {
                const readingState = getReadingState(context, filePath);
                // 确保页码有效
                currentPage = Math.max(0, Math.min(readingState.currentPage, currentPages.length - 1));
            }
            
            // 更新状态栏
            const pageContent = currentPages[currentPage] || '';
            await updateStatusBar(
                statusBarItem,
                pageContent,
                filePath,
                currentPage,
                currentPages.length,
                showRealContent,
                context
            );
            
            // 保存阅读状态
            if (enableCache) {
                saveReadingState(context, {
                    currentPage,
                    currentFile: filePath,
                    lastUpdateTime: Date.now()
                });
            }
            
            // 设置文件监听
            if (fileWatcher) {
                fileWatcher.dispose();
            }
            fileWatcher = watchFile(filePath, () => {
                loadAndUpdate();
            });
            
        } catch (error: any) {
            statusBarItem.text = '$(error) 加载失败';
            statusBarItem.tooltip = `错误: ${error.message}\n\n文件路径: ${filePath}\n\n请检查文件是否存在，或使用命令重新配置路径`;
            statusBarItem.show();
            console.error('加载文件失败:', error);
        }
    }
    
    /**
     * 切换到上一页（只有在显示真实内容时才允许）
     */
    async function goToPreviousPage() {
        // 只有在显示真实内容时才允许切换页码
        if (!showRealContent) {
            vscode.window.showWarningMessage('请先按住快捷键显示真实内容才能切换页码');
            return;
        }
        
        if (currentPages.length === 0) {
            return;
        }
        
        const enableCache = await getConfigValue('enableCache', true, context);
        const filePath = fileList[currentFileIndex];
        
        if (!filePath) return;
        
        const readingState = getReadingState(context, filePath);
        let currentPage = readingState.currentPage;
        
        currentPage = Math.max(0, currentPage - 1);
        
        const pageContent = currentPages[currentPage] || '';
        await updateStatusBar(
            statusBarItem,
            pageContent,
            filePath,
            currentPage,
            currentPages.length,
            showRealContent,
            context
        );
        
        if (enableCache) {
            saveReadingState(context, {
                currentPage,
                currentFile: filePath,
                lastUpdateTime: Date.now()
            });
        }
    }
    
    /**
     * 切换到下一页（只有在显示真实内容时才允许）
     */
    async function goToNextPage() {
        // 只有在显示真实内容时才允许切换页码
        if (!showRealContent) {
            vscode.window.showWarningMessage('请先按住快捷键显示真实内容才能切换页码');
            return;
        }
        
        if (currentPages.length === 0) {
            return;
        }
        
        const enableCache = await getConfigValue('enableCache', true, context);
        const filePath = fileList[currentFileIndex];
        
        if (!filePath) return;
        
        const readingState = getReadingState(context, filePath);
        let currentPage = readingState.currentPage;
        
        currentPage = Math.min(currentPages.length - 1, currentPage + 1);
        
        const pageContent = currentPages[currentPage] || '';
        await updateStatusBar(
            statusBarItem,
            pageContent,
            filePath,
            currentPage,
            currentPages.length,
            showRealContent,
            context
        );
        
        if (enableCache) {
            saveReadingState(context, {
                currentPage,
                currentFile: filePath,
                lastUpdateTime: Date.now()
            });
        }
    }
    
    /**
     * 切换到下一个文件
     */
    async function switchToNextFile() {
        if (fileList.length <= 1) {
            vscode.window.showInformationMessage('只有一个文件，无法切换');
            return;
        }
        
        currentFileIndex = (currentFileIndex + 1) % fileList.length;
        await loadAndUpdate(currentFileIndex);
        vscode.window.showInformationMessage(`已切换到: ${path.basename(fileList[currentFileIndex])}`);
    }
    
    /**
     * 跳转到指定页面
     */
    async function jumpToPage(targetPage: number) {
        if (currentPages.length === 0) {
            vscode.window.showWarningMessage('内容未加载，请先加载文件');
            return;
        }
        
        // 确保页码有效
        const validPage = Math.max(0, Math.min(targetPage, currentPages.length - 1));
        const filePath = fileList[currentFileIndex];
        
        if (!filePath) {
            vscode.window.showWarningMessage('文件路径无效');
            return;
        }
        
        // 确保显示真实内容
        if (!showRealContent) {
            showRealContent = true;
        }
        
        // 更新阅读状态
        const enableCache = await getConfigValue('enableCache', true, context);
        if (enableCache) {
            saveReadingState(context, {
                currentPage: validPage,
                currentFile: filePath,
                lastUpdateTime: Date.now()
            });
        }
        
        // 更新状态栏
        const pageContent = currentPages[validPage] || '';
        await updateStatusBar(
            statusBarItem,
            pageContent,
            filePath,
            validPage,
            currentPages.length,
            showRealContent,
            context
        );
        
        // 显示提示
        vscode.window.showInformationMessage(
            `已跳转到第 ${validPage + 1} 页（共 ${currentPages.length} 页）`
        );
    }
    
    /**
     * 搜索内容并跳转
     */
    async function searchAndJump() {
        // 检查内容是否已加载
        if (!currentContent || currentPages.length === 0) {
            await loadAndUpdate();
            if (!currentContent || currentPages.length === 0) {
                vscode.window.showWarningMessage('无法加载内容，请检查文件配置');
                return;
            }
        }
        
        // 输入搜索关键词
        const searchText = await vscode.window.showInputBox({
            prompt: '请输入要搜索的内容',
            placeHolder: '搜索关键词...',
            ignoreFocusOut: true
        });
        
        if (!searchText || searchText.trim().length === 0) {
            return;
        }
        
        // 获取分页大小
        const pageSize = await getConfigValue('pageSize', 50, context);
        
        // 清理内容并搜索
        const cleanedContent = cleanTextContent(currentContent);
        const matches = searchContent(cleanedContent, searchText.trim(), currentPages, pageSize);
        
        // 处理搜索结果
        if (matches.length === 0) {
            vscode.window.showInformationMessage(`未找到匹配内容: "${searchText}"`);
            return;
        }
        
        if (matches.length === 1) {
            // 只有一个匹配，直接跳转
            await jumpToPage(matches[0].page);
        } else {
            // 多个匹配，显示选择列表
            const items = matches.map((match, index) => ({
                label: `第 ${match.page + 1} 页`,
                description: match.context,
                detail: `匹配位置: ${match.index + 1}`,
                match: match
            }));
            
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: `找到 ${matches.length} 个匹配结果，请选择要跳转的位置`,
                ignoreFocusOut: true
            });
            
            if (selected) {
                await jumpToPage(selected.match.page);
            }
        }
    }
    
    // 注册命令：显示内容
    const showContentCommand = vscode.commands.registerCommand(
        'secretStatusBar.showContent',
        async () => {
            if (currentContent && currentPages.length > 0) {
                const filePath = fileList[currentFileIndex] || '';
                const readingState = getReadingState(context, filePath);
                const currentPage = readingState.currentPage;
                const pageContent = currentPages[currentPage] || currentContent;
                await showContentDialog(pageContent, currentPage, currentPages.length, context);
            } else {
                await loadAndUpdate();
                if (currentContent && currentPages.length > 0) {
                    const filePath = fileList[currentFileIndex] || '';
                    const readingState = getReadingState(context, filePath);
                    const currentPage = readingState.currentPage;
                    const pageContent = currentPages[currentPage] || currentContent;
                    await showContentDialog(pageContent, currentPage, currentPages.length, context);
                }
            }
        }
    );
    
    // 注册命令：上一页
    const previousPageCommand = vscode.commands.registerCommand(
        'secretStatusBar.previousPage',
        async () => {
            await goToPreviousPage();
        }
    );
    
    // 注册命令：下一页
    const nextPageCommand = vscode.commands.registerCommand(
        'secretStatusBar.nextPage',
        async () => {
            await goToNextPage();
        }
    );
    
    // 注册命令：切换文件
    const switchFileCommand = vscode.commands.registerCommand(
        'secretStatusBar.switchFile',
        async () => {
            await switchToNextFile();
        }
    );
    
    /**
     * 更新状态栏显示
     */
    async function refreshStatusBar() {
        if (currentContent && currentPages.length > 0) {
            const filePath = fileList[currentFileIndex] || '';
            const readingState = getReadingState(context, filePath);
            const currentPage = readingState.currentPage;
            const pageContent = currentPages[currentPage] || '';
            await updateStatusBar(
                statusBarItem,
                pageContent,
                filePath,
                currentPage,
                currentPages.length,
                showRealContent,
                context
            );
        } else if (fileList.length > 0 && !showRealContent) {
            // 如果没有内容但文件列表存在，显示迷惑内容
            const decoyText = generateDecoyText();
            statusBarItem.text = decoyText;
            statusBarItem.tooltip = '';
            statusBarItem.command = 'secretStatusBar.showContent';
            statusBarItem.show();
        }
    }
    
    /**
     * 切换显示模式（按 Ctrl+Shift+T 切换）
     * 每次按下都会切换显示模式：真实内容 ↔ 迷惑内容
     */
    async function toggleDisplayMode() {
        // 直接切换显示模式
        showRealContent = !showRealContent;
        console.log(`[控制栏阅读] 切换显示模式: ${showRealContent ? '真实内容' : '迷惑内容'}`);
        await refreshStatusBar();
    }
    
    // 注册命令：切换显示模式（双击 Ctrl）
    const toggleDisplayCommand = vscode.commands.registerCommand(
        'secretStatusBar.toggleDisplay',
        async () => {
            await toggleDisplayMode();
        }
    );
    
    // 注册命令：切换显示模式（真实内容/迷惑内容）- 保留作为备用
    const toggleDisplayModeCommand = vscode.commands.registerCommand(
        'secretStatusBar.toggleDisplayMode',
        async () => {
            showRealContent = !showRealContent;
            await refreshStatusBar();
        }
    );
    
    // 注册命令：显示真实内容（兼容旧版本）
    const showRealContentCommand = vscode.commands.registerCommand(
        'secretStatusBar.showRealContent',
        async () => {
            if (!showRealContent) {
                showRealContent = true;
                await refreshStatusBar();
            }
        }
    );
    
    // 注册命令：显示迷惑内容（兼容旧版本）
    const showDecoyContentCommand = vscode.commands.registerCommand(
        'secretStatusBar.showDecoyContent',
        async () => {
            if (showRealContent) {
                showRealContent = false;
                await refreshStatusBar();
            }
        }
    );
    
    // 注册命令：配置快捷键
    const configureKeybindingsCommand = vscode.commands.registerCommand(
        'secretStatusBar.configureKeybindings',
        async () => {
            const choice = await vscode.window.showQuickPick(
                [
                    {
                        label: '$(keyboard) 配置显示真实内容的快捷键',
                        description: '设置按住时显示真实内容的快捷键',
                        command: 'secretStatusBar.showRealContent'
                    },
                    {
                        label: '$(keyboard) 配置显示迷惑内容的快捷键',
                        description: '设置恢复显示迷惑内容的快捷键',
                        command: 'secretStatusBar.showDecoyContent'
                    },
                    {
                        label: '$(keyboard) 配置上一页快捷键',
                        description: '设置切换到上一页的快捷键',
                        command: 'secretStatusBar.previousPage'
                    },
                    {
                        label: '$(keyboard) 配置下一页快捷键',
                        description: '设置切换到下一页的快捷键',
                        command: 'secretStatusBar.nextPage'
                    },
                    {
                        label: '$(settings-gear) 打开快捷键设置界面',
                        description: '在VS Code快捷键设置中查看所有快捷键',
                        command: 'workbench.action.openGlobalKeybindings'
                    }
                ],
                {
                    placeHolder: '选择要配置的快捷键',
                    ignoreFocusOut: true
                }
            );
            
            if (choice) {
                if (choice.command === 'workbench.action.openGlobalKeybindings') {
                    // 打开快捷键设置
                    await vscode.commands.executeCommand('workbench.action.openGlobalKeybindings');
                    // 等待一下，然后搜索相关命令
                    setTimeout(async () => {
                        await vscode.commands.executeCommand('workbench.action.openGlobalKeybindingsFile');
                    }, 500);
                } else {
                    // 打开快捷键设置并搜索对应命令
                    await vscode.commands.executeCommand('workbench.action.openGlobalKeybindings');
                    vscode.window.showInformationMessage(
                        `请在快捷键设置中搜索 "${choice.label.replace(/\$\([^)]+\)\s*/, '')}" 来配置快捷键`,
                        '确定'
                    );
                }
            }
        }
    );
    
    // 注册命令：打开设置界面
    const openSettingsCommand = vscode.commands.registerCommand(
        'secretStatusBar.openSettings',
        () => {
            if (settingsWebview) {
                settingsWebview.reveal();
            } else {
                settingsWebview = createSettingsWebview(context);
                
                // 处理 WebView 消息
                settingsWebview.webview.onDidReceiveMessage(
                    async (message) => {
                        if (message.command === 'saveSettings') {
                            const config = vscode.workspace.getConfiguration('secretStatusBar');
                            await config.update('filePath', message.settings.filePath, vscode.ConfigurationTarget.Workspace);
                            await config.update('maxDisplayLength', message.settings.maxDisplayLength, vscode.ConfigurationTarget.Workspace);
                            await config.update('pageSize', message.settings.pageSize, vscode.ConfigurationTarget.Workspace);
                            await config.update('enableCache', message.settings.enableCache, vscode.ConfigurationTarget.Workspace);
                            await config.update('enableClickDialog', message.settings.enableClickDialog, vscode.ConfigurationTarget.Workspace);
                            await config.update('enableEncryption', message.settings.enableEncryption, vscode.ConfigurationTarget.Workspace);
                            await config.update('showPageInfo', message.settings.showPageInfo, vscode.ConfigurationTarget.Workspace);
                            await config.update('icon', message.settings.icon, vscode.ConfigurationTarget.Workspace);
                            await config.update('files', message.settings.files, vscode.ConfigurationTarget.Workspace);
                            
                            await loadAndUpdate();
                            vscode.window.showInformationMessage('设置已保存！');
                        } else if (message.command === 'selectFile') {
                            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                            const selectedFiles = await vscode.window.showOpenDialog({
                                canSelectFiles: true,
                                canSelectFolders: false,
                                canSelectMany: false,
                                openLabel: '选择文件',
                                defaultUri: workspaceFolder?.uri
                            });
                            
                            if (selectedFiles && selectedFiles.length > 0) {
                                const selectedPath = selectedFiles[0].fsPath;
                                let filePath: string;
                                
                                if (workspaceFolder) {
                                    const workspacePath = workspaceFolder.uri.fsPath;
                                    if (selectedPath.startsWith(workspacePath)) {
                                        const relativePath = path.relative(workspacePath, selectedPath);
                                        filePath = path.join('${workspaceFolder}', relativePath).replace(/\\/g, '/');
                                    } else {
                                        filePath = selectedPath;
                                    }
                                } else {
                                    filePath = selectedPath;
                                }
                                
                                // 更新 WebView 中的文件路径
                                settingsWebview?.webview.postMessage({
                                    command: 'updateFilePath',
                                    filePath: filePath
                                });
                            }
                        }
                    },
                    undefined,
                    context.subscriptions
                );
                
                // 当 WebView 关闭时清理
                settingsWebview.onDidDispose(() => {
                    settingsWebview = undefined;
                });
            }
        }
    );
    
    // 注册命令：重新加载
    const reloadCommand = vscode.commands.registerCommand(
        'secretStatusBar.reload',
        async () => {
            await loadAndUpdate();
            vscode.window.showInformationMessage('文件已重新加载');
        }
    );
    
    // 注册命令：搜索内容
    const searchCommand = vscode.commands.registerCommand(
        'secretStatusBar.search',
        async () => {
            await searchAndJump();
        }
    );
    
    // 注册命令：配置路径
    const configCommand = vscode.commands.registerCommand(
        'secretStatusBar.config',
        async () => {
            const currentPath = await getFilePath(context);
            
            // 让用户选择配置方式
            const choice = await vscode.window.showQuickPick(
                [
                    {
                        label: '$(file) 通过文件选择器选择文件',
                        description: '使用 VS Code 文件选择对话框',
                        value: 'picker'
                    },
                    {
                        label: '$(edit) 手动输入文件路径',
                        description: '输入文件路径（支持 ${workspaceFolder} 变量）',
                        value: 'input'
                    }
                ],
                {
                    placeHolder: '选择配置方式',
                    ignoreFocusOut: true
                }
            );
            
            if (!choice) {
                return;
            }
            
            let filePath: string | undefined;
            
            if (choice.value === 'picker') {
                // 使用文件选择器
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                const defaultUri = currentPath 
                    ? vscode.Uri.file(currentPath) 
                    : workspaceFolder?.uri;
                
                const selectedFiles = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    openLabel: '选择文件',
                    defaultUri: defaultUri,
                    filters: {
                        '文本文件': ['txt', 'text'],
                        '所有文件': ['*']
                    }
                });
                
                if (selectedFiles && selectedFiles.length > 0) {
                    const selectedPath = selectedFiles[0].fsPath;
                    
                    // 如果文件在工作区内，转换为相对路径（使用 ${workspaceFolder}）
                    if (workspaceFolder) {
                        const workspacePath = workspaceFolder.uri.fsPath;
                        if (selectedPath.startsWith(workspacePath)) {
                            const relativePath = path.relative(workspacePath, selectedPath);
                            filePath = path.join('${workspaceFolder}', relativePath).replace(/\\/g, '/');
                        } else {
                            filePath = selectedPath;
                        }
                    } else {
                        filePath = selectedPath;
                    }
                } else {
                    return; // 用户取消了选择
                }
            } else {
                // 手动输入
                filePath = await vscode.window.showInputBox({
                    prompt: '请输入文件路径（支持 ${workspaceFolder} 变量，或使用绝对路径）\n提示：也可以直接编辑 secret-status-bar.config.json 文件',
                    value: currentPath || '',
                    placeHolder: vscode.workspace.workspaceFolders ? '${workspaceFolder}/secret.txt' : '/完整/路径/secret.txt'
                });
            }
            
            if (filePath) {
                const config = vscode.workspace.getConfiguration('secretStatusBar');
                await config.update('filePath', filePath, vscode.ConfigurationTarget.Workspace);
                await loadAndUpdate();
                vscode.window.showInformationMessage(`配置已更新: ${filePath}\n提示：也可以直接编辑 secret-status-bar.config.json 文件`);
            }
        }
    );
    
    // 注册命令：选择文件（直接打开文件选择器）
    const selectFileCommand = vscode.commands.registerCommand(
        'secretStatusBar.selectFile',
        async () => {
            const currentPath = await getFilePath(context);
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            const defaultUri = currentPath 
                ? vscode.Uri.file(currentPath) 
                : workspaceFolder?.uri;
            
            const selectedFiles = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                openLabel: '选择文件',
                defaultUri: defaultUri,
                filters: {
                    '文本文件': ['txt', 'text'],
                    '所有文件': ['*']
                }
            });
            
            if (selectedFiles && selectedFiles.length > 0) {
                const selectedPath = selectedFiles[0].fsPath;
                let filePath: string;
                
                // 如果文件在工作区内，转换为相对路径（使用 ${workspaceFolder}）
                if (workspaceFolder) {
                    const workspacePath = workspaceFolder.uri.fsPath;
                    if (selectedPath.startsWith(workspacePath)) {
                        const relativePath = path.relative(workspacePath, selectedPath);
                        filePath = path.join('${workspaceFolder}', relativePath).replace(/\\/g, '/');
                    } else {
                        filePath = selectedPath;
                    }
                } else {
                    filePath = selectedPath;
                }
                
                const config = vscode.workspace.getConfiguration('secretStatusBar');
                await config.update('filePath', filePath, vscode.ConfigurationTarget.Workspace);
                await loadAndUpdate();
                vscode.window.showInformationMessage(`文件已选择: ${filePath}`);
            }
        }
    );
    
    // 监听配置变化（包括 JSON 配置文件和 VS Code 设置）
    const configWatcher = vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
        if (e.affectsConfiguration('secretStatusBar')) {
            console.log('[控制栏阅读] 检测到配置变化，重新加载...');
            loadAndUpdate();
        }
    });
    
    // 监听 JSON 配置文件变化
    let configFileWatcher: vscode.FileSystemWatcher | null = null;
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const configFilePattern = new vscode.RelativePattern(
            vscode.workspace.workspaceFolders[0],
            'secret-status-bar.config.json'
        );
        configFileWatcher = vscode.workspace.createFileSystemWatcher(configFilePattern);
        configFileWatcher.onDidChange(() => {
            console.log('配置文件已更改，重新加载...');
            loadAndUpdate();
        });
        configFileWatcher.onDidCreate(() => {
            console.log('配置文件已创建，重新加载...');
            loadAndUpdate();
        });
        configFileWatcher.onDidDelete(() => {
            console.log('配置文件已删除，重新加载...');
            loadAndUpdate();
        });
    }
    
    // 初始加载
    loadAndUpdate();
    
    // 注册所有订阅
    context.subscriptions.push(
        statusBarItem,
        showContentCommand,
        reloadCommand,
        searchCommand,
        configCommand,
        selectFileCommand,
        previousPageCommand,
        nextPageCommand,
        switchFileCommand,
        toggleDisplayCommand,
        showRealContentCommand,
        showDecoyContentCommand,
        toggleDisplayModeCommand,
        configureKeybindingsCommand,
        openSettingsCommand,
        configWatcher
    );
    
    
    // 注册配置文件监听器
    if (configFileWatcher) {
        context.subscriptions.push(configFileWatcher);
    }
    
    // 清理文件监听器
    context.subscriptions.push({
        dispose: () => {
            if (fileWatcher) {
                fileWatcher.dispose();
            }
        }
    });
}

/**
 * 停用函数
 */
export function deactivate() {
    console.log('控制栏阅读 插件已停用');
}

