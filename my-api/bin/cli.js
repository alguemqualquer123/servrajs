#!/usr/bin/env node
const { spawnSync } = require('child_process');

const cmd = process.argv[2];
if (!cmd || ['-h', '--help', 'help'].includes(cmd)) {
  console.log(`Usage: my-api <command>
Commands:
  dev         Run type‑check then start server (watch)
  build       Compile source
  start       Run compiled server
  type-check  Check TypeScript types`);
  process.exit(0);
}

const result = spawnSync('npm', ['run', cmd], { stdio: 'inherit', shell: true });
if (result.error) {
  console.error('Failed to execute npm script:', result.error);
  process.exit(1);
}
process.exit(result.status);
