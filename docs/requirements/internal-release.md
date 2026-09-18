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

**Android 内测主路径：** 部署机**本机编译** debug APK → Web 页**公开下载**；由 Web「开始构建」按钮触发（`X-Api-Key` = `API_KEY`）。Expo Go 仅备选。iOS 仍用 Expo Go。

## 范围

### 本期（In Scope）

- Compose：`postgres + api + web`（不起 nginx）；`.env.production`；库仅 `127.0.0.1`。
- API `:18156`；Web `:28881`（容器内亦 28881）。
- **APK 自动化：**
  - 宿主机安装 JDK + Android SDK；运行 **APK build agent**（本机进程，非云 EAS）。
  - 构建：`expo prebuild` + Gradle **`assembleDebug`**（debug keystore）。
  - 注入 `.env.production` 的 `EXPO_PUBLIC_API_*`。
  - 产物：`deploy/apk/native-location-preview.apk`，经 Web `/downloads/` 公开下载。
  - `POST /v1/admin/apk/build` 需 `X-Api-Key`；`GET /v1/admin/apk/status` 公开；同时仅一个构建任务。
  - Web 页：下载入口 + 开始构建（使用已注入的 `EXPO_PUBLIC_API_KEY`）。
- iOS：Expo Go 备选。

### 明确不做

- EAS 云构建作主路径；本机 release 正式签名；iOS IPA 自动分发；商店上架。

## 已决

| 项               | 结论                                       |
| ---------------- | ------------------------------------------ |
| APK 构建         | 宿主机本机编译（prebuild + assembleDebug） |
| 触发             | Web 按钮 → API → 本机 agent                |
| 触发鉴权         | `API_KEY` / `X-Api-Key`                    |
| 下载             | 公开，无鉴权                               |
| API 地址写入 APK | `.env.production` 的 `EXPO_PUBLIC_API_*`   |
| 签名             | debug keystore                             |
| Android 主路径   | Web 下载 APK；Expo Go 备选                 |

## 验收标准

- 宿主机 agent 运行时，Web 可触发构建；状态可见；成功后 `/downloads/native-location-preview.apk` 可公开下载。
- 无 Key 无法触发构建；下载无需 Key。
- APK 安装后可连公网 API 完成定位上报入库。
- 构建中再次触发返回冲突（同时仅一个任务）。

## 操作手册

见 [../internal-release.md](../internal-release.md)。
