# 微念（Wemento）v2.1.10

发布日期：2026-08-08

v2.1.10 是首个以“微念（Wemento）”名称发布的版本。Wemento 是基于上游 [WechatExplorer](https://github.com/Wxw-Gu/WechatExplorer) 的个人维护发行版，继续坚持本地优先的微信聊天记录查看、搜索、整理、AI 问答与导出体验。

## 本次更新

- 将应用、安装器、README、帮助入口和 GitHub 发布地址统一为 Wemento 品牌；
- 增加“微念（Wemento）”名称含义、项目关系、分支职责和版本发布说明；
- 修复部分 Windows 环境下启动安装器或执行安装时在 NSIS `System.dll` 中发生 `0xC0000005` 崩溃的问题；
- 改用安全的进程检测，安装器不再自动结束所有名为 `electron.exe` 的程序；
- 保留 WCDB 所需的 `electron.exe` 主程序名以及已有应用标识、Reader Skill 路径和 `WECHATEXPLORER_API_TOKEN`，避免破坏现有兼容性。

## 下载

- Windows x64：`wemento-2.1.10-setup.exe`
- 自动更新元数据：`latest.yml`
- Windows 安装包 SHA-256：`A700C3B8A5EE4883A21C6E790453F35D6742EF850EC744469FAF83C9D7801F90`

安装包当前未进行商业代码签名，Windows 可能显示 SmartScreen 提示。请只从本仓库的 [GitHub Releases](https://github.com/qiuqiu-2/Wemento/releases) 下载，并在需要时核对 Release 页面提供的 SHA-256。

## 分支与来源

- Wemento 稳定发行源码：`personal`
- 上游镜像：`main`
- 上游项目：[Wxw-Gu/WechatExplorer](https://github.com/Wxw-Gu/WechatExplorer)
