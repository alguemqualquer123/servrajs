/**
 * Servra - Plugin System
 */

import type { Plugin, LOAApp } from '../core/types';
import type { LOAApplication } from '../core/application';

// ============================================================================
// Plugin Manager
// ============================================================================

export class PluginManager {
  readonly #plugins: Map<string, Plugin> = new Map();
  readonly #app: LOAApplication;

  constructor(app: LOAApplication) {
    this.#app = app;
  }

  /**
   * Register plugin
   */
  async register(plugin: Plugin): Promise<void> {
    if (!plugin.name) {
      throw new Error('Plugin must have a name');
    }

    if (this.#plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} is already registered`);
    }

    // Run register function
    if (typeof plugin.register === 'function') {
      await plugin.register(this.#app);
    }

    this.#plugins.set(plugin.name, plugin);
  }

  /**
   * Unregister plugin
   */
  async unregister(name: string): Promise<void> {
    const plugin = this.#plugins.get(name);
    
    if (!plugin) {
      throw new Error(`Plugin ${name} is not registered`);
    }

    // Run cleanup if available
    if (typeof (plugin as unknown as { unload?: () => void }).unload === 'function') {
      await (plugin as unknown as { unload: () => void }).unload();
    }

    this.#plugins.delete(name);
  }

  /**
   * Get plugin
   */
  get(name: string): Plugin | undefined {
    return this.#plugins.get(name);
  }

  /**
   * List plugins
   */
  list(): Plugin[] {
    return Array.from(this.#plugins.values());
  }

  /**
   * Check if plugin exists
   */
  has(name: string): boolean {
    return this.#plugins.has(name);
  }
}

// ============================================================================
// Export
// ============================================================================

export default PluginManager;
