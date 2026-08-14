# 前台定位上报与落库（MVP）

| 项       | 内容                                                                                     |
| -------- | ---------------------------------------------------------------------------------------- |
| 文档类型 | 独立业务需求                                                                             |
| 状态     | 已确认                                                                                   |
| 对应实现 | Phase 1 MVP                                                                              |
| 总 FRD   | [../functional-requirements.md](../functional-requirements.md)                           |
| 实现总览 | [../implementation-summary.md](../implementation-summary.md)                             |
| 架构决策 | [../architecture/mvp-technical-decisions.md](../architecture/mvp-technical-decisions.md) |

## 背景与目标

需要可安装到 iOS / Android 的定位能力：手机端在前台采集位置，服务端校验后写入 PostgreSQL，便于后续对接业务或外部云。

成功标准：

- 真机可完成：注册设备 → 授权 → 开始追踪 → 服务端入库可见。
- 短时断网后可通过 HTTP 批量补传。
- 前后端共用同一套位置数据契约。

## 范围

### 本期（In Scope）

对应总 FRD `S-01`～`S-07`：设备注册与本地 `deviceId`、前台权限与持续采集、WS 实时上报 + HTTP 兜底、服务端校验落库、健康检查、后台权限与 Task **预留**（不默认开启追踪）。

功能明细见总 FRD 第 4～6 章（`FR-DEV-*`、`FR-LOC-01`～`04`、`FR-UP-*`、`FR-API-01`～`04`、`FR-CFG-01`）。

### 明确不做

对应总 FRD `O-01`～`O-07`：完整后台持续上报、外部云转发、账号体系、地图/轨迹 UI、管理后台、Redis 多实例、电子围栏等。后台持续上报见 `FR-LOC-06`（P2）。

## 已决（原待确认项）

| 项         | 结论                                         |
| ---------- | -------------------------------------------- |
| 端形态     | 手机 App（Expo），不用 Electron              |
| 上报主路径 | WebSocket，HTTP 批量兜底                     |
| 存储       | PostgreSQL + Prisma；MVP 无对外查询 HTTP API |
| 后台定位   | 仅预留权限与 Task，不默认追踪                |
| 鉴权       | MVP 内网/开发环境可不做；生产后续            |

## 验收标准

以总 FRD 第 11 章清单为准。
