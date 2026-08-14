# 生产发布技术决策

| 项       | 内容                                                                           |
| -------- | ------------------------------------------------------------------------------ |
| 文档类型 | 独立架构决策                                                                   |
| 状态     | 已确认                                                                         |
| 业务需求 | [../requirements/production-release.md](../requirements/production-release.md) |
| 实现总览 | [../implementation-summary.md](../implementation-summary.md)                   |

## 背景与目标

MVP 使用明文 HTTP/WS、开放 CORS、无鉴权、仅 Expo Go。生产需在自有 VPS 上对外服务，并构建可上架的原生包。

## 决策

1. **TLS 在 Nginx（或同类反向代理）终止**，Nest 仍监听容器内 HTTP。对外只有 443。
2. **静态 API Key**：环境变量 `API_KEY`；HTTP 头 `X-Api-Key`；WS 连接 `...?apiKey=`。开发未设 Key 时放行；`NODE_ENV=production` 且无 Key 则进程退出。
3. **健康检查免鉴权**，供反向代理与探活。
4. **CORS**：生产按 `CORS_ORIGIN` 白名单（原生 App 不走 CORS）；未配置则生产关闭浏览器跨域。
5. **数据**：继续 PostgreSQL；生产库端口不映射到公网；启动时 `prisma migrate deploy`。
6. **客户端**：EAS Build；生产环境变量在构建时打入 `EXPO_PUBLIC_*`。
7. **审核**：生产包关闭未使用的后台定位声明（`UIBackgroundModes` / `ACCESS_BACKGROUND_LOCATION`）。
8. **密钥**：不入库；`.env.production` gitignore。
9. **本地只维护仓库根目录 `.env`。** Prisma / Nest / Expo 启动时加载该文件；已存在的环境变量不覆盖。生产 API 由 Compose 注入 `.env.production`，镜像不包含 `.env`；独立包由 EAS 注入 `EXPO_PUBLIC_*`，不读开发机 `.env`。

## 影响面

| 面     | 影响                                               |
| ------ | -------------------------------------------------- |
| api    | Guard、启动校验、Docker、CORS                      |
| mobile | 请求带头、WS 带 query、eas.json、app.json 权限收敛 |
| shared | `API_KEY_HEADER` 常量                              |
| 数据   | 无 schema 变更；部署用 migrate deploy              |

## 备选方案

| 决策点 | 未采用        | 原因                     |
| ------ | ------------- | ------------------------ |
| 鉴权   | 用户登录      | 超出本期                 |
| TLS    | Node 直接证书 | 与运维习惯不符，续期麻烦 |
| 构建   | 仅本地 Gradle | 双端统一用 EAS           |

## 范围

- **做：** 上表决策与仓库内部署/构建文件。
- **不做：** 云厂商绑定、代上架、后台持续定位。

## 已决

见「决策」。域名、证书、商店账号由运维在 VPS / EAS 填写。

## 操作手册

逐步构建、部署与上架见 [../deploy.md](../deploy.md)。

## 验收标准

见 [生产需求](../requirements/production-release.md) 验收标准。
