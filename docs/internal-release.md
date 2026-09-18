# 公网内测手册

本文说明：在**已有公网 IP** 的本机/服务器上，用 Compose 部署 **Postgres + API + Mobile Web**，并支持**本机编译 Android debug APK**、Web 公开下载。需求见 [requirements/internal-release.md](./requirements/internal-release.md)。

正式 HTTPS（含 nginx）、商店包见 [deploy.md](./deploy.md)。

**推荐顺序：** `.env.production` → Compose `postgres api web` → 宿主机 `pnpm apk:agent` → 公网探活 → Web 触发 APK / 下载 → 真机安装验收。

---

## 1. 适用与客户端形态

| 场景                  | 用本文？ | 说明                     |
| --------------------- | -------- | ------------------------ |
| 公网 IP、Compose 内测 | 是       | 下文默认                 |
| 域名 + HTTPS + 上架   | 否       | [deploy.md](./deploy.md) |

| 客户端  | 方式                         | 说明                                   |
| ------- | ---------------------------- | -------------------------------------- |
| Android | **Web 下载 debug APK（主）** | 本机构建；`/downloads/...apk` 公开可下 |
| iOS     | Expo Go（备选）              | `exp://<局域网IP>:28881`               |
| 浏览器  | Compose **web** `:28881`     | 定位辅助 + APK 构建/下载入口           |

相关文件：`docker-compose.prod.yml`、`Dockerfile` / `Dockerfile.web`、`scripts/apk-build-agent.mjs`、`scripts/build-android-apk.mjs`、`deploy/apk/`。

内测**不要**起 nginx（`tls` profile）。

---

## 2. 前置条件

- [ ] Docker + Compose
- [ ] 公网 IP；防火墙放行 **18156**、**28881**
- [ ] 库端口不对公网（已绑 127.0.0.1）
- [ ] **APK 本机构建：** 宿主机已装 **JDK 17+**、**Android SDK**（`ANDROID_HOME` / `ANDROID_SDK_ROOT`），可用内存建议 ≥ 8GB
- [ ] 构建期间可访问 Maven/npm（或已有缓存）

---

## 3. 配置 `.env.production`

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

必填：`API_KEY`、`EXPO_PUBLIC_API_HTTP_URL` / `WS_URL` / `API_KEY`（三者 Key 与 `API_KEY` 一致）、`CORS_ORIGIN=http://<公网IP>:28881`。

可选：`APK_BUILD_AGENT_URL`（默认 `http://host.docker.internal:18210`）。

---

## 4. 启动 Compose + APK agent

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build postgres api web
```

**另开终端（宿主机，常驻）：**

```bash
pnpm apk:agent
```

Agent 仅监听 `127.0.0.1:18210`。API 容器经 `host.docker.internal` 调用。

探活：

```bash
curl -sS http://127.0.0.1:18156/health
curl -sS http://127.0.0.1:18210/health
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:28881/
```

---

## 5. Web：构建与下载 APK

1. 浏览器打开 `http://<公网IP>:28881/`
2. 在「Android 内测 APK」卡片点 **开始构建 APK**（请求带已注入的 `EXPO_PUBLIC_API_KEY`）
3. 等待状态变为 `success`（首次可需十余分钟）
4. 点 **下载 APK**，或直接打开：

```text
http://<公网IP>:28881/downloads/native-location-preview.apk
```

下载**无需**鉴权。触发构建需要有效 `X-Api-Key`。

也可手动本机构建（不经 Web）：

```bash
pnpm apk:build
```

产物：`deploy/apk/native-location-preview.apk`；状态：`deploy/apk/build-status.json`。

---

## 6. API 约定

| 方法   | 路径                                     | 鉴权        | 说明                 |
| ------ | ---------------------------------------- | ----------- | -------------------- |
| `GET`  | `/v1/admin/apk/status`                   | 无          | 构建状态             |
| `POST` | `/v1/admin/apk/build`                    | `X-Api-Key` | 异步触发；冲突时 409 |
| `GET`  | `/downloads/native-location-preview.apk` | 无          | 由 Web Nginx 提供    |

---

## 7. iOS / Expo Go（备选）

开发机 `.env` 指向同一公网 API 与 Key → `pnpm dev:mobile` → `exp://<局域网IP>:28881`。勿与 Compose web 同时占用本机 28881。

---

## 8. 安全与注意

- `API_KEY` 已进 Web/APK，可被取出并触发构建；仅适合受控内测。
- 构建吃 CPU/磁盘；同时仅允许一个任务。
- debug 签名：换机器重装可能需先卸旧包。
- 改 `EXPO_PUBLIC_*` 后须重新构建 APK（及重建 web 镜像）。

---

## 9. 故障排查

| 现象                       | 处理                                                    |
| -------------------------- | ------------------------------------------------------- |
| 触发失败「无法连接 agent」 | 宿主机未跑 `pnpm apk:agent`；检查 `APK_BUILD_AGENT_URL` |
| Gradle / SDK 错误          | 检查 `ANDROID_HOME`、JDK、磁盘空间                      |
| 下载 404                   | 尚未构建成功；看 `deploy/apk/`                          |
| 浏览器 CORS                | `CORS_ORIGIN` 含 `http://<公网IP>:28881` 后重启 api     |
| 28881 冲突                 | 停 Metro 或停 Compose web                               |

---

## 10. 与开发 / 生产对照

| 项        | 局域网开发 | 公网内测（本文）              | 生产           |
| --------- | ---------- | ----------------------------- | -------------- |
| Compose   | 仅库       | postgres+api+web              | + nginx（tls） |
| Android   | Expo Go    | **本机 debug APK + Web 下载** | EAS / 商店     |
| APK agent | 无         | 宿主机常驻                    | 可选           |
