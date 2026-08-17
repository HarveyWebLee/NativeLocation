# 公网内测发布

| 项       | 内容                                                                            |
| -------- | ------------------------------------------------------------------------------- |
| 文档类型 | 独立业务需求                                                                    |
| 状态     | 已确认                                                                          |
| 总 FRD   | [../functional-requirements.md](../functional-requirements.md)                  |
| 操作手册 | [../internal-release.md](../internal-release.md)                                |
| 生产发布 | [production-release.md](./production-release.md)（正式 HTTPS / 商店包，另文档） |

## 背景与目标

在**尚未购买正式域名、尚未走 VPS 生产 Compose** 的阶段，用一台**已允许公网访问**的本机或服务器，让真机在**外网（建议蜂窝网络）**完成定位上报内测。

与局域网联调、与生产上架分流：内测先验证公网可达与业务链路；生产见 [production-release.md](./production-release.md) 与 [../deploy.md](../deploy.md)。

## 范围

### 本期（In Scope）

- 本机开发栈对外：`pnpm db:up` + `pnpm dev:api`，API 监听 `0.0.0.0:18156`（HTTP / WS）。
- 客户端用根目录 `.env` 的 `EXPO_PUBLIC_API_HOST` / `EXPO_PUBLIC_API_PORT`（及可选 `EXPO_PUBLIC_API_KEY`），优先 **Expo Go** 真机内测。
- 公网暴露 API 时配置成对 `API_KEY` 与 `EXPO_PUBLIC_API_KEY`。
- 防火墙 / 安全组仅放行 API 端口；**不**将 PostgreSQL 宿主机端口对公网开放。
- 文档说明与正式生产（域名、TLS、`docker-compose.prod.yml`、EAS preview/production）的边界。

### 明确不做

- 不要求购买域名或申请 Let's Encrypt（内测可选免费 DDNS + HTTPS，见操作手册）。
- 不以 EAS preview/production 明文 IP 包作为默认内测路径（系统常拦 cleartext）。
- 不代配置路由器端口映射或云厂商安全组。
- 不上架、不托管隐私政策 HTTPS（留给生产发布）。

## 已决

| 项         | 结论                                                                |
| ---------- | ------------------------------------------------------------------- |
| 托管形态   | 本机或已有公网 IP 的服务器；不强制 VPS + 生产 Compose               |
| 对外协议   | 内测默认 `http://<公网IP>:18156` / `ws://...`（开发栈）             |
| 客户端形态 | 优先 Expo Go；地址写在根目录 `.env`，改后需重启 API 与 Metro        |
| 鉴权       | 公网暴露时必须设 `API_KEY`；客户端 `EXPO_PUBLIC_API_KEY` 与之相同   |
| 验收网络   | 真机用蜂窝网络（或非本机所在局域网）访问，避免误当成内网联调        |
| 升级路径   | 需要独立包或商店包时，再走生产文档（域名/免费主机名 + HTTPS + EAS） |

## 验收标准

- 外网机器可访问 `http://<公网IP>:18156/health` 且返回健康 JSON。
- 蜂窝网络下 Expo Go 可完成：注册设备 → 授权定位 → 开启追踪 → 服务端入库可见。
- 已配置 `API_KEY` 时：无 Key 的业务接口 401；带正确 Key 可注册与上报。
- PostgreSQL 映射端口（默认 `16875`）未对公网开放。

## 操作手册

逐步步骤见 [../internal-release.md](../internal-release.md)。
