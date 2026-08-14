# 独立架构决策

架构方向的新增或调整，先在本目录落文档（或更新已有决策），并同步 [../implementation-summary.md](../implementation-summary.md)，确认后再改代码。

当前登记：

| 文档                                                       | 状态   | 说明                                               |
| ---------------------------------------------------------- | ------ | -------------------------------------------------- |
| [mvp-technical-decisions.md](./mvp-technical-decisions.md) | 已确认 | MVP 技术选型与关键决策                             |
| [tamagui-ui.md](./tamagui-ui.md)                           | 已确认 | 手机端 UI 采用 Tamagui，以官方 llms.txt 为开发依据 |
| [production-release.md](./production-release.md)           | 已确认 | 生产 TLS、API Key、EAS 与 VPS 部署                 |

## 新文档必备章节

1. 背景与目标
2. 决策
3. 影响面（`api` / `mobile` / `shared` / 数据）
4. 备选方案
5. 范围（含明确不做，若有）
6. 待确认项（确认后删除或改为已决）
7. 验收标准（如何判断落地符合决策）
