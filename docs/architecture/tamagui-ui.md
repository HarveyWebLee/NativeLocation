# 手机端 UI：Tamagui

| 项       | 内容                                                                           |
| -------- | ------------------------------------------------------------------------------ |
| 文档类型 | 独立架构决策                                                                   |
| 状态     | 已确认                                                                         |
| 实现总览 | [../implementation-summary.md](../implementation-summary.md)                   |
| 官方文档 | [https://tamagui.dev/llms.txt](https://tamagui.dev/llms.txt)                   |
| 仓库副本 | [../../.cursor/skills/tamagui/llms.txt](../../.cursor/skills/tamagui/llms.txt) |
| 技能     | [../../.cursor/skills/tamagui/SKILL.md](../../.cursor/skills/tamagui/SKILL.md) |

## 背景与目标

手机端需要跨 iOS / Android 的组件与样式体系。选定 [Tamagui](https://tamagui.dev/) 作为 React Native UI 框架。Agent 与开发必须以官方 LLM 文档开发，避免臆造 API。

## 决策

1. **`apps/mobile` 使用 Tamagui**（Core + UI Kit），不另选一套平行 UI 库。
2. **开发依据**：仓库内 `.cursor/skills/tamagui/llms.txt`，与 [https://tamagui.dev/llms.txt](https://tamagui.dev/llms.txt) 同步；使用前按章节检索，组件取最新稳定版，配置用 Config v5。
3. **Expo**：对齐本仓库 SDK 54；接入步骤以文档 `guides/expo`、`guides/metro` 为准。
4. **双端**：业务与 UI 必须在 iOS 与 Android 上兼容（`.cursor/rules/platform-ios-android.mdc`）。

## 影响面

| 面     | 影响                                                           |
| ------ | -------------------------------------------------------------- |
| mobile | 依赖、`tamagui.config`、Provider、界面组件替换 RN `StyleSheet` |
| api    | 无                                                             |
| shared | 无（契约不变）                                                 |
| 数据   | 无                                                             |

## 备选方案

| 决策点 | 未采用        | 原因                      |
| ------ | ------------- | ------------------------- |
| UI 库  | 仅 RN 原组件  | 主题与跨端组件成本高      |
| UI 库  | NativeBase 等 | 与本次选定 Tamagui 不一致 |

## 范围

- **做：** 官方 `llms.txt` 入库；`apps/mobile` 用 Tamagui Config v5 + `v5-rn` 动画驱动重构主界面（申请/取消权限、开启定位、采集频率）。编译器插件（babel/metro-plugin）本期可选，默认 Metro 配置可运行即可。
- **不做：** 完整后台追踪 UI；不为 API 引入 Tamagui。

## 已决

- 权威文档 URL 与仓库副本路径如上。
- 每次使用 Tamagui 必须依据该文档。
- 动画驱动用 `@tamagui/config/v5-rn`（Expo Go 可用 RN Animated，避免强制 Reanimated 自定义开发客户端）。

## 验收标准

- 仓库存在 `.cursor/skills/tamagui/llms.txt`，且 `SKILL.md` / 规则 / `AGENTS.md` 指向该文件。
- 后续改 `apps/mobile` UI 时，实现与 `llms.txt` 对应章节一致，并考虑 iOS / Android。
