# 微念（Wemento）v2.1.13

发布日期：2026-08-09

v2.1.13 修复 v2.1.12 Windows 安装版和便携版启动后窗口空白的问题。修复只调整打包后主进程对 preload 与工作线程入口的定位方式，不改变统一数据目录和已有数据。

## 本次更新

- 修复打包后的主进程位于构建分块目录时，preload 脚本被错误解析到不存在路径、导致界面无法初始化的问题。
- 语音识别与知识库工作线程改为从应用包根目录定位，避免同类分块路径问题。
- 增加打包路径回归测试，覆盖渲染页面、preload、语音识别工作线程和知识库工作线程。
- 保留安装版和解压便携版的 `<程序目录>\data` 数据布局；覆盖升级、普通卸载和本次修复均不会删除已有数据。

## 从 v2.1.12 升级

- 安装版可以先关闭正在运行的 Wemento，再直接运行新安装包覆盖升级。
- 解压便携版请先关闭旧程序，将新版解压到独立目录，然后把旧版整个 `data` 文件夹复制到新程序目录；确认数据和界面正常后再处理旧副本。
- 如果已经按上述方式迁移到统一数据目录，只需保留当前 `<程序目录>\data`，无需重新导入微信数据。
- 微信客户端自己的数据库和媒体文件仍由微信管理，本程序不会移动它们。

## 下载

- Windows x64 安装包：`wemento-2.1.13-setup.exe`
- Windows x64 便携版：`wemento-2.1.13-portable-win-x64.zip`
- 自动更新元数据：`latest.yml` 与安装包 blockmap
- 文件校验：`SHA256SUMS-v2.1.13.txt`

安装包当前未进行商业代码签名，Windows 可能显示 SmartScreen 提示。请只从本仓库的 [GitHub Releases](https://github.com/qiuqiu-2/Wemento/releases) 下载，并核对 Release 页面提供的 SHA-256。

## 分支与来源

- Wemento 稳定发行源码：`personal`
- 上游镜像：`main`
- 上游项目：[Wxw-Gu/WechatExplorer](https://github.com/Wxw-Gu/WechatExplorer)
