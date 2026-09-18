# 本机打 Android debug APK：问题与解决方案

本文记录 `pnpm apk:build`（方式一：宿主机本机构建）过程中已遇到的问题与处理办法。操作主流程见 [internal-release.md](./internal-release.md)；正式 HTTPS / EAS 见 [deploy.md](./deploy.md)。

**命令（仓库根目录）：**

```bash
pnpm apk:build
```

产物：`deploy/apk/native-location-preview.apk`。

---

## 1. 前置缺失：JDK / Android SDK / `.env.production`

### 现象

- `java: command not found`
- 无 `ANDROID_HOME` / 本机无 SDK 目录
- 脚本报错：缺少 `EXPO_PUBLIC_API_HTTP_URL` / `WS_URL` / `API_KEY`

### 原因

构建脚本会读 `.env.production`，并调用 `expo prebuild` + Gradle；三者缺一不可。

### 解决

1. **JDK 17+**（本机曾用 Microsoft OpenJDK 17）
   - 若 `winget` 因网络失败，可用 `curl --ssl-no-revoke` 下载 MSI/ZIP，管理员安装或解压到用户目录。
   - 设置用户环境变量 `JAVA_HOME`，并把 `%JAVA_HOME%\bin` 加入用户 `Path`。

2. **Android SDK（可不安完整 Android Studio）**
   - 下载 [commandlinetools](https://developer.android.com/studio#command-line-tools-only)，解压到例如：  
     `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\`
   - 接受许可并安装至少：`platform-tools`、`platforms;android-35`（或构建日志要求的 36）、`build-tools`。
   - Expo / RN 首次构建还可能自动拉取 **NDK**、**Platform 36**、**Build-Tools 36**，需可访问 Google SDK 源。
   - 设置 `ANDROID_HOME` / `ANDROID_SDK_ROOT`，并把 `platform-tools`、`cmdline-tools\latest\bin` 加入 `Path`。

3. **`.env.production`**（从 `.env.production.example` 复制后改真实值）
   - `API_KEY` 与 `EXPO_PUBLIC_API_KEY` **相同**（可用 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` 生成）。
   - `EXPO_PUBLIC_API_HTTP_URL` / `WS_URL` 填手机能访问的 IP（不要 `127.0.0.1`）。

4. **改完环境变量后新开终端**（或重启 Cursor），否则当前会话仍找不到 `java` / `adb`。

---

## 2. `winget` / HTTPS 下载失败（证书吊销或 GitHub 超时）

### 现象

```text
InternetOpenUrl() failed
CRYPT_E_REVOCATION_OFFLINE
Connection timed out（访问 github.com）
```

### 原因

本机访问部分官方源不稳定；Windows Schannel 吊销检查离线时也会失败。

### 解决

- 下载 JDK / SDK 时使用：`curl -L --ssl-no-revoke ...`
- GitHub / `services.gradle.org` 不可达时，改用国内可访问镜像（见下一节 Gradle）。

---

## 3. Gradle 发行包下载超时

### 现象

```text
Downloading https://services.gradle.org/distributions/gradle-8.14.3-bin.zip
java.io.IOException: ... failed: timeout (10000ms)
SocketTimeoutException / SocksSocketImpl
```

### 原因

官方地址常重定向到 GitHub；默认 `networkTimeout=10000` 过短；部分环境 Java 走系统 SOCKS 代理导致更慢。

### 解决

1. **预置到本地 Gradle Wrapper 缓存**（推荐）
   - 失败后目录类似：  
     `%USERPROFILE%\.gradle\wrapper\dists\gradle-8.14.3-bin\<hash>\`
   - 删除其中的 `.lck` / `.part`，用镜像下载完整 zip 放到该目录并命名为 `gradle-8.14.3-bin.zip`。
   - 可用镜像示例：  
     `https://mirrors.cloud.tencent.com/gradle/gradle-8.14.3-bin.zip`

2. **加大超时**（可选）：`apps/mobile/android/gradle/wrapper/gradle-wrapper.properties` 中  
   `networkTimeout=120000`  
   （注意：`expo prebuild` 可能改写 `android/`，改后若被覆盖需再设或依赖已缓存的 zip。）

3. **构建时关闭系统代理干扰**（可选）：

```bash
export JAVA_OPTS="-Djava.net.useSystemProxies=false"
export GRADLE_OPTS="-Djava.net.useSystemProxies=false"
```

---

## 4. Reanimated / Worklets 与 RN 0.81 不兼容

### 现象

```text
[Worklets] React Native (0.81.5) is not compatible with Worklets (0.11.4)
[Reanimated] ... not compatible with Reanimated (4.5.3)
BUILD FAILED
```

### 原因

`@tamagui/config` 会带上 `@tamagui/animations-reanimated` 的 peer；未钉版本时可能装到与 **Expo SDK 54 / RN 0.81** 不兼容的 `reanimated@4.5.x` + `worklets@0.11.x`。  
（UI 配置虽用 `@tamagui/config/v5-rn`，这些包仍可能被装上并参与原生链接。）

### 解决（仓库已落地）

- `apps/mobile` 显式依赖（与 `npx expo install` 建议一致）：
  - `react-native-reanimated`: `~4.1.1`
  - `react-native-worklets`: `0.5.1`
- 根目录 `package.json` → `pnpm.overrides` 锁定上述版本，避免再次被抬高。

改依赖后执行 `pnpm install`，再跑 `pnpm apk:build`。

兼容对照（摘要）：RN 0.81 可用 Reanimated **4.1.x–4.3.x**，不可用 **4.5.x**；4.1.x 配 Worklets **0.5.x**。

---

## 5. 无域名、无 TLS 证书：APK 能否使用？

### 结论

**可以。** 内测 debug APK 不依赖域名与 HTTPS 证书。

| 不需要                         | 需要                                                              |
| ------------------------------ | ----------------------------------------------------------------- |
| 域名、Let's Encrypt、nginx tls | 可访问的 API（IP:18156）                                          |
| Play 商店签名                  | `.env.production` 中正确的 `EXPO_PUBLIC_*` 并重新打包             |
|                                | 防火墙放行 18156（Web 下载再放行 `WEB_PORT`，当前示例多为 28881） |

注意：

- URL 不要写 `127.0.0.1`（对手机来说是手机自身）。
- 改 API 地址或 Key 后必须重新构建 APK。
- 正式上架 / HTTPS 再按 [deploy.md](./deploy.md) 配置。

---

## 6. 建议排查顺序

1. `java -version`、`echo %ANDROID_HOME%`（或 Git Bash `$ANDROID_HOME`）、`.env.production` 三项 `EXPO_PUBLIC_*`
2. Gradle zip 是否已在 `~/.gradle/wrapper/dists/...`
3. `pnpm list react-native-reanimated react-native-worklets`（期望约 4.1.x / 0.5.1）
4. 查看 `deploy/apk/build-status.json` 的 `logTail`
5. 首次构建耗时长（下 NDK / Maven），磁盘与内存建议充足（文档建议 ≥ 8GB）

---

## 相关文件

| 路径                            | 说明                                           |
| ------------------------------- | ---------------------------------------------- |
| `scripts/build-android-apk.mjs` | 本机构建入口                                   |
| `scripts/apk-build-agent.mjs`   | Web 触发构建的本机 agent                       |
| `apps/mobile/eas.json`          | EAS（方式二，非本文重点）                      |
| `deploy/apk/`                   | APK 与 `build-status.json`                     |
| `docker-compose.prod.yml`       | `web` 只读挂载 `./deploy/apk` 供 `/downloads/` |
