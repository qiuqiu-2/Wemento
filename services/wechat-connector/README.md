# Wemento WeChat Connector

This repository-local service provides the minimal WeChat bridge required by Wemento:

- QR-code login with a single persisted credential
- account discovery
- inbound long polling and authenticated webhook delivery
- local HTTP health and send endpoints
- text and local/remote media sending

The executable is managed by the Electron main process. It is not a general-purpose agent runtime and does not load external AI command-line tools.

## Commands

```bash
go run . login --json
go run . accounts --json
go run . start --foreground --api-addr 127.0.0.1:18011 --account-id <account-id>
```

When Wemento launches the connector, credential and synchronization state is stored under `data/connector/accounts` beside the installed application. A standalone connector still defaults to `~/.wechatexplorer/wechat-connector/accounts`; set `WEMENTO_CONNECTOR_ACCOUNTS_DIR` to override it. A successful login is written before the older credential and synchronization state are removed, so an incomplete login cannot destroy the last working credential.

## Attribution

Low-level protocol and media transport portions are distributed under the MIT license in [LICENSE](LICENSE). Wemento-specific process management, webhook contract, product UI, and Agent Hub behavior live in the surrounding Wemento project.
