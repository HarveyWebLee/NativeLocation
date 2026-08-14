---
name: tamagui
description: >-
  按仓库内官方 Tamagui llms.txt 做 Expo / React Native UI。在安装、配置、改 apps/mobile 界面、使用 Tamagui 组件或 styled/theme/tokens、或用户提到 Tamagui / tamagui.dev 时必须使用。
---

# Tamagui（必须按官方文档）

手机端 UI 以 [Tamagui](https://tamagui.dev/) 为准。**禁止凭记忆或过时博客写 API**。

权威文档（本仓库副本，来源 [https://tamagui.dev/llms.txt](https://tamagui.dev/llms.txt)）：

- [llms.txt](llms.txt)

## 每次开发前

1. **先读本 skill**，再用 Grep/Read **检索 [llms.txt](llms.txt)** 中对应章节，再写代码。
2. 不要把整份 `llms.txt` 读进上下文。按标题检索，只读相关段落。
3. 组件有多版本时（如 `button/1.0.0` 与 `button/2.0.0`），**用该组件文档中的最新稳定版本**（通常为 `2.0.0`）。
4. 配置用 **Config v5**（`## core/config-v5`），不要用 v4，除非文档明确兼容说明。
5. 本仓库客户端是 **Expo SDK 54 + React Native**，优先读：
   - `## guides/expo`
   - `## guides/metro`
   - `## intro/compiler-install`
   - `## core/configuration`
6. 行为与样式必须在 **iOS 与 Android** 上可用（见 `.cursor/rules/platform-ios-android.mdc`）。Web 预览可辅助布局，不能替代真机/模拟器结论。
7. 与仓库冲突时：Expo SDK 54 文档优先于 Tamagui 示例里的 Expo 版本；Tamagui 组件 API 仍以 `llms.txt` 为准。

## 检索方式

在 `llms.txt` 中 Grep 标题，例如：

| 需求        | 检索                               |
| ----------- | ---------------------------------- |
| 接入 Expo   | `^## guides/expo`                  |
| Metro       | `^## guides/metro`                 |
| 编译器      | `^## intro/compiler-install`       |
| Config v5   | `^## core/config-v5`               |
| styled      | `^## core/styled`                  |
| View / Text | `^## core/view-and-text`           |
| Button      | `^## components/button/2.0.0`      |
| 动画（RN）  | `^## core/animations-react-native` |

需要某组件时：先 Grep `^## components/<name>/`，取最高版本章节再 Read。

## 本仓库落地约束

- 只在 `apps/mobile` 使用 Tamagui；不要引入到 `apps/api`。
- 不新增文档未要求的依赖；优先 `tamagui`、`@tamagui/config` 及 Expo 指南列出的包。
- 用 Tamagui 的 `Button` / `YStack` / `XStack` / `Text` / `Card` 等，不要为同一套 UI 再堆一套手写 `StyleSheet`，除非文档要求原生逃生舱。
- 主题、token、间距用 config，避免硬编码与文档 token 体系冲突的魔法数（业务常量如采集间隔除外）。

## 文档过期

若官方行为与副本明显不符：以 [https://tamagui.dev/llms.txt](https://tamagui.dev/llms.txt) 核对后更新本目录 `llms.txt`，并在提交说明中写明来源 URL。
