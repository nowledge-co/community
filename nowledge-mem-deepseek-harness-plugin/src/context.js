import { isPluginSource } from './message-source.js'

/**
 * Return whether the Mem Context Bundle is still visible to the model.
 *
 * DSH compaction keeps the raw event log but may replace the model-visible
 * surface, so checking session.events would treat a hidden bundle as present.
 */
export function hasContextBundle(session, pluginName = 'nowledge-mem') {
  return session.deriveMessages().some(message => isPluginSource(message.source, pluginName)
    && message.source.form === 'snapshot')
}
