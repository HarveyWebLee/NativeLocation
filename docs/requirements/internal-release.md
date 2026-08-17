# 公网内测发布

| 项       | 内容                                                                            |
| -------- | ------------------------------------------------------------------------------- |
| 文档类型 | 独立业务需求                                                                    |
| 状态     | 已确认                                                                          |
| 总 FRD   | [../functional-requirements.md](../functional-requirements.md)                  |
| 操作手册 | [../internal-release.md](../internal-release.md)                                |
| 生产发布 | [production-release.md](./production-release.md)（正式 HTTPS / 商店包，另文档） |
| 编排复用 | [../docker-compose.prod.yml](../../docker-compose.prod.yml)（不起 nginx）       |

## 背景与目标

在**尚未购买正式域名**的阶段，用一台**已允许公网访问**的本机或服务器，通过 **Docker Compose** 部署后端与 Mobile Web，并在真机外网完成定位上报内测。

与纯局域网 `pnpm dev:*` 联调、与生产上架分流：内测验证公网可达与业务链路；生产见 [production-release.md](./production-release.md) 与 [../deploy.md](../deploy.md)。

## 范围

### 本期（In Scope）

- 复用 `docker-compose.prod.yml`，内测启动 **postgres + api + web**（**不起 nginx**；无域名/证书时不要起 nginx）。
- 环境文件使用 **`.env.production`**（由 `.env.production.example` 复制）。
- Postgres 宿主机端口仅绑 **`127.0.0.1:${POSTGRES_PORT}`**（默认 16875），不对公网暴露。
- API 对外：`0.0.0.0:18156`（HTTP / WS）；Mobile Web 对外：`0.0.0.0:${WEB_PORT:-18202}`（静态站）。
- 客户端：
  - **iOS**：Expo Go（SDK 54），API 指向公网 `http://<公网IP>:18156`。
  - **Android**：可用 EAS **preview APK**（明文 HTTP 时自动允许 cleartext）；也可用 Expo Go。
  - **浏览器**：访问 Compose 中的 Mobile Web（定位能力弱于原生，作辅助预览）。
- 公网暴露时配置成对 `API_KEY` 与 `EXPO_PUBLIC_API_KEY`；Web 构建需写入 `EXPO_PUBLIC_API_HTTP_URL` / `EXPO_PUBLIC_API_WS_URL`；浏览器访问 API 时配置 `CORS_ORIGIN`。
- 防火墙仅放行 **18156**、**18202**（及后续生产才用的 18200/18201）。

### 明确不做

- 内测阶段不要求正式域名 / Let's Encrypt / 启动 nginx。
- 不把 Metro / Expo Go 打进 Compose；iOS 内测仍用本机或开发机起 Expo Go。
- 不上架、不托管隐私政策 HTTPS（留给生产发布）。

## 已决

| 项            | 结论                                                       |
| ------------- | ---------------------------------------------------------- |
| 编排文件      | 复用 `docker-compose.prod.yml`；内测 `up postgres api web` |
| 环境文件      | `.env.production`                                          |
| Postgres 映射 | 仅 `127.0.0.1:${POSTGRES_PORT}:5432`                       |
| 服务组成      | postgres + api + mobile web；nginx 仅生产 HTTPS 阶段       |
| 对外协议      | API：`http://<公网IP>:18156`；Web：`http://<公网IP>:18202` |
| iOS           | Expo Go                                                    |
| Android       | 允许 EAS preview APK（`http://` API 时启用 cleartext）     |
| 鉴权          | 必须设 `API_KEY`；客户端 / Web 构建注入相同 Key            |
| 验收网络      | 真机用蜂窝网络（或非本机局域网）访问                       |

## 验收标准

- `docker compose ... ps` 中 postgres、api、web 为 running。
- 外网可访问 `http://<公网IP>:18156/health` 与 `http://<公网IP>:18202/`。
- 本机以外无法直接连 `POSTGRES_PORT`（仅 127.0.0.1）。
- iOS Expo Go 或 Android preview APK：注册设备 → 授权定位 → 开启追踪 → 入库可见。
- 无 Key 的业务接口 401；带正确 Key 可注册与上报。

## 操作手册

逐步步骤见 [../internal-release.md](../internal-release.md)。
