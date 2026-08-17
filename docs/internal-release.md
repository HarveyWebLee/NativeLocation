# 公网内测手册

本文说明：**本机 / 已有公网 IP 的服务器**上，不依赖正式域名，做外网真机内测。需求范围见 [requirements/internal-release.md](./requirements/internal-release.md)。

正式 HTTPS、VPS Compose、EAS 独立包与上架见 [deploy.md](./deploy.md)。

**推荐顺序：** 确认公网 `health` 通 → 配置 Key → Expo Go（蜂窝网）验收定位上报。服务端未对外可达时，不必打 EAS 包。

---

## 1. 适用与不适用

| 场景                            | 用本文？ | 说明                                         |
| ------------------------------- | -------- | -------------------------------------------- |
| 本机开发，仅同 Wi‑Fi 真机       | 否       | 用局域网 IP + Expo Go（见实现总览联调）      |
| 本机或服务器已有公网 IP，外网测 | 是       | 下文默认路径                                 |
| 要打 APK / 上架 / 长期 HTTPS    | 否       | 转 [deploy.md](./deploy.md)（可先免费 DDNS） |

仓库相关文件：

| 路径                 | 用途                          |
| -------------------- | ----------------------------- |
| `.env.example`       | 复制为根目录 `.env`（已忽略） |
| `docker-compose.yml` | 仅 Postgres（开发）           |
| `pnpm dev:api`       | Nest 监听 `0.0.0.0:18156`     |
| `pnpm dev:mobile`    | Metro + Expo Go 二维码        |

本期内测**不做**：强制域名、Nginx/证书、`docker-compose.prod.yml`、商店材料。

---

## 2. 前置条件

- [ ] 机器有可达的**公网 IPv4**（或已做好端口映射到该机）
- [ ] 防火墙 / 安全组 / 路由器放行 **TCP 18156**
- [ ] **不要**对公网开放 PostgreSQL 宿主机端口（默认 **16875**）
- [ ] 手机可装 Expo Go（**SDK 54**），验收时用**蜂窝网络**（或非本机局域网的 Wi‑Fi）

本机探活与公网探活都要做：本机通只说明进程在听；公网通才说明映射与防火墙正确。

---

## 3. 配置根目录 `.env`

复制模板（若尚未有 `.env`）：

```bash
cp .env.example .env
```

与内测相关的项：

| 变量                   | 说明                                                                     |
| ---------------------- | ------------------------------------------------------------------------ |
| `POSTGRES_*`           | 与 `docker-compose.yml` 一致；库只绑本机侧，勿对公网放行 `POSTGRES_PORT` |
| `PORT`                 | API 端口，默认 `18156`                                                   |
| `EXPO_PUBLIC_API_HOST` | 填**公网 IP**（不要填 `127.0.0.1` / `10.0.2.2` / 局域网 IP）             |
| `EXPO_PUBLIC_API_PORT` | 与 `PORT` 一致，默认 `18156`                                             |
| `API_KEY`              | 公网暴露时**必填**；未设置时开发态接口不校验 Key（不适合公网）           |
| `EXPO_PUBLIC_API_KEY`  | 与 `API_KEY` **完全相同**；客户端打进 Expo Go / 构建环境                 |

生成 Key 示例：

```bash
openssl rand -hex 32
```

示例片段（把 IP 换成真实公网地址）：

```env
PORT=18156
EXPO_PUBLIC_API_HOST=203.0.113.10
EXPO_PUBLIC_API_PORT=18156
API_KEY=请换成随机长串
EXPO_PUBLIC_API_KEY=请换成与 API_KEY 相同的值
```

修改 `.env` 后必须**重启** `dev:api` 与 `dev:mobile`，否则仍用旧值。

不要把含真实 Key / 公网运维细节的 `.env` 提交进 Git。

---

## 4. 启动服务

在仓库根目录：

```bash
pnpm install
pnpm db:up
pnpm db:generate
pnpm db:migrate
pnpm --filter @native-location/shared build
pnpm dev:api
```

另开终端：

```bash
pnpm dev:mobile
```

API 日志应出现类似 `API listening on http://0.0.0.0:18156`。

本机探活：

```bash
curl -sS http://127.0.0.1:18156/health
```

公网探活（任意外网机器，或手机蜂窝网下的浏览器）：

```bash
curl -sS http://<公网IP>:18156/health
```

期望 JSON 健康响应。若本机通、公网不通：查端口映射、云安全组、本机防火墙，而不是 App 配置。

---

## 5. 真机（Expo Go）验收

1. 手机安装 Expo Go（SDK 54）。
2. 手机开**蜂窝数据**（关掉与服务器同网段的 Wi‑Fi，避免误测成内网）。
3. 扫描 `pnpm dev:mobile` 终端二维码；或按终端提示用 `exp://...` 打开（Metro 默认端口见实现总览，常见 **8881**）。
4. 在 App 内：允许「使用期间」定位 → 开启追踪。
5. 界面出现服务端 ACK；本机库中有新 `LocationPoint`（可用 `pnpm db:studio` 查看）。

鉴权抽检（将 `YOUR_KEY` 换成 `.env` 中的 `API_KEY`）：

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

`GET /health` **不需要** Key。

---

## 6. 与 EAS 独立包的关系

| 方式                               | 是否推荐用于本阶段                                             |
| ---------------------------------- | -------------------------------------------------------------- |
| Expo Go + 公网 IP + HTTP/WS        | **推荐**；改 `.env` 重启即可，无需重打包                       |
| EAS `preview` 写死 `http://公网IP` | **不推荐默认**；Android/iOS 常拦明文 HTTP                      |
| 免费 DDNS + HTTPS 后再 preview     | 需要侧载 APK 时再做；步骤见 [deploy.md](./deploy.md) 第 5–8 节 |

内测通过后若要独立包：准备可申请证书的主机名（正式域名或 DuckDNS 等）→ 按生产手册上 TLS（`:18201`）→ 再在 EAS 配置 `EXPO_PUBLIC_API_HTTP_URL` / `EXPO_PUBLIC_API_WS_URL` / `EXPO_PUBLIC_API_KEY`。

---

## 7. 安全与运维注意

- 公网只放行 **18156**；数据库端口、Docker 未使用的调试口一律不对公网。
- 默认库密码仅适合纯本地；一旦端口可能误暴露，应改强密码并只监听必要地址。
- `API_KEY` 会进入客户端环境，可被反编译；仅防误连与随手扫描，不是用户登录。
- 部分运营商会干扰非标端口或明文 HTTP；`health` 公网不通时先换网络再查防火墙。
- 家宽若为 CGNAT，可能无法从外网连入，需确认运营商是否提供公网 IP 或已做映射。

---

## 8. 故障排查

| 现象                        | 处理                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 本机 `/health` 通、公网不通 | 端口映射、云安全组、Windows/系统防火墙是否放行 18156                                                                                          |
| App 仍连局域网 IP           | `.env` 未改 `EXPO_PUBLIC_API_HOST`，或改后未重启 Metro / API                                                                                  |
| 业务接口 401、health 200    | 服务器已设 `API_KEY`，客户端未设或不一致的 `EXPO_PUBLIC_API_KEY`                                                                              |
| Expo Go 连不上 Metro        | 手机与开发机网络策略；外网测 App 业务时 Metro 仍需手机能拉到 JS 包（常见仍要同网或隧道）；仅 API 走公网 IP                                    |
| 蜂窝网下 Metro 二维码失败   | 开发机 Metro 通常不在公网；可同 Wi‑Fi 扫码进 Expo Go，但确认 App 请求的 API Host 已是公网 IP；或使用 tunnel 模式（`expo start --tunnel`）拉包 |
| 定位无数据                  | 权限被拒或未开系统定位；符合前台定位设计                                                                                                      |

**说明：** Expo Go 需要从开发机加载 JS。外网内测时常见做法是：手机与电脑暂时同网扫码进入，但 `.env` 里 API 指向公网 IP，这样上报流量走公网路径；或使用 Expo tunnel 解决「不在同一局域网无法拉 Metro」的问题。验收「公网 API」时以 `health` 与上报入库为准。

---

## 9. 与开发 / 生产对照

| 项       | 局域网开发           | 公网内测（本文）             | 生产（deploy.md）                       |
| -------- | -------------------- | ---------------------------- | --------------------------------------- |
| Compose  | `docker-compose.yml` | 同左（仅库）                 | `docker-compose.prod.yml` + Nginx       |
| API 进程 | `pnpm dev:api`       | 同左                         | 镜像内 Nest                             |
| API 地址 | 局域网 IP `:18156`   | **公网 IP** `:18156`（HTTP） | `https://域名:18201`                    |
| WS       | `ws://...`           | `ws://公网IP:18156/...`      | `wss://域名:18201/...`                  |
| Key      | 可不设               | **应设**                     | 必设（否则拒启）                        |
| 客户端   | Expo Go              | Expo Go（推荐）              | EAS preview / production                |
| 环境文件 | 根目录 `.env`        | 根目录 `.env`                | `.env.production` + EAS `EXPO_PUBLIC_*` |
