/**
 * Servra - Hot Reload
 * 
 * File watcher with automatic server restart.
 */

import { watch, FSWatcher } from 'fs';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

export interface HotReloadOptions {
  watchPaths?: string[];
  ignorePaths?: string[];
  extensions?: string[];
  debounce?: number;
  startCommand?: string;
  signal?: 'SIGTERM' | 'SIGINT' | 'SIGKILL';
}

const DEFAULT_IGNORE = [
  'node_modules',
  'dist',
  '.git',
  'coverage',
  '*.log',
  '.DS_Store',
];

const DEFAULT_EXTENSIONS = ['.ts', '.js', '.json', '.yaml', '.yml'];
const DEFAULT_DEBOUNCE = 300;

export class HotReload extends EventEmitter {
  #watcher: FSWatcher | null = null;
  #options: Required<HotReloadOptions>;
  #proc: ReturnType<typeof spawn> | null = null;
  #running = false;
  #pending = false;

  constructor(options: HotReloadOptions = {}) {
    super();

    this.#options = {
      watchPaths: options.watchPaths ?? ['src'],
      ignorePaths: options.ignorePaths ?? DEFAULT_IGNORE,
      extensions: options.extensions ?? DEFAULT_EXTENSIONS,
      debounce: options.debounce ?? DEFAULT_DEBOUNCE,
      startCommand: options.startCommand ?? 'node dist/index.js',
      signal: options.signal ?? 'SIGTERM',
    };
  }

  start(): void {
    this.#startWatcher();
    this.#startProcess();
    this.#running = true;
    console.log('[HOT] Hot reload enabled');
  }

  #startWatcher(): void {
    const watchPath = this.#options.watchPaths[0] || '.';
    
    this.#watcher = watch(watchPath, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      if (this.#shouldIgnore(filename)) return;
      if (!this.#shouldWatch(filename)) return;

      console.log(`[HOT] File changed: ${filename}`);
      this.emit('change', eventType, filename);
      this.#scheduleRestart();
    });
  }

  #shouldIgnore(filename: string): boolean {
    for (const ignore of this.#options.ignorePaths) {
      if (ignore.startsWith('*')) {
        if (filename.endsWith(ignore.slice(1))) return true;
      } else if (filename.includes(ignore)) {
        return true;
      }
    }
    return false;
  }

  #shouldWatch(filename: string): boolean {
    return this.#options.extensions.some(ext => filename.endsWith(ext));
  }

  #scheduleRestart(): void {
    if (this.#pending) return;
    this.#pending = true;

    setTimeout(() => {
      this.#pending = false;
      this.#restart();
    }, this.#options.debounce);
  }

  #startProcess(): void {
    const [cmd, ...args] = this.#options.startCommand.split(' ');

    this.#proc = spawn(cmd as string, args, {
      stdio: 'inherit',
      shell: true,
    });

    this.#proc.on('exit', (code) => {
      if (code !== 0 && this.#running) {
        console.error(`[HOT] Process exited with code ${code}`);
        console.log('[HOT] Restarting...');
        setTimeout(() => this.#startProcess(), 1000);
      }
    });
  }

  #restart(): void {
    if (!this.#proc) return;

    console.log('[HOT] Restarting...');
    this.#proc.kill(this.#options.signal);

    setTimeout(() => {
      this.#startProcess();
    }, 500);
  }

  stop(): void {
    this.#running = false;

    if (this.#proc) {
      this.#proc.kill(this.#options.signal);
      this.#proc = null;
    }

    if (this.#watcher) {
      this.#watcher.close();
      this.#watcher = null;
    }

    console.log('[HOT] Stopped');
  }

  get running(): boolean {
    return this.#running;
  }
}

export function createHotReload(options?: HotReloadOptions): HotReload {
  return new HotReload(options);
}

export default { createHotReload, HotReload };
