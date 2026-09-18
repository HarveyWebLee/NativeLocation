# 文档目录

本仓库文档遵循「先分析、确认、落文档，再改代码」。约定见 `.cursor/rules/requirements-first.mdc`。

## 索引

| 类型            | 路径                                                           | 说明                                            |
| --------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| 产品总 FRD      | [functional-requirements.md](./functional-requirements.md)     | MVP 功能、数据、接口、非功能与验收              |
| 独立业务需求    | [requirements/](./requirements/)                               | 每个新的独立需求一份文档                        |
| 架构 / 实现总览 | [implementation-summary.md](./implementation-summary.md)       | 已落地技术选型、目录、联调与预留项              |
| 独立架构决策    | [architecture/](./architecture/)                               | 技术选型与方向调整的决策记录                    |
| 公网内测        | [internal-release.md](./internal-release.md)                   | 本机/公网 IP、无域名、Expo Go 外网内测手册      |
| APK 构建排障    | [apk-build-troubleshooting.md](./apk-build-troubleshooting.md) | 本机 `pnpm apk:build` 已遇问题与解决办法        |
| 生产构建发布    | [deploy.md](./deploy.md)                                       | VPS、Compose 内 Nginx、EAS 构建、上架与验收手册 |
| 隐私政策草稿    | [legal/privacy-policy.md](./legal/privacy-policy.md)           | 上架前需托管为 HTTPS 页面                       |

## 何时写哪份

- **新的独立业务需求**：在 `requirements/` 新建 `<kebab-slug>.md`，并在总 FRD 的「独立需求清单」中增加链接。
- **修改已有业务能力**：先改对应 `requirements/` 文档与总 FRD 相关章节，需求方确认后再改代码。
- **架构方向调整**：先改或新增 `architecture/` 文档，并同步 `implementation-summary.md`。
- **待确认项未关闭**：只提问，不实现。
