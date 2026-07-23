import { copyFileSync, mkdirSync, existsSync, cpSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'portable');

// 清理旧目录
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });

// 创建输出目录结构
mkdirSync(join(outDir, 'electron'), { recursive: true });
mkdirSync(join(outDir, 'dist'), { recursive: true });

// 1. 复制 Electron 运行时（完整复制，不遗漏任何 DLL）
cpSync(join(__dirname, 'node_modules', 'electron', 'dist'), join(outDir, 'electron-runtime'), { recursive: true });

// 2. 复制 dist 目录（前端构建产物）
cpSync(join(__dirname, 'dist'), join(outDir, 'dist'), { recursive: true });

// 3. 复制 public 资源
cpSync(join(__dirname, 'public'), join(outDir, 'public'), { recursive: true });

// 4. 复制主进程和预加载脚本
copyFileSync(join(__dirname, 'electron', 'main.cjs'), join(outDir, 'electron', 'main.cjs'));
copyFileSync(join(__dirname, 'electron', 'preload.cjs'), join(outDir, 'electron', 'preload.cjs'));

// 5. 创建便携版专用 package.json（去掉 type:module，避免 Electron 兼容问题）
const portablePkg = {
  name: "org-chart-canvas",
  version: "1.0.0",
  main: "electron/main.cjs",
  description: "组织架构画布",
  author: "org-chart"
};
writeFileSync(join(outDir, 'package.json'), JSON.stringify(portablePkg, null, 2), 'utf-8');

// 6. 创建健壮的启动脚本
const batContent = `@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

REM 检查 electron.exe 是否存在
if not exist "electron-runtime\\electron.exe" (
    echo [错误] 找不到 electron-runtime\\electron.exe
    echo 请确保完整复制了整个文件夹
    pause
    exit /b 1
)

REM 检查 dist/index.html 是否存在
if not exist "dist\\index.html" (
    echo [错误] 找不到 dist\\index.html
    echo 请确保完整复制了整个文件夹
    pause
    exit /b 1
)

REM 启动应用
start "" "electron-runtime\\electron.exe" "electron\\main.cjs"

REM 如果启动失败，显示错误
if %errorlevel% neq 0 (
    echo [错误] 应用启动失败，错误代码: %errorlevel%
    echo 可能缺少 Visual C++ 运行库，请安装 vcredist_x64.exe
    pause
)
`;
writeFileSync(join(outDir, '双击启动.bat'), batContent, 'utf-8');

// 7. 创建使用说明
const readme = `组织架构画布 - 便携版
========================

使用方法：
1. 双击 "双击启动.bat" 即可运行
2. 无需安装任何其他软件

如遇无法启动：
- Windows 7/8 用户需安装 Visual C++ 2015-2022 运行库
- 下载地址: https://aka.ms/vs/17/release/vc_redist.x64.exe
- 确保整个文件夹完整复制，不要遗漏任何文件

数据保存：
- 编辑内容自动保存（1分钟间隔）
- 可手动点击"保存"按钮
- 可导出为 JSON 文件备份

版本: V8.3
`;
writeFileSync(join(outDir, '使用说明.txt'), readme, 'utf-8');

console.log('✅ 便携版已重新生成到:', outDir);
console.log('   文件结构:');
console.log('   ├── 双击启动.bat        (启动入口)');
console.log('   ├── 使用说明.txt        (使用帮助)');
console.log('   ├── package.json        (配置)');
console.log('   ├── electron/           (主进程)');
console.log('   ├── dist/               (前端页面)');
console.log('   ├── public/             (资源)');
console.log('   └── electron-runtime/   (Electron运行时)');
