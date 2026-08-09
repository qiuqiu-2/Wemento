# 微念（Wemento）v2.1.11

发布日期：2026-08-09

v2.1.11 将 Windows 应用自身产生的可控数据统一到程序目录下的 `data`，并为已有 WechatExplorer/Wemento 数据提供保守迁移。微信客户端自己的数据库和媒体文件仍由微信管理，不会被移动。

## 本次更新

- 安装版、解压便携版和单文件 Portable EXE 统一使用 `<程序目录>\data`。
- 设置、加密密钥、Token、Chromium 会话、日志、缓存、知识索引、离线语音模型、导出、日报、表情、机器人连接器凭据和更新缓存不再分散写入多个默认目录。
- 首次运行会从 `%APPDATA%\WechatExplorer`、旧 Wemento 用户数据、文档导出/日报/表情目录、连接器账号目录和旧更新缓存复制缺失文件；不覆盖新目录中的同名文件，也不自动删除旧副本。
- 导出默认写入 `data\exports`，生成的日报写入 `data\reports\generated`。
- Electron 临时文件、崩溃转储和应用日志分别写入 `data\temp`、`data\crash-dumps` 和 `data\logs`。
- 自动更新下载保存在 `data\updates`；真正执行安装时只在系统临时目录短暂暂存安装器，避免升级过程中锁住自身数据目录。
- 更新和普通卸载会保留 `data`；只有显式使用 `--delete-app-data` 才删除应用数据。
- 安装目录包含底层 WCDB 不能处理的非 ASCII 字符时，原生路径桥仍可能回退到 `C:\Users\Public\Wemento\path-bridges`。

## 从旧便携版迁移

1. 关闭旧版 WechatExplorer/Wemento。
2. 将新版便携 ZIP 解压到一个独立目录，不要直接覆盖旧程序目录。
3. 首次启动后等待旧数据复制完成；数据较多时，窗口可能稍晚出现。
4. 确认设置、数据库连接、模型、知识库和导出正常后，再决定是否清理旧目录。
5. 迁移后不要交替运行新旧版本，否则两套数据会分别继续变化。

同一 Windows 用户下迁移时，Electron `safeStorage` 加密的密钥可以继续使用；跨 Windows 用户或跨电脑复制并不保证能够解密。

## 下载

- Windows x64 安装包：`wemento-2.1.11-setup.exe`
- Windows x64 便携版：`wemento-2.1.11-portable-win-x64.zip`
- 自动更新元数据：`latest.yml` 与安装包 blockmap

安装包当前未进行商业代码签名，Windows 可能显示 SmartScreen 提示。请只从本仓库的 [GitHub Releases](https://github.com/qiuqiu-2/Wemento/releases) 下载，并核对 Release 页面提供的 SHA-256。

## 分支与来源

- Wemento 稳定发行源码：`personal`
- 上游镜像：`main`
- 上游项目：[Wxw-Gu/WechatExplorer](https://github.com/Wxw-Gu/WechatExplorer)
