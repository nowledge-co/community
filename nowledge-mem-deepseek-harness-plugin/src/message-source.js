/** Recognize both legacy attribution and DSH's migrated producer-owned kind. */
export function isPluginSource(source, pluginName) {
  if (source?.kind === 'plugin') return pluginName === undefined || source.plugin === pluginName
  if (typeof source?.kind !== 'string') return false
  return pluginName === undefined
    ? source.kind.startsWith('plugin:')
    : source.kind === `plugin:${pluginName}`
}
