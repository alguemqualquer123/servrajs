#!/usr/bin/env node

/**
 * Servra - CLI
 *
 * Command-line interface for creating and running Servra projects.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PACKAGE_NAME = 'servrajs';
const VERSION = '1.0.0';
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiTemplateDir = join(packageRoot, 'templates', 'api-base');

// ============================================================================
// CLI Commands
// ============================================================================

const commands = {
  create: {
    description: 'Create a new Servra project',
    usage: 'servra create <project-name>',
    run: runCreate,
  },
  dev: {
    description: 'Start a built project entry file',
    usage: 'servra dev [entry-file]',
    run: runDev,
  },
  start: {
    description: 'Start a production server entry file',
    usage: 'servra start [entry-file]',
    run: runStart,
  },
  build: {
    description: 'Show build guidance for Servra projects',
    usage: 'servra build',
    run: runBuild,
  },
  version: {
    description: 'Show version',
    usage: 'servra version',
    run: () => console.log(`Servra v${VERSION}`),
  },
  help: {
    description: 'Show help',
    usage: 'servra help [command]',
    run: runHelp,
  },
};

// ============================================================================
// Main
// ============================================================================

const args = process.argv.slice(2);
const command = args[0] || 'help';

try {
  if (command === 'help') {
    runHelp(args[1]);
  } else if (commands[command]) {
    await commands[command].run(...args.slice(1));
  } else {
    console.error(`Unknown command: ${command}`);
    runHelp();
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

// ============================================================================
// Command Implementations
// ============================================================================

async function runCreate(name) {
  const projectName = validateProjectName(name);
  const cwd = resolve(process.cwd());
  const projectDir = resolve(cwd, projectName);

  if (!projectDir.startsWith(cwd + sep) && projectDir !== cwd) {
    throw new Error('Project path must stay inside the current directory');
  }

  if (existsSync(projectDir)) {
    throw new Error(`Directory ${projectName} already exists`);
  }

  console.log(`Creating Servra project: ${projectName}`);

  copyTemplate(apiTemplateDir, projectDir, {
    __PROJECT_NAME__: projectName,
    __PACKAGE_NAME__: PACKAGE_NAME,
  });
  writeWindowsNpmrc(projectDir);

  console.log(`Project ${projectName} created successfully.`);
  console.log(`cd ${projectName} && npm install && npm run dev`);
}

async function runDev(entryFile = 'dist/index.js') {
  await runEntry(entryFile);
}

async function runStart(entryFile = 'dist/index.js') {
  await runEntry(entryFile);
}

function runBuild() {
  console.log('Use npm run build inside your Servra project.');
}

function runHelp(cmd) {
  if (cmd && commands[cmd]) {
    console.log(`${cmd}: ${commands[cmd].description}`);
    console.log(`Usage: ${commands[cmd].usage}`);
    return;
  }

  console.log(`Servra v${VERSION}`);
  console.log('\nAvailable commands:');
  for (const [name, cmdInfo] of Object.entries(commands)) {
    console.log(`  ${name.padEnd(10)} ${cmdInfo.description}`);
  }
  console.log('\nUsage: servra <command> [options]');
  console.log('\nFor help: servra help <command>');
}

async function runEntry(entryFile) {
  const entryPath = resolve(process.cwd(), entryFile);
  const moduleUrl = pathToFileURL(entryPath).href;
  const mod = await import(moduleUrl);
  const app = mod.default ?? mod.app;

  if (app && typeof app.listen === 'function' && !app.running) {
    const port = Number(process.env.PORT ?? 3000);
    await app.listen(port, process.env.HOST ?? '127.0.0.1');
  }
}

function validateProjectName(name) {
  if (!name) {
    throw new Error('Please provide a project name: servra create <project-name>');
  }

  if (name.length > 214) {
    throw new Error('Project name is too long');
  }

  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    throw new Error('Project name cannot include path traversal');
  }

  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name)) {
    throw new Error('Project name can contain only letters, numbers, dot, underscore, and dash');
  }

  return name;
}

function writeWindowsNpmrc(projectDir) {
  if (process.platform !== 'win32') {
    return;
  }

  const shells = [
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
  ];
  const shell = shells.find((item) => existsSync(item));

  if (shell) {
    writeFileSync(join(projectDir, '.npmrc'), `script-shell=${shell}\n`);
  }
}

function copyTemplate(sourceDir, targetDir, replacements) {
  mkdirSync(targetDir, { recursive: true });

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = join(sourceDir, entry.name);
    const targetName = entry.name === 'gitignore' ? '.gitignore' : entry.name;
    const targetPath = join(targetDir, targetName);

    if (entry.isDirectory()) {
      copyTemplate(sourcePath, targetPath, replacements);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const content = readFileSync(sourcePath, 'utf8');
    writeFileSync(targetPath, replaceTokens(content, replacements));
  }

  assertCopiedInside(sourceDir, targetDir);
}

function replaceTokens(content, replacements) {
  let output = content;
  for (const [token, value] of Object.entries(replacements)) {
    output = output.split(token).join(value);
  }
  return output;
}

function assertCopiedInside(sourceDir, targetDir) {
  const source = resolve(sourceDir);
  const target = resolve(targetDir);
  const relativeTarget = relative(resolve(process.cwd()), target);

  if (!statSync(source).isDirectory()) {
    throw new Error('Template source must be a directory');
  }

  if (relativeTarget.startsWith('..')) {
    throw new Error('Refusing to copy template outside the current directory');
  }
}
