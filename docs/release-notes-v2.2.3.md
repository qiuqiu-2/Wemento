# 微念（Wemento）v2.2.3

发布日期：2026-08-23

v2.2.3 是继 v2.1.13 之后的一次较大功能同步，合入上游截至 `3a6d4b9` 的改进，并继续保留 Wemento 的品牌、Windows 安装兼容性、程序目录 `data` 数据布局和 Reader Skill 支持。

仓库已包含上游的 `v2.2.0`～`v2.2.2` 标签，因此本次 Wemento 发行使用下一个未占用版本号 `v2.2.3`，避免标签指向错误的上游提交。

## 本次更新

### 聊天读取与导出

- 支持选择自定义导出目录，并让导出路径摘要与实际选择保持一致。
- 按时间范围查询聊天记录，避免不必要地全量扫描历史消息。
- 完善跨分片消息查询，并增加相应的回归验证。
- 支持按导出媒体文件名精确搜索。
- 完善全部聊天分目录导出，以及日报相关语音转写流程。

### 日报、语音与 AI

- 增加新的群聊日报模板，并修复群成员名称显示问题。
- 加速语音转写缓存命中，修复语音文件缺失的误报。
- 改进 AI 模型配置页面，修复循环更新问题并补充模型跳转等操作。
- 保留答案来源追溯、本地知识库、微信机器人和外部 Agent 查询能力。

### 实验性微信分享卡片

- 增加群聊日报微信分享卡片能力。
- 增加面向 Cloudflare Worker 与 R2 的自动部署 Skill。
- 该能力仍为实验性功能，需要用户自备 Cloudflare、域名和微信测试号。

### Wemento 兼容性与文档

- 更早初始化 Windows 的 `userData`、`sessionData` 与相关应用数据路径，避免 Electron 默认路径在 `%APPDATA%` 下创建不需要的数据目录。
- 保持安装版、解压便携版和单文件 Portable EXE 使用 `<程序目录>\data`；普通升级和卸载不会主动删除该目录。
- 保留 Wemento 品牌、安装器行为、Reader Skill 和现有数据迁移兼容性。
- 按上游新版结构更新 README，并移除群二维码、加群等社交引流说明。

## 从 v2.1.13 升级

- 安装版：先关闭正在运行的 Wemento，再运行新版安装包覆盖升级。
- 解压便携版：先关闭旧程序，把新版解压到独立目录，再将旧版整个 `data` 文件夹复制到新程序目录。
- 升级前建议备份现有 `data` 文件夹；确认新版数据、设置和聊天连接正常后，再处理旧副本。
- 微信客户端自己的数据库和媒体文件仍由微信管理，Wemento 不会移动它们。

## 下载

- Windows x64 安装包：`wemento-2.2.3-setup.exe`
- Windows x64 便携版：`wemento-2.2.3-portable-win-x64.zip`
- 自动更新元数据：`latest.yml` 与 `wemento-2.2.3-setup.exe.blockmap`
- 文件校验：`SHA256SUMS-v2.2.3.txt`

安装包当前未进行商业代码签名，Windows 可能显示 SmartScreen 提示。请只从本仓库的 [GitHub Releases](https://github.com/qiuqiu-2/Wemento/releases) 下载，并核对 Release 页面提供的 SHA-256。

## 分支与来源

- Wemento 稳定发行源码：`personal`
- 上游镜像：`main`
- 本次同步的上游提交：`3a6d4b9`
- 上游项目：[Wxw-Gu/WechatExplorer](https://github.com/Wxw-Gu/WechatExplorer)
- 完整变更：[v2.1.13...v2.2.3](https://github.com/qiuqiu-2/Wemento/compare/v2.1.13...v2.2.3)
