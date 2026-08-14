# NativeLocation — Agent 指南

定位 App monorepo：Expo（`apps/mobile`）+ NestJS（`apps/api`）+ 共享契约（`packages/shared`）。

## 包与职责

| 路径                | 包名                        | 职责                             |
| ------------------- | --------------------------- | -------------------------------- |
| `apps/mobile`       | `@native-location/mobile`   | Expo SDK 54 / React Native       |
| `apps/api`          | `@native-location/api`      | NestJS HTTP + WebSocket + Prisma |
| `packages/shared`   | `@native-location/shared`   | Zod 契约与共享类型               |
| `packages/tsconfig` | `@native-location/tsconfig` | 共享 TS 基座配置                 |

## 质量门禁（必须）

修改代码后、提交前执行：

```bash
pnpm format      # Prettier 全仓格式化
pnpm lint:fix  # ESLint 修复（含 import 顺序）
pnpm typecheck   # turbo 各包 tsc --noEmit
```

或一键：`pnpm precommit` / `pnpm check`（检查不写盘）。

Git `pre-commit` 会强制跑 `format + lint:fix + typecheck`；`commit-msg` 校验 Conventional Commits。

## 代码规范要点

- TypeScript `strict`；避免 `any`；公开 API 显式类型
- import 顺序由 `eslint-plugin-simple-import-sort` 自动整理，勿手排
- 不引入新依赖除非必要；优先 workspace 内已有库
- 最小改动；行为变更时同步测试
- 对外说明用简体中文

## Git 提交规范

格式：`<type>(<scope>): <subject>`

- type：`feat` | `fix` | `docs` | `style` | `refactor` | `perf` | `test` | `build` | `ci` | `chore` | `revert`
- scope（kebab-case）：如 `api`、`mobile`、`shared`、`tooling`
- subject：祈使语气、简体中文、不加句号、≤72 字符

示例：`feat(api): 增加位置批量上报接口`

## Cursor 资产

- Rules：根目录 `.cursorrules`（含 Git 提交规范）、`.cursor/rules/`
- Skills：`.cursor/skills/`（`code-quality-gate`、`git-commit-convention`）
- Hooks：`.cursor/hooks.json`
  - `afterFileEdit`：改文件后自动 Prettier + ESLint（含 import 顺序）
  - `beforeMCPExecution`：MCP 调用审计（敏感操作提示）
  - `stop`：结束前提醒跑质量门禁

## 常用命令

```bash
pnpm install
pnpm db:up && pnpm db:generate && pnpm db:migrate
pnpm --filter @native-location/shared build
pnpm dev:api
pnpm dev:mobile
```

Expo 文档以 SDK 54 为准：https://docs.expo.dev/versions/v54.0.0/
