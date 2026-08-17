# NativeLocation 实现总结

本文档总结当前 monorepo 已落地的架构与能力（MVP）。

| 关联         | 路径                                                                                                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 文档目录     | [README.md](./README.md)                                                                                                                                                         |
| 产品总 FRD   | [functional-requirements.md](./functional-requirements.md)                                                                                                                       |
| MVP 业务需求 | [requirements/mvp-foreground-location.md](./requirements/mvp-foreground-location.md)                                                                                             |
| MVP 架构决策 | [architecture/mvp-technical-decisions.md](./architecture/mvp-technical-decisions.md)                                                                                             |
| 公网内测     | [requirements/internal-release.md](./requirements/internal-release.md)、[internal-release.md](./internal-release.md)                                                             |
| 生产发布     | [requirements/production-release.md](./requirements/production-release.md)、[architecture/production-release.md](./architecture/production-release.md)、[deploy.md](./deploy.md) |

## 1. 目标

开发一款可安装到手机的定位 App：

- 申请定位权限
- 前台实时采集经纬度
- 上报到本仓库 NestJS 后端
- 持久化到 PostgreSQL

外部云转发、完整后台定位追踪列为后续扩展（已预留接口/入口）。

## 2. 技术选型

| 层级      | 选型                                | 说明                                                          |
| --------- | ----------------------------------- | ------------------------------------------------------------- |
| Monorepo  | pnpm workspaces + Turborepo         | 统一依赖与任务编排                                            |
| 手机端    | Expo **SDK 54** + React Native 0.81 | 对齐当前 Expo Go（SDK 54）                                    |
| 后端      | NestJS 11                           | HTTP + 原生 WebSocket                                         |
| ORM       | Prisma 6                            | PostgreSQL                                                    |
| 数据库    | PostgreSQL 16（Docker）             | 宿主机端口 **16875**                                          |
| 校验契约  | Zod（`packages/shared`）            | 前后端共用                                                    |
| Redis     | 不上                                | MVP 单实例足够，后续再加                                      |
| 手机端 UI | Tamagui（Config v5）                | 见 [architecture/tamagui-ui.md](./architecture/tamagui-ui.md) |

## 3. 目录结构

```text
NativeLocation/
├── apps/
│   ├── mobile/          # Expo 手机端
│   └── api/             # NestJS API
├── packages/
│   ├── shared/          # LocationPoint / Device 等 Zod 契约
│   └── tsconfig/        # 共享 TS 配置
├── scripts/
│   └── wsl-compose.mjs  # Windows 经 WSL 调用 docker compose
├── docker-compose.yml
├── docs/
│   ├── functional-requirements.md
│   ├── implementation-summary.md
│   ├── requirements/            # 独立业务需求
│   └── architecture/            # 独立架构决策
└── README.md
```

## 4. 定位上报链路（已打通）

```text
手机 App
  → 申请前台定位权限
  → expo-location watchPosition
  → WebSocket 实时上报（断线则 HTTP 批量补传）
  → NestJS 校验（Zod）
  → Prisma 写入 PostgreSQL
```

### 4.1 手机端（`apps/mobile`）

| 模块                         | 职责                                     |
| ---------------------------- | ---------------------------------------- |
| `src/device.ts`              | 注册设备，本地持久化 `deviceId`          |
| `src/location/tracker.ts`    | 前台权限、watch、节流上报                |
| `src/location/background.ts` | 后台 Task 预留（未默认启用）             |
| `src/realtime/uploader.ts`   | WS 主路径 + HTTP 兜底 + 本地队列         |
| `App.tsx`                    | Tamagui 主界面：权限、开启定位、采集频率 |

配置要点：

- Metro 端口：**8881**（`expo start --web --port 8881`，同时开浏览器预览）
- Metro 版本：根 `package.json` 的 `pnpm.overrides` 将 Metro 全家桶锁定为 **0.83.3**（与 Expo SDK 54 / `@expo/metro` 一致），避免 pnpm hoist 混入 RN 的 0.83.7 导致 `addedFiles` 崩溃
- Web 预览请用 **Chrome / Edge** 打开 `http://localhost:8881`；Cursor / VS Code Simple Browser（`vscode-file://`）会被 Expo 拒绝
- API 地址：`EXPO_PUBLIC_API_HOST` / `EXPO_PUBLIC_API_PORT`
- 同 Wi‑Fi 真机：电脑局域网 IP（如 `192.168.15.92`）
- 外网内测（本机已有公网 IP）：填公网 IP，并配置成对 `API_KEY` / `EXPO_PUBLIC_API_KEY`，步骤见 [internal-release.md](./internal-release.md)
- Android 模拟器可用 `10.0.2.2`

### 4.2 后端（`apps/api`）

| 接口                        | 说明                                    |
| --------------------------- | --------------------------------------- |
| `GET /health`               | 健康检查                                |
| `POST /v1/devices/register` | 设备注册 / upsert                       |
| `POST /v1/location/point`   | 单点上报                                |
| `POST /v1/location/batch`   | 批量补传                                |
| `WS /v1/location/stream`    | 实时上报（每帧一个 LocationPoint JSON） |

数据落库表：

- `Device`：设备标识、平台、展示名
- `LocationPoint`：WGS84 经纬度、精度、速度、航向、`recordedAt`、`source`

索引：`(deviceId, recordedAt DESC)` 便于按设备查轨迹。

### 4.3 共享契约（`packages/shared`）

- `locationPointSchema` / `locationBatchSchema` / `deviceRegisterSchema`
- `API_PATHS` 路径常量
- 前后端同一套类型，避免漂移

## 5. 基础设施

### 5.1 PostgreSQL（Docker in WSL）

本机 Docker 装在 **WSL Ubuntu**，不在 Windows PATH。因此：

```bash
pnpm db:up      # → scripts/wsl-compose.mjs → wsl docker compose up -d
pnpm db:down
pnpm db:logs
```

- 容器端口：`${POSTGRES_PORT:-16875}:5432`
- Windows 侧 NestJS / Prisma 连接：`POSTGRES_HOST=127.0.0.1` 与同一 `POSTGRES_PORT`（避免 `localhost` IPv6 解析问题）
- `pnpm dev:api` 会锁住 `query_engine-windows.dll.node`。`typecheck` / `precommit` 触发的 `prisma generate` 在 schema 未变时会跳过，不必先停 API；**改了 schema 后仍需停掉 API 再 generate**（引擎二进制必须替换，且进程里的 Client 也已过期）。

### 5.2 环境变量

本地只维护**仓库根目录** `.env`（从 `.env.example` 复制）。不要再创建 `apps/api/.env` 或 `apps/mobile/.env`。

| 场景         | 来源                                                                      |
| ------------ | ------------------------------------------------------------------------- |
| 本地开发     | 根目录 `.env`（Nest、Prisma CLI、Expo、`pnpm db:up`）                     |
| VPS 生产 API | `.env.production` 由 Docker Compose 注入容器；镜像内**没有**开发用 `.env` |
| EAS 独立包   | Expo 控制台的 `EXPO_PUBLIC_*`，构建时打进包内                             |

加载时不覆盖已存在的 `process.env`，因此生产注入始终优先。

数据库相关只配置 `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_HOST` / `POSTGRES_PORT`。不要写 `DATABASE_URL`；Nest 启动与 Prisma CLI 会在进程内拼接，供 Prisma `env("DATABASE_URL")` 读取。生产 `.env.production` 的 `POSTGRES_PORT`（默认 16875）只用于宿主机映射 `0.0.0.0:${POSTGRES_PORT}:5432`；API 容器由 Compose 注入 `POSTGRES_HOST=postgres`、`POSTGRES_PORT=5432`（连 Docker 内网，不是宿主机端口）。

## 6. 本地联调流程

```bash
pnpm install
pnpm db:up
pnpm --filter @native-location/shared build
pnpm db:generate
pnpm db:migrate

# 终端 1
pnpm dev:api

# 终端 2（不要经 turbo 包一层，否则可能不出二维码）
pnpm dev:mobile
```

`pnpm dev:mobile` 会启动 Metro、自动打开浏览器（Web 预览布局），终端仍显示二维码供真机 Expo Go 连接。

真机（iOS Expo Go）：

1. 手机与电脑同一 Wi‑Fi
2. 用系统 **相机**扫终端二维码（新版 Expo Go 首页无扫码入口）
3. 或 Safari 打开：`exp://<电脑局域网IP>:8881`
4. App 内点「开启定位」，允许权限
5. 用 `pnpm db:studio` 或查 `LocationPoint` 表验证入库

> 手机 Expo Go 需与项目 **Expo SDK 54** 一致。

## 7. 已预留、尚未实现

| 项                         | 状态                                                               |
| -------------------------- | ------------------------------------------------------------------ |
| 后台持续定位上报           | 权限文案与 Task 占位已预留；申请权限时附带后台权限，不默认启动追踪 |
| 外部云转发 Adapter         | 未做，数据先落库                                                   |
| Redis 限流 / 多实例 PubSub | MVP 不上                                                           |
| 账号体系 / 地图轨迹回放    | 未做                                                               |

## 8. 生产构建与发布

操作步骤（VPS、Compose 内 Nginx 与证书卷、EAS、商店材料、验收与排障）见 [deploy.md](./deploy.md)。决策见 [architecture/production-release.md](./architecture/production-release.md)。

## 9. 关键决策回顾

完整决策、影响面与备选方案见：[architecture/mvp-technical-decisions.md](./architecture/mvp-technical-decisions.md)、[architecture/tamagui-ui.md](./architecture/tamagui-ui.md)。

1. **不用 Electron**：无法做 iOS/Android 正式手机端。
2. **用 Expo 而非裸 RN CLI**：权限与调试更顺；当前用 SDK 54 对齐 Expo Go。
3. **实时上报用 WebSocket + HTTP 兜底**：低延迟，断网可补传。
4. **Prisma + PostgreSQL**：定位时序数据够用，后续可加 PostGIS。
5. **`dev:mobile` 直连 Expo**：避免 Turbo 吞掉交互终端导致无二维码。
