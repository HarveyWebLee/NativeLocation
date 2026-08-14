---
name: code-quality-gate
description: 运行并修复 NativeLocation 全仓 Prettier、ESLint（含 import 顺序）与 TypeScript typecheck。在提交前、改完代码后、用户提到 format/lint/typecheck/precommit/质量门禁时使用。
---

# 代码质量门禁

## 何时使用

- 完成功能/修复后准备提交
- 用户要求格式化、eslint、import 顺序、typecheck
- pre-commit 失败需要排查

## 标准流程

按顺序执行（均在仓库根目录）：

```bash
pnpm format
pnpm lint:fix
pnpm typecheck
```

或：`pnpm precommit`

仅检查不写盘：`pnpm check`

## 失败处理

1. Prettier：按报错改文件后重跑 `pnpm format`
2. ESLint / import：优先 `pnpm lint:fix`；无法自动修的按规则手改
3. Typecheck：先 `pnpm --filter @native-location/shared build`，再 `pnpm typecheck`
4. 全部通过后再 `git add` 与提交

## 配置位置

- Prettier：`.prettierrc`、`.prettierignore`
- ESLint + import：`eslint.config.mjs`（`simple-import-sort`）
- TS：`packages/tsconfig/*` 与各包 `tsconfig.json`
- Git hooks：`.husky/pre-commit`、`.husky/commit-msg`
