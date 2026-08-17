# 公网内测手册

本文说明：在**已有公网 IP** 的本机/服务器上，**不依赖正式域名**，用 Compose 部署 **Postgres + API + Mobile Web**，并做外网真机内测。需求见 [requirements/internal-release.md](./requirements/internal-release.md)。

正式 HTTPS（含 nginx）、商店包见 [deploy.md](./deploy.md)。

**推荐顺序：** 配好 `.env.production` → Compose 起 `postgres api web` → 公网 `health` / Web 页通 → iOS Expo Go 或 Android preview APK 验收。

---

## 1. 适用与客户端形态

| 场景                        | 用本文？ | 说明                     |
| --------------------------- | -------- | ------------------------ |
| 仅同 Wi‑Fi、本机 `pnpm dev` | 否       | 见实现总览联调           |
| 公网 IP、Compose 内测       | 是       | 下文默认路径             |
| 域名 + HTTPS + 上架         | 否       | [deploy.md](./deploy.md) |

| 客户端  | 方式                           | 说明                                              |
| ------- | ------------------------------ | ------------------------------------------------- |
| iOS     | **Expo Go**（SDK 54）          | 本机/开发机起 Metro；API 指公网 IP                |
| Android | **EAS preview APK** 或 Expo Go | APK 把 API 地址打进包；`http://` 时自动允许明文   |
| 浏览器  | Compose **web** 服务           | `http://<公网IP>:18202`；Web 定位弱于原生，作辅助 |

仓库相关文件：

| 路径                      | 用途                                |
| ------------------------- | ----------------------------------- |
| `.env.production.example` | 复制为 `.env.production`            |
| `docker-compose.prod.yml` | 复用；内测只起 postgres / api / web |
| `Dockerfile`              | API 镜像                            |
| `Dockerfile.web`          | Mobile Web 静态导出 + Nginx 镜像    |
| `deploy/web-nginx.conf`   | Web 容器内静态站点配置              |
| `apps/mobile/eas.json`    | Android preview APK                 |

内测**不要**起 `nginx` 服务（缺证书会退出）。生产再起 nginx（18200/18201）。

---

## 2. 前置条件

- [ ] Docker Engine + Compose 插件可用
- [ ] 公网 IPv4（或端口映射到本机）
- [ ] 防火墙放行 **TCP 18156**（API）、**TCP 18202**（Web）
- [ ] **不要**对公网开放数据库端口；Compose 已将库绑在 **127.0.0.1**
- [ ] Android 打 APK 需 Expo 账号；iOS Expo Go 需 SDK 54

---

## 3. 配置 `.env.production`

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

| 变量                           | 说明                                                              |
| ------------------------------ | ----------------------------------------------------------------- |
| `NODE_ENV`                     | `production`（API 镜像内也会设为 production）                     |
| `POSTGRES_*` / `POSTGRES_PORT` | 库账号与宿主机映射端口（仅 `127.0.0.1`）；API 容器仍连内网 `5432` |
| `API_KEY`                      | **必填**；足够长的随机串                                          |
| `CORS_ORIGIN`                  | 浏览器访问 Web 时填 `http://<公网IP>:18202`（可逗号分隔多个）     |
| `EXPO_PUBLIC_API_HTTP_URL`     | `http://<公网IP>:18156`（打进 Web 镜像与 EAS APK）                |
| `EXPO_PUBLIC_API_WS_URL`       | `ws://<公网IP>:18156/v1/location/stream`                          |
| `EXPO_PUBLIC_API_KEY`          | 与 `API_KEY` 相同                                                 |
| `WEB_PORT`                     | 宿主机 Web 端口，默认 `18202`                                     |

生成 Key：

```bash
openssl rand -hex 32
```

示例（替换公网 IP 与密钥）：

```env
NODE_ENV=production
POSTGRES_USER=nativelocation
POSTGRES_PASSWORD=请改成强密码
POSTGRES_DB=nativelocation
POSTGRES_PORT=16875
API_KEY=请换成随机长串
CORS_ORIGIN=http://203.0.113.10:18202
EXPO_PUBLIC_API_HTTP_URL=http://203.0.113.10:18156
EXPO_PUBLIC_API_WS_URL=ws://203.0.113.10:18156/v1/location/stream
EXPO_PUBLIC_API_KEY=请换成与 API_KEY 相同的值
WEB_PORT=18202
```

改 `EXPO_PUBLIC_*` 后必须 **重新 build web**（及重新打 APK），静态资源在构建时写入。

iOS Expo Go 另需根目录 **`.env`**（或开发机 `.env`）中的 `EXPO_PUBLIC_API_HOST` / `PORT` / `EXPO_PUBLIC_API_KEY` 与上述公网地址、Key 一致，供 Metro 注入。

---

## 4. 启动 Compose（postgres + api + web）

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build postgres api web
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f api
```

本机探活：

```bash
curl -sS http://127.0.0.1:18156/health
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:18202/
```

公网探活：

```bash
curl -sS http://<公网IP>:18156/health
curl -sS -o /dev/null -w "%{http_code}\n" http://<公网IP>:18202/
```

期望：health 为 JSON；Web 为 **200**。本机通、公网不通时查端口映射与防火墙。

更新 API 或 Web：

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build api web
```

---

## 5. iOS：Expo Go

1. 开发机配置根目录 `.env`：`EXPO_PUBLIC_API_HOST=<公网IP>`、`EXPO_PUBLIC_API_PORT=18156`、`EXPO_PUBLIC_API_KEY=<与服务器相同>`。
2. `pnpm --filter @native-location/shared build` 后执行 `pnpm dev:mobile`。
3. iPhone 安装 Expo Go（SDK 54），扫码进入（蜂窝网测 API 时，可用同网扫码或 `expo start --tunnel` 拉 JS）。
4. 授权定位 → 开启追踪 → 确认 ACK / 入库。

---

## 6. Android：preview APK（可以）

可以。用 EAS **preview** 打 APK，把与 `.env.production` 相同的 `EXPO_PUBLIC_*` 配到 Expo 控制台该 profile（或本地 `eas.json` 的 `env`，勿提交真实 Key）。

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build --profile preview --platform android
```

- API 为 `http://...` 时，`app.config.js` 会为 Android 打开 **usesCleartextTraffic**，否则系统会拦明文。
- 装包后用**蜂窝网络**验收；改 API 地址或 Key 后须**重新 build**。
- 也可用 Expo Go，步骤同 iOS。

---

## 7. 鉴权抽检

```bash
# 无 Key → 401
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "Content-Type: application/json" \
  -d '{"platform":"android"}' \
  http://<公网IP>:18156/v1/devices/register

# 有 Key → 2xx
curl -sS \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: YOUR_KEY" \
  -d '{"platform":"android","displayName":"internal-smoke"}' \
  http://<公网IP>:18156/v1/devices/register
```

`GET /health` 不需要 Key。

---

## 8. 安全与注意

- 公网只放行 **18156**、**18202**；库仅本机 `127.0.0.1:16875`。
- Web 与 APK 均含 `EXPO_PUBLIC_API_KEY`，可被反编译；仅防误连。
- 浏览器跨域依赖 `CORS_ORIGIN`；漏配时 Web 调 API 会失败，原生 App 不受 CORS 影响。
- 部分运营商干扰非标端口；家宽 CGNAT 可能导致公网不可达。
- 升级到正式 HTTPS 后：起 nginx、改客户端为 `https://域名:18201` / `wss://...`，并重新导出 Web / 重打 APK。

---

## 9. 故障排查

| 现象                        | 处理                                                                 |
| --------------------------- | -------------------------------------------------------------------- |
| web 构建失败                | 查 `EXPO_PUBLIC_*` 是否在 compose build args 中；`logs` / build 输出 |
| 浏览器调 API 失败、App 正常 | 补 `CORS_ORIGIN=http://<公网IP>:18202` 后重建/重启 **api**           |
| Android APK 无法访问 HTTP   | 确认构建时 `EXPO_PUBLIC_API_HTTP_URL` 以 `http://` 开头以启用明文    |
| 误起 nginx 立刻退出         | 内测不要 `up nginx`；缺证书属预期                                    |
| 外网连上数据库端口          | 确认使用的是已改绑 `127.0.0.1` 的 `docker-compose.prod.yml`          |
| App 仍连旧地址              | Web/APK 需重新 build；Expo Go 需重启 Metro                           |

---

## 10. 与开发 / 生产对照

| 项       | 局域网开发                | 公网内测（本文）                            | 生产（deploy.md）            |
| -------- | ------------------------- | ------------------------------------------- | ---------------------------- |
| Compose  | `docker-compose.yml` 仅库 | `docker-compose.prod.yml`：postgres+api+web | 再加 **nginx**（证书就绪后） |
| 环境文件 | `.env`                    | **`.env.production`**                       | `.env.production` + EAS      |
| Postgres | 常见全接口监听            | **仅 127.0.0.1**                            | 同左                         |
| API      | `pnpm dev:api`            | 容器 `:18156` HTTP                          | 经 nginx `:18201` HTTPS      |
| Web      | Metro `:8881`             | 容器 `:18202`                               | 可继续用 web 服务或改走域名  |
| iOS      | Expo Go                   | Expo Go                                     | EAS / 商店                   |
| Android  | Expo Go                   | **preview APK** 或 Expo Go                  | production AAB               |
