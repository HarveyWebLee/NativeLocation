#!/usr/bin/env node
/**
 * stop：侧车日志/审计用；不返回 followup_message，避免反复追问打断会话。
 * 质量门禁约定见 AGENTS.md 与 .cursor/rules。
 */
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

await readStdin();
process.exit(0);
