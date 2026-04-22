/**
 * Cross-platform build runner.
 *
 * Avoids nested `npm run ...` calls because npm lifecycle scripts can run
 * through cmd.exe on Windows environments where npm is not visible to cmd.
 */

import { rmSync, watch } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const node = process.execPath;
const watchMode = process.argv.includes('--watch');
let building = false;
let queued = false;

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function build() {
  if (building) {
    queued = true;
    return;
  }

  building = true;
  queued = false;

  try {
    rmSync(join(root, 'dist'), { recursive: true, force: true });

    run(node, [
      join(root, 'node_modules', '@swc', 'cli', 'bin', 'swc.js'),
      'src',
      '-d',
      'dist',
      '--extensions',
      '.ts',
      '--strip-leading-paths',
      '--source-maps',
    ]);

    run(node, [
      join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
      '--emitDeclarationOnly',
    ]);

    run(node, [join(root, 'scripts', 'add-extensions.js')]);
  } finally {
    building = false;
  }

  if (queued) {
    build();
  }
}

build();

if (watchMode) {
  console.log('Watching src for changes...');
  let timer;

  watch(join(root, 'src'), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(build, 100);
  });
}
