---
name: git-commit-convention
description: 按 Angular Conventional Commits 与简体中文 subject 撰写 NativeLocation 提交说明。在用户要求提交、写 commit message、或规范化提交信息时使用。
---

# Git 提交规范

完整约定见 `.cursor/rules/git-commit.mdc`。校验：`commitlint.config.cjs`、`.husky/commit-msg`。

## 格式

```text
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

- 提交说明使用简体中文
- type：`feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`
- scope：kebab-case，常用 `api` `mobile` `shared` `tooling` `prisma` `cursor` `ci`
- subject：祈使语气、不加句号、≤72 字符；header 整行 ≤100 字符
- body / footer 可选；与 header 空一行；破坏性变更写 `BREAKING CHANGE:`

## 原则

1. `subject` 写清「为什么 / 做了什么」，禁止「改一下」「更新」
2. 一次提交一件事；message 与 diff 一致
3. `feat` = 新能力；`fix` = 修缺陷；勿滥用 `chore`
4. 仅在用户明确要求时执行 `git commit`
5. 用 HEREDOC 传 message；不改 git config；不 `--no-verify`；不擅自 amend / force push

## 提交前

```bash
pnpm precommit
```

## 示例

```text
feat(shared): 补充位置批量上报 Zod 契约
fix(api): 处理 WebSocket 断线后的校验错误
fix(mobile): 修复前台定位权限申请失败
chore(tooling): 统一 eslint 与 prettier 配置
```
