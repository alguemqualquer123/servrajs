/**
 * Cross-platform build runner with incremental compilation.
 * 
 * Only compiles modified files if a previous build exists.
 */

import { 
  rmSync, watch, 
  existsSync, statSync, readdirSync, readFileSync, writeFileSync 
} from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const node = process.execPath;
const watchMode = process.argv.includes('--watch');
const cleanMode = process.argv.includes('--clean');
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

function getFiles(dir, ext = '.ts') {
  const files = [];
  
  function walk(directory) {
    const entries = readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (entry.name.endsWith(ext)) {
        files.push(path);
      }
    }
  }
  
  walk(dir);
  return files;
}

function shouldCompile(srcFile, distFile) {
  if (!existsSync(distFile)) return true;
  
  const srcStat = statSync(srcFile);
  const distStat = statSync(distFile);
  
  return srcStat.mtimeMs > distStat.mtimeMs;
}

function getModifiedFiles(srcDir, distDir) {
  const srcFiles = getFiles(srcDir);
  const modified = [];
  
  for (const srcFile of srcFiles) {
    const relPath = relative(srcDir, srcFile);
    const distFile = join(distDir, relPath.replace(/\.ts$/, '.js'));
    
    if (shouldCompile(srcFile, distFile)) {
      modified.push(srcFile);
    }
  }
  
  return modified;
}

function build() {
  if (building) {
    queued = true;
    return;
  }

  building = true;
  queued = false;

  const srcDir = join(root, 'src');
  const distDir = join(root, 'dist');

  try {
    // Check if incremental build is possible
    const hasPreviousBuild = existsSync(distDir);
    
    if (cleanMode || !hasPreviousBuild) {
      // Full clean build
      if (hasPreviousBuild) {
        rmSync(distDir, { recursive: true, force: true });
      }
      
      console.log('🧹 Full build');
      
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
    } else {
      // Incremental build - only modified files
      const modifiedFiles = getModifiedFiles(srcDir, distDir);
      
      if (modifiedFiles.length === 0) {
        console.log('✅ No files modified, skipping compile');
      } else {
        console.log(`📦 Incremental build: ${modifiedFiles.length} file(s)`);
        
        run(node, [
          join(root, 'node_modules', '@swc', 'cli', 'bin', 'swc.js'),
          ...modifiedFiles.map((file) => relative(root, file)),
          '-d',
          'dist',
          '--extensions',
          '.ts',
          '--strip-leading-paths',
          '--source-maps',
        ]);
      }
    }

    // Always generate declarations (incremental)
    run(node, [
      join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
      '--emitDeclarationOnly',
    ]);

    run(node, [join(root, 'scripts', 'add-extensions.js')]);
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  } finally {
    building = false;
  }

  if (queued) {
    build();
  }
}

build();

if (watchMode) {
  console.log('\n👀 Watching src for changes...');
  let timer;

  watch(join(root, 'src'), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log('\n📄 Change detected, rebuilding...');
      build();
    }, 100);
  });
}
