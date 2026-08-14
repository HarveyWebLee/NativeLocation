# 生产构建与发布手册

本文是运维与发版的逐步操作说明。决策背景见 [architecture/production-release.md](./architecture/production-release.md)，需求范围见 [requirements/production-release.md](./requirements/production-release.md)。

**推荐顺序：** 先上线 HTTPS API → 用 curl 验收鉴权 → 再打独立包 → 内测 APK → 商店包。App 构建时会把 API 地址和 Key **写进包内**，服务端未就绪时打生产包没有意义。

---

## 1. 文档怎么用

| 读者       | 读哪些章节        |
| ---------- | ----------------- |
| 运维 / VPS | 第 2–6、11、13 节 |
| 客户端发版 | 第 2、7–11、13 节 |
| 商店上架   | 第 10–11 节       |

仓库内相关文件：

| 路径                           | 用途                                           |
| ------------------------------ | ---------------------------------------------- |
| `.env.production.example`      | 复制为根目录 `.env.production`（已忽略）       |
| `Dockerfile`                   | 生产 API 镜像（含 migrate + 启动）             |
| `docker-compose.prod.yml`      | Postgres + API；API 只绑 `127.0.0.1:18156`     |
| `deploy/nginx.conf.example`    | 宿主机 Nginx：TLS 与反向代理                   |
| `apps/mobile/eas.json`         | EAS 构建档：development / preview / production |
| `apps/mobile/app.json`         | 包名、版本、定位权限文案                       |
| `docs/legal/privacy-policy.md` | 隐私政策草稿，须托管为 HTTPS 再填商店          |

本期**不做**：用户登录、多实例、Redis、后台持续定位、代注册商店账号、代申请域名证书。

---

## 2. 发布前清单

### 2.1 账号与材料

- [ ] 一台可公网访问的 Linux VPS（建议 2 vCPU / 2 GB 内存起；需 Docker；防火墙放行 **18200、18201**，不使用 80/443）
- [ ] 已解析到该 VPS 的 API 域名（下文以 `api.example.com` 为例）
- [ ] [Expo](https://expo.dev) 账号（EAS Build）
- [ ] Apple Developer Program（上架 iOS）
- [ ] Google Play Console（上架 Android）
- [ ] 隐私政策 HTTPS URL（把 `docs/legal/privacy-policy.md` 发布出去，替换联系邮箱）

### 2.2 包名与版本（改代码前确认）

当前 `apps/mobile/app.json`：

| 项                     | 值                       |
| ---------------------- | ------------------------ |
| 显示名                 | `NativeLocation`         |
| Expo slug              | `native-location`        |
| iOS `bundleIdentifier` | `com.nativelocation.app` |
| Android `package`      | `com.nativelocation.app` |
| `version`              | `1.0.0`                  |

商店里包名全局唯一。若被占用，先改 `app.json` 再 `eas init` / 构建。每次商店更新至少提高 `expo.version`；Android 还需提高 `android.versionCode`，iOS 提高 `ios.buildNumber`（首次可设为 `1`）。`eas.json` 使用 `"appVersionSource": "local"`，版本以仓库 `app.json` 为准，不由 EAS 远程自增。

### 2.3 密钥原则

- 服务器 `API_KEY` 与客户端 `EXPO_PUBLIC_API_KEY` **必须相同**。
- 真实环境文件与证书**禁止提交**。根目录 `.gitignore` 会忽略 `.env` / `.env.*`（保留 `.env.example`、`.env.production.example`），以及 `*.p8` / `*.jks` / `google-services.json` 等凭据。
- Key 会打进独立包，可被反编译。它只防误连和随手扫描，**不是用户身份**。轮换 Key 必须：**先改服务器，再重新打客户端包并分发**。

生成示例：

```bash
openssl rand -hex 32
```

---

## 3. 架构与流量

```text
真机 App (HTTPS / WSS，端口 18201)
        │
        ▼
  Nginx :18201（TLS 终止）
        │  Upgrade: websocket
        ▼
  127.0.0.1:18156  NestJS 容器
        │
        ▼
  Docker 内网 Postgres:5432（不映射公网）
```

- Nest 在容器内仍是 HTTP。对外反向代理：**18200** = HTTP（301 到 HTTPS），**18201** = HTTPS/WSS。不使用 80/443。
- 客户端地址必须带端口，例如 `https://api.example.com:18201`、`wss://api.example.com:18201/v1/location/stream`。
- `GET /health` **不需要** API Key（探活、证书、Nginx 检查）。
- 其余 HTTP 需要请求头 `X-Api-Key`（契约常量 `API_KEY_HEADER` = `x-api-key`）。
- WebSocket 路径 `/v1/location/stream`，查询参数 `apiKey=`（`API_KEY_QUERY`）。校验失败关闭码 `1008`。
- `NODE_ENV=production` 且未设置 `API_KEY` 时进程**拒绝启动**。
- 生产未配置 `CORS_ORIGIN` 时关闭浏览器跨域；原生 App 不走 CORS。仅当需要浏览器调试生产 API 时再填逗号分隔的 Origin。

---

## 4. 发版前质量门禁（开发机）

在打镜像或打 EAS 包之前，于仓库根目录执行：

```bash
pnpm install
pnpm --filter @native-location/shared build
pnpm format
pnpm lint:fix
pnpm typecheck
```

或一键：`pnpm precommit`。推送到 `main` / `master` 时 GitHub Actions（`.github/workflows/check.yml`）会跑 `pnpm check`。

---

## 5. 部署生产 API（自有 VPS）

以下在 **VPS** 上操作。假设系统为 Ubuntu，已能 SSH。

### 5.1 安装 Docker

按 [Docker 官方文档](https://docs.docker.com/engine/install/ubuntu/) 安装 Engine 与 Compose 插件，确认：

```bash
docker --version
docker compose version
```

安装 Nginx 与 Certbot（证书挂在**宿主机** Nginx，不进 Compose）：

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

防火墙开放 SSH、**18200**、**18201**。不要开放 80/443 给本服务。**不要**把 `5432` 或 `18156` 暴露到 `0.0.0.0`。Compose 已把 API 映射为 `127.0.0.1:18156:18156`。

### 5.2 放置代码与环境变量

```bash
git clone <你的仓库 URL> NativeLocation
cd NativeLocation
cp .env.production.example .env.production
chmod 600 .env.production
```

编辑 `.env.production`：

| 变量                | 说明                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------ |
| `NODE_ENV`          | 必须为 `production`                                                                  |
| `POSTGRES_USER`     | 默认 `nativelocation`                                                                |
| `POSTGRES_PASSWORD` | 强密码。若含 `@` `#` `%` 等，写入 `DATABASE_URL` 时需 URL 编码（Compose 会拼进 URL） |
| `POSTGRES_DB`       | 默认 `nativelocation`                                                                |
| `API_KEY`           | 与后续 EAS 的 `EXPO_PUBLIC_API_KEY` 相同                                             |
| `CORS_ORIGIN`       | 生产可留空                                                                           |

不要把真实 `.env.production` 拷回开发机仓库或发到聊天工具。

### 5.3 启动 Postgres 与 API

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f api
```

镜像启动命令为：`prisma migrate deploy` 然后 `node dist/main.js`。首次会应用 Prisma 迁移；之后每次重建容器也会跑 `migrate deploy`（已应用的迁移会跳过）。

本机探活（此时尚未上 TLS）：

```bash
curl -sS http://127.0.0.1:18156/health
```

期望 JSON 健康响应。若 api 容器反复退出，查日志是否为「生产环境必须设置 `API_KEY`」或数据库连不上。

### 5.4 Nginx + Let's Encrypt（18200 / 18201）

本服务**不占用 80/443**。Nginx 监听：

| 端口    | 协议     | 用途                                      |
| ------- | -------- | ----------------------------------------- |
| `18200` | HTTP     | 301 跳转到 `https://主机:18201`           |
| `18201` | HTTPS/WSS | 对外 API（TLS 终止后转到 `127.0.0.1:18156`） |
| `18156` | HTTP     | 仅本机 Nest，不对公网                     |

Let's Encrypt 的 HTTP-01 需要 80，本机用不了 80，因此证书用 **DNS-01**（在域名解析里加 TXT，或用 Cloudflare 等插件）。

1. 将 `deploy/nginx.conf.example` 拷到 `/etc/nginx/sites-available/nativelocation`。
2. 把其中所有 `api.example.com` 换成真实域名。
3. 先申请证书（示例：手动 DNS）：

```bash
sudo certbot certonly --manual --preferred-challenges dns -d api.example.com
```

按提示添加 `_acme-challenge` TXT 后再继续。有 Cloudflare 时可用对应 certbot 插件自动加 TXT。

4. `nginx -t` 后 `systemctl reload nginx`。确认 18201 段含 `Upgrade` / `Connection` 与 `proxy_read_timeout 3600s`（WebSocket）。
5. 防火墙放行 18200、18201。
6. 公网检查（必须带端口）：

```bash
curl -sS https://api.example.com:18201/health
```

访问 `http://api.example.com:18200/health` 应 301 到 `:18201`。部分运营商会拦截非 443 的 HTTPS，真机请在 4G 与常用 Wi‑Fi 都测一遍。

### 5.5 用 curl 验收鉴权

将 `YOUR_KEY` 换成 `.env.production` 里的 `API_KEY`。

健康检查（无 Key，必须 200）：

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://api.example.com:18201/health
```

无 Key 注册（必须 401）：

```bash
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "Content-Type: application/json" \
  -d '{"platform":"android"}' \
  https://api.example.com:18201/v1/devices/register
```

带 Key 注册（必须 2xx，返回 `deviceId`）：

```bash
curl -sS \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: YOUR_KEY" \
  -d '{"platform":"android","displayName":"prod-smoke"}' \
  https://api.example.com:18201/v1/devices/register
```

无 Key 的 WebSocket 应被关闭。可用任意支持自定义 URL 的客户端连接：

```text
wss://api.example.com:18201/v1/location/stream?apiKey=YOUR_KEY
```

连上后服务端会发 `{ "type": "connected", ... }`。错误 Key 时连接关闭，码 `1008`。

### 5.6 更新已部署的 API

代码变更推到 VPS 后：

```bash
cd NativeLocation
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Prisma 有新迁移时，容器启动时的 `migrate deploy` 会执行。**不要**在生产对库跑 `prisma migrate dev`。

回滚：`git checkout` 到上一发版标签后同样 `--build` 重启。Postgres 数据在 volume `postgres_data` 中；回滚应用代码不会自动撤销已应用的迁移。需要回滚 schema 时单独规划，不要在未备份时删 volume。

备份示例：

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec postgres \
  pg_dump -U nativelocation nativelocation > backup-$(date +%Y%m%d).sql
```

---

## 6. 客户端环境变量（EAS）

独立包**不会**读 VPS 上的 `.env.production`。必须在 [Expo 环境变量](https://docs.expo.dev/eas/environment-variables/)（或 `eas.json` 的 `env`，勿提交真实 Key）为对应 Build Profile 配置：

| 变量                       | 生产示例                                   | 说明                                  |
| -------------------------- | ------------------------------------------ | ------------------------------------- |
| `EXPO_PUBLIC_API_HTTP_URL` | `https://api.example.com:18201`                  | 必须带 `:18201`，不要末尾斜杠         |
| `EXPO_PUBLIC_API_WS_URL`   | `wss://api.example.com:18201/v1/location/stream` | 不要在此拼 `apiKey`，客户端会自动附加 |
| `EXPO_PUBLIC_API_KEY`      | 与服务器 `API_KEY` 相同                    | 打进包内                              |

未设置 `EXPO_PUBLIC_API_HTTP_URL` 时，App 会回落到开发用 `http://<host>:18156`，**生产包不可依赖该回落**。

建议：

- **preview** 与 **production** 都指向同一生产 API（或单独预发域名，但 Key 与 URL 必须成套）。
- 在 Expo 控制台把变量标为 Sensitive；不要写进 git。

---

## 7. EAS 一次性初始化

在**开发机**（已登录 Apple / Google 开发者更好，证书可由 EAS 代管）：

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli init
```

`eas init` 会把 `extra.eas.projectId` 写入 `app.json`。将该改动提交进仓库，之后团队才能打同一项目的包。

查看构建档：`apps/mobile/eas.json`

| Profile             | 用途                      | 产物要点                             |
| ------------------- | ------------------------- | ------------------------------------ |
| `development`       | 开发客户端                | `developmentClient: true`，内部分发  |
| `preview`           | 内测                      | Android 为 **APK**，可侧载           |
| `production`        | 商店                      | Android 默认 **AAB**；iOS 为商店 IPA |
| `submit.production` | `eas submit` 使用的提交档 | 需已关联商店账号                     |

CLI 要求 `eas-cli` ≥ 16。

首次 iOS 构建会引导生成发行证书与描述文件；Android 会生成或上传 Keystore。**务必在 Expo 凭据页备份 Android Keystore**，丢失则无法更新同一包名。

---

## 8. 构建独立包

均在 `apps/mobile` 目录。构建在 Expo 云端执行，本地不需要 Android Studio / Xcode（提交 iOS 时本机有时仍需登录 Apple）。

### 8.1 Android 内测 APK（推荐先做）

```bash
npx eas-cli build --profile preview --platform android
```

完成后用页面二维码或安装链接装到真机。验收：

1. 打开 App，申请定位权限（系统「使用期间」）。
2. 开启定位，确认坐标按所选频率更新。
3. 界面出现服务端 ACK；VPS 上 `LocationPoint` 有新行（可用临时 `docker compose ... exec postgres psql` 查询，用完关掉交互）。

iOS 内测可用同一 `preview` profile（非 APK，需设备注册或 Ad Hoc / 内部发行，按 EAS 提示操作）。

### 8.2 商店生产包

确认第 6 节生产环境变量已绑定 **production** profile，且 `app.json` 版本已按本次发版提高。

```bash
npx eas-cli build --profile production --platform android
npx eas-cli build --profile production --platform ios
# 或双端：
npx eas-cli build --profile production --platform all
```

- Play 上架用 **AAB**（production 默认）。不要把 preview 的 APK 传到 Play 正式轨。
- App Store 用 production 的 iOS 构建。
- 构建失败时看 EAS 日志：常见原因是未设 `projectId`、iOS 包名与证书不一致、环境变量未进该 profile。

本地安装 production Android 包需要再打 APK 时，可临时在 `eas.json` 的 `production.android.buildType` 设为 `apk`，仅用于自测，上架前改回默认 AAB。

---

## 9. 提交到商店

商店账号、付费、审核由需求方完成。仓库只提供命令入口。

```bash
cd apps/mobile
npx eas-cli submit --profile production --platform android
npx eas-cli submit --profile production --platform ios
```

- Google：在 Expo / EAS 配置 Play 服务账号 JSON（仅限必要权限）。
- Apple：App Store Connect 中已创建同 Bundle ID 的 App；`eas submit` 会上传 IPA。

提交前在商店后台填好第 10 节材料，否则审核会卡在元数据。

---

## 10. 上架材料与审核要点

### 10.1 隐私政策

1. 将 [legal/privacy-policy.md](./legal/privacy-policy.md) 发布为 **HTTPS** 页面（静态站或对象存储均可）。
2. 替换联系邮箱、运营方名称、数据保留期限。
3. 把该 URL 填入 App Store Connect 与 Google Play「隐私政策」。
4. 可选：在 `app.json` 的 `expo.extra` 或商店描述中放同一 URL。

### 10.2 权限说明（须与实现一致）

生产包**仅**「使用期间」定位：

- iOS：`NSLocationWhenInUseUsageDescription`；**无** `UIBackgroundModes: location`。
- Android：`ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`；**无** `ACCESS_BACKGROUND_LOCATION`。
- `expo-location` 插件：`isAndroidBackgroundLocationEnabled` / `isIosBackgroundLocationEnabled` 均为 `false`。

商店问卷勾选：仅在 App 前台使用时采集位置；不用于广告追踪。`ITSAppUsesNonExemptEncryption` 已为 `false`（无自定义加密，仅 HTTPS）。

若审核问「为何要定位」：用于用户主动开启后的实时位置上报到自有服务器。

### 10.3 截图与文案

- iOS：按 App Store 要求的机型尺寸准备竖屏截图（应用为 `orientation: portrait`）。
- Android：Play 至少一张手机截图；标题与短描述不要承诺后台持续追踪或地图导航（本期没有）。
- 分级：位置数据属于用户相关数据，按两家商店的隐私问卷如实申报「位置」。

### 10.4 双端验收（独立包，禁止只测 Web）

| 项     | iOS                                  | Android                                      |
| ------ | ------------------------------------ | -------------------------------------------- |
| 安装   | TestFlight 或 EAS 内测               | preview APK 或 Play 内部测试轨               |
| 权限   | 使用期间定位弹窗；设置中可关闭       | 精确/大致位置；设置中可关闭                  |
| 定位   | 前台采集；坐标为 WGS84               | 同左                                         |
| 上报   | WSS 通；断网后恢复应走 HTTP 批量补传 | 同左                                         |
| 安全区 | 底部主按钮不被 Home 条挡住           | 返回键不导致白屏退出未保存状态（当前无多页） |

---

## 11. 发版当天检查表

**API**

- [ ] `https://域名:18201/health` 为 200，证书有效
- [ ] 无 `X-Api-Key` 的 `POST /v1/devices/register` 为 401
- [ ] 正确 Key 可注册设备
- [ ] `wss://域名:18201/v1/location/stream?apiKey=` 可连
- [ ] Postgres 未对公网开放
- [ ] 已做数据库备份

**App**

- [ ] EAS production / preview 环境变量指向该 HTTPS / WSS
- [ ] Key 与服务器一致
- [ ] `app.json` 版本已递增
- [ ] 真机 preview 包走完：权限 → 开启定位 → 库中有点
- [ ] 隐私政策 URL 可打开且与商店填写一致

**商店（若上架）**

- [ ] 包名、证书、Keystore 已备份
- [ ] 未声明后台定位
- [ ] `eas submit` 成功或手动上传成功

---

## 12. 版本与热更新

本期**不使用** EAS Update / OTA 作为生产发布主路径。接口地址与 API Key 在**原生构建时**打入；改 URL 或 Key 必须 **重新 `eas build`**。

仅改 Nest 业务且无契约破坏时：只更新 VPS 上的 API 镜像即可，已安装的 App 可继续用。若变更了请求头、路径或 Zod 字段，必须同时发新包。

---

## 13. 故障排查

| 现象                               | 处理                                                                |
| ---------------------------------- | ------------------------------------------------------------------- |
| api 容器立刻退出                   | 查 `API_KEY` 是否在 `--env-file` 中；`NODE_ENV` 是否为 production   |
| migrate 失败                       | 查 `POSTGRES_PASSWORD` 特殊字符；`docker compose ... logs postgres` |
| `/health` 通但 App 401             | 客户端 `EXPO_PUBLIC_API_KEY` 与服务器不一致，或该次构建未注入变量   |
| App 仍请求 `http://10.0.2.2:18156` | 生产构建未设置 `EXPO_PUBLIC_API_HTTP_URL`，打了开发回落             |
| WSS 连上立刻断开                   | 查 Nginx `Upgrade`；查 query 是否为 `apiKey`（不是 `X-Api-Key`）    |
| 仅 HTTP 通、WSS 失败               | `proxy_read_timeout` 过短或漏了 Connection upgrade                  |
| iOS 构建缺证书                     | `eas credentials` 按提示生成；Bundle ID 必须与开发者后台一致        |
| Play 拒包 versionCode              | 提高 `android.versionCode` 后重打 production                        |
| 定位权限被拒后无数据               | 符合设计；引导用户到系统设置。生产包不能在后台持续采点              |
| 18200/18201 连不上                 | 查防火墙与 Nginx `listen`；证书须 DNS-01；客户端 URL 必须带 `:18201` |

---

## 14. 与开发环境的区别（避免混用）

| 项       | 本地开发                           | 生产                                    |
| -------- | ---------------------------------- | --------------------------------------- |
| Compose  | `docker-compose.yml`，库端口 16875 | `docker-compose.prod.yml`，库不映射公网 |
| API 地址 | `http://局域网IP:18156`            | `https://你的域名:18201`                |
| WS       | `ws://.../v1/location/stream`      | `wss://你的域名:18201/v1/location/stream` |
| API Key  | 可不设（放行）                     | 必设，否则拒启                          |
| 客户端   | Expo Go / `pnpm dev:mobile`        | EAS 独立包                              |
| 环境变量 | 仅根目录 `.env`                    | Compose `.env.production`；EAS 控制台   |

开发机不要对生产库跑 `pnpm db:migrate`（那是 `migrate dev`）。生产只用镜像内的 `prisma migrate deploy`。
