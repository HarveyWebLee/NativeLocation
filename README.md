# NativeLocation

定位 App monorepo：Expo（手机端）+ NestJS（API）+ PostgreSQL（Prisma）。

## 结构

```text
apps/mobile      Expo SDK 54 / React Native 手机端
apps/api         NestJS API（HTTP + WebSocket）
packages/shared  共享 Zod 契约与类型
packages/tsconfig 共享 TS 配置
docs/            需求、架构与实现文档（见 docs/README.md）
```

文档入口：[docs/README.md](./docs/README.md)。  
生产构建与发布：[docs/deploy.md](./docs/deploy.md)。  
功能需求说明书：[docs/functional-requirements.md](./docs/functional-requirements.md)。  
实现总结：[docs/implementation-summary.md](./docs/implementation-summary.md)。

## 快速开始

```bash
cp .env.example .env

pnpm install
pnpm db:up
pnpm --filter @native-location/shared build
pnpm db:generate
pnpm db:migrate

# 终端 1
pnpm dev:api

# 终端 2
pnpm dev:mobile
```

> Docker 装在 **WSL Ubuntu** 时，用 `pnpm db:up` / `pnpm db:down`（脚本会经 WSL 调用 `docker compose`）。  
> 容器端口映射到 Windows/`localhost` 的 **16875**（`.env` 里 `POSTGRES_PORT`）。NestJS / Prisma 用 `POSTGRES_HOST=127.0.0.1` 与同一端口拼接连接串，不要再手写 `DATABASE_URL`。

## 定位链路

1. App 注册设备 `POST /v1/devices/register`
2. 申请前台定位权限，`watchPosition` 采集经纬度
3. WebSocket `ws://host:18156/v1/location/stream` 实时上报（失败则 HTTP `/v1/location/batch`）
4. NestJS 校验后写入 PostgreSQL

后台定位：已预留权限文案与 `expo-task-manager` 任务占位；申请定位权限时会附带请求后台权限，MVP 默认只跑前台追踪。

## 真机调试

把根目录 `.env` 里的 `EXPO_PUBLIC_API_HOST` 改成电脑局域网 IP（不要用 `10.0.2.2`，那是 Android 模拟器地址）。

## 常用命令

| 命令              | 说明                                                              |
| ----------------- | ----------------------------------------------------------------- |
| `pnpm db:up`      | 启动 PostgreSQL（宿主机 16875）                                   |
| `pnpm dev:api`    | 启动 NestJS                                                       |
| `pnpm dev:mobile` | 启动 Expo（扫码真机 + 自动打开 Web）                              |
| `pnpm db:studio`  | Prisma Studio                                                     |
| `pnpm typecheck`  | 全仓类型检查                                                      |
| `pnpm clean`      | 删除仓库内全部 `node_modules`（占用时先结束 API / Prisma 等进程） |
