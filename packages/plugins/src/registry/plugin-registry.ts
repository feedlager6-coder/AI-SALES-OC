import type {
  ILeadSourcePlugin,
  IEmailFinderPlugin,
  ICompanyDataPlugin,
  IEmailSendingPlugin,
  ILLMPlugin,
  INotificationPlugin,
  IStoragePlugin,
} from '../interfaces/index.js'

export type PluginCategory =
  | 'lead_source'
  | 'email_finder'
  | 'company_data'
  | 'email_sending'
  | 'llm'
  | 'notification'
  | 'storage'

export type AnyPlugin =
  | ILeadSourcePlugin
  | IEmailFinderPlugin
  | ICompanyDataPlugin
  | IEmailSendingPlugin
  | ILLMPlugin
  | INotificationPlugin
  | IStoragePlugin

export interface PluginEntry {
  plugin: AnyPlugin
  category: PluginCategory
  /** Lower number = higher priority (used in waterfall) */
  priority: number
  enabled: boolean
}

export class PluginRegistry {
  private readonly plugins = new Map<string, PluginEntry>()

  register(entry: PluginEntry): void {
    if (!entry.enabled) return
    this.plugins.set(entry.plugin.name, entry)
  }

  getByCategory<T extends AnyPlugin>(category: PluginCategory): T[] {
    return Array.from(this.plugins.values())
      .filter((e) => e.category === category && e.enabled)
      .sort((a, b) => a.priority - b.priority)
      .map((e) => e.plugin as T)
  }

  get<T extends AnyPlugin>(name: string): T {
    const entry = this.plugins.get(name)
    if (!entry) throw new Error(`Plugin '${name}' is not registered or not enabled`)
    return entry.plugin as T
  }

  isRegistered(name: string): boolean {
    return this.plugins.has(name)
  }

  listAll(): Array<{ name: string; category: PluginCategory; priority: number }> {
    return Array.from(this.plugins.values()).map((e) => ({
      name: e.plugin.name,
      category: e.category,
      priority: e.priority,
    }))
  }
}

/** Singleton registry — used across the entire application */
export const registry = new PluginRegistry()
