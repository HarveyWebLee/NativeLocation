# MVP 技术选型与关键决策

| 项       | 内容                                                                                     |
| -------- | ---------------------------------------------------------------------------------------- |
| 文档类型 | 独立架构决策                                                                             |
| 状态     | 已确认                                                                                   |
| 对应实现 | Phase 1 MVP                                                                              |
| 实现总览 | [../implementation-summary.md](../implementation-summary.md)                             |
| 业务需求 | [../requirements/mvp-foreground-location.md](../requirements/mvp-foreground-location.md) |

## 背景与目标

在可安装的 iOS / Android 客户端上采集前台位置，经本仓库后端校验后落入 PostgreSQL；本地可联调（含 Windows + WSL Docker）。为后台定位与外部云转发预留扩展点，避免推倒重来。

## 决策

1. **客户端用 Expo SDK 54，不用 Electron、不用裸 React Native CLI。** Electron 无法作为正式 iOS/Android 端；Expo 便于权限与真机调试，并与当前 Expo Go 的 SDK 对齐。
2. **上报主路径 WebSocket，HTTP 批量兜底。** 前台低延迟；断线可补传，不把实时通道做成唯一路径。
3. **Prisma + PostgreSQL。** 定位时序点足够用；后续可加 PostGIS。连接使用 `127.0.0.1` 与宿主机端口 **16875**，避免 Windows 上 `localhost` 走 IPv6。
4. **MVP 不上 Redis。** 单实例足够；限流与多实例 PubSub 留到后续。
5. **契约集中在 `packages/shared`（Zod）。** HTTP 与 WS 共用同一套 LocationPoint / Device 校验，避免前后端漂移。
6. **`pnpm dev:mobile` 直连 Expo。** 不经 Turbo 包一层，避免交互终端被吞掉导致无二维码。
7. **后台定位仅预留。** 权限文案与 Task 占位存在；申请前台权限时附带请求后台权限，默认不启动后台持续上报。

## 影响面

| 面     | 影响                                                                              |
| ------ | --------------------------------------------------------------------------------- |
| mobile | Expo SDK 54、`expo-location`、前台 watch、WS/HTTP uploader、Metro **8881**        |
| api    | NestJS HTTP + 原生 WebSocket、Prisma 写入 `Device` / `LocationPoint`              |
| shared | `locationPointSchema`、`locationBatchSchema`、`deviceRegisterSchema`、`API_PATHS` |
| 数据   | PostgreSQL 16（Docker）；索引 `(deviceId, recordedAt DESC)`                       |

## 备选方案

| 决策点   | 未采用              | 原因                        |
| -------- | ------------------- | --------------------------- |
| 客户端   | Electron            | 不能作为正式手机端          |
| 客户端   | 裸 RN CLI           | 权限与 Expo Go 联调成本更高 |
| 实时通道 | 仅 HTTP 轮询        | 延迟与耗电更差              |
| 实时通道 | 仅 WebSocket        | 断网无法补传                |
| 存储     | 仅端侧文件 / SQLite | 无法作为服务端轨迹源        |
| 缓存     | MVP 上 Redis        | 单实例无刚需                |

## 范围

- **做：** 上表决策在 MVP 中落地；实现细节见实现总览。
- **不做：** Redis、多实例、完整后台追踪、外部云 Adapter、账号鉴权（生产方案后续单独立项）。

## 已决

见「决策」；无未关闭待确认项。

## 验收标准

- 真机 Expo Go（SDK 54）可扫码进入 App，前台上报能入库。
- WS 不可用时 HTTP `/v1/location/batch` 仍可入库。
- `packages/shared` 为前后端校验唯一来源。
- 未默认启动后台持续定位。
