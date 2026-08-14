#!/usr/bin/env node
/**
 * beforeMCPExecution：审计 MCP 调用；默认放行，敏感操作提示 Agent 谨慎
 */
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const raw = await readStdin();
let payload = {};
try {
  payload = JSON.parse(raw || '{}');
} catch {
  payload = {};
}

const toolName = String(payload.tool_name ?? payload.toolName ?? '');
const serverName = String(payload.server_name ?? payload.server ?? '');
const combined = `${serverName} ${toolName}`.toLowerCase();

const sensitive =
  /push|force|delete|drop|deploy|production|secret|credential|token/.test(
    combined,
  );

if (sensitive) {
  process.stdout.write(
    JSON.stringify({
      permission: 'allow',
      agent_message:
        '该 MCP 调用可能涉及敏感/破坏性操作，请确认范围与后果后再继续。',
      user_message: `MCP 敏感调用：${serverName}/${toolName}`,
    }),
  );
} else {
  process.stdout.write(JSON.stringify({ permission: 'allow' }));
}

process.exit(0);
