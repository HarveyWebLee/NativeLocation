# 生产环境发布准备

| 项       | 内容                                                                             |
| -------- | -------------------------------------------------------------------------------- |
| 文档类型 | 独立业务需求                                                                     |
| 状态     | 已确认                                                                           |
| 总 FRD   | [../functional-requirements.md](../functional-requirements.md)                   |
| 架构决策 | [../architecture/production-release.md](../architecture/production-release.md)   |
| 实现总览 | [../implementation-summary.md](../implementation-summary.md)                     |
| 隐私政策 | [../legal/privacy-policy.md](../legal/privacy-policy.md)                         |
| 操作手册 | [../deploy.md](../deploy.md)                                                     |
| 公网内测 | [../internal-release.md](../internal-release.md)（无域名本机公网阶段，先于本文） |

## 背景与目标

将当前仅适合内网/Expo Go 的 MVP，准备为可在自有 VPS 上运行的生产服务，并打出可上架的 iOS / Android 独立安装包。

无正式域名、仅需外网真机验收时，先完成 [公网内测](../internal-release.md)，再回到本文做 HTTPS 与独立包。

## 范围

### 本期（In Scope）

- 生产 API：HTTPS/WSS（反向代理终止 TLS）、PostgreSQL 映射宿主机 **`127.0.0.1:${POSTGRES_PORT}`**、`prisma migrate deploy`。
- 接口静态 API Key（HTTP `X-Api-Key`，WebSocket 查询参数 `apiKey`）；`GET /health` 免密钥。
- 独立 App 构建配置（EAS）；生产构建写入 `EXPO_PUBLIC_API_*` 与 Key。
- Compose 可含 Mobile Web 静态服务（端口默认 18202）；公网内测阶段可不起 nginx，见 [internal-release.md](./internal-release.md)。
- 店铺材料：隐私政策正文、权限说明；生产包**不声明未实现的后台定位能力**（避免审核失败）。
- VPS 部署样例：Docker Compose（Postgres + API + Nginx [+ Web]）；Nginx 配置与证书均在 `deploy/` 下挂载。

### 明确不做

- 用户账号 / OAuth / 每用户 Token。
- 把 API Key 做成不可反编译的机密（Key 会打进客户端，仅防误连与随手扫描）。
- 代为执行 App Store / Play 账号注册、付费、实际上架（需你方开发者账号与域名证书）。
- 多实例、Redis、后台持续定位。

## 已决

| 项       | 结论                                                          |
| -------- | ------------------------------------------------------------- |
| 发布目标 | 后端生产化 + 独立安装包 + 店铺上架准备                        |
| 托管     | 自有 VPS；域名与机器由需求方提供                              |
| 对外端口 | 不使用 80/443；HTTP **18200**，HTTPS/WSS **18201**            |
| 接口安全 | 静态 API Key；生产环境未配置 Key 则拒绝启动                   |
| 坐标系   | 仍为 WGS84                                                    |
| 后台定位 | 生产包不启用后台定位权限/Background Modes（MVP 未做持续后台） |

## 待运维填写（不阻塞仓库落地）

- 生产域名、TLS 证书（建议 Let's Encrypt）。
- Apple Developer / Google Play / Expo 账号；`eas init` 写入 `projectId`。
- 将隐私政策托管到可公网访问的 HTTPS URL，填入商店与 `app.json`。

## 验收标准

- 生产 API 仅 HTTPS/WSS（`https://域名:18201`）；无 Key 的注册/上报表 401；`/health` 200。
- 带正确 Key 的真机独立包可注册设备并入库。
- `eas.json` 可打 preview（内测）与 production 包。
- 文档含 VPS 部署步骤与上架清单。
