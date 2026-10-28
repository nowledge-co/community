import { selectUnacknowledgedEvents } from './session-delta.js'
import { snapshotSessionEvents } from './session-events.js'
import { boundText, sessionThreadTitle } from './thread-import.js'
import { transcriptMessage, transcriptText } from './transcript.js'

function buildThreadImportDelta(capture, acknowledgedSeq) {
  const delta = selectUnacknowledgedEvents(capture.events, acknowledgedSeq)
  const messages = []
  for (const event of delta.events) {
    const message = transcriptMessage(event)
    if (message === undefined) continue
    const role = event.type === 'user/message' ? 'user' : 'assistant'
    const content = boundText(transcriptText(message).trim(), capture.maxMessageChars)
    if (content === '') continue
    const metadata = {
      external_id: `deepseek-harness:${capture.sessionId}:${event.seq}:${message.id}`,
      dsh_seq: event.seq,
      dsh_event_type: event.type,
      dsh_message_id: message.id,
      dsh_source_kind: message.source.kind,
    }
    if (event.type === 'assistant/message') {
      metadata.dsh_turn = event.data.turn
      metadata.dsh_step = event.data.step
      metadata.dsh_model_provider = event.data.message.source.provider
      metadata.dsh_model = event.data.message.source.model
    }
    messages.push({
      role,
      content,
      timestamp: new Date(event.time).toISOString(),
      metadata,
    })
  }
  if (messages.length === 0) return undefined
  return {
    acknowledgedSeq: delta.nextSeq,
    reset: delta.reset,
    payload: {
      title: capture.title,
      messages,
      metadata: {
        source_app: capture.sourceApp,
        dsh_session_id: capture.sessionId,
        dsh_cwd: capture.session.header.cwd,
        dsh_parent_session: capture.session.header.parentSession,
        dsh_origin: capture.session.header.origin,
        dsh_agent_preset: capture.session.header.agentPreset,
      },
    },
  }
}

/**
 * Capture exactly one DSH event view, then derive every payload and retry for
 * this import attempt from that immutable view.
 */
export function captureSession(session, options) {
  const events = snapshotSessionEvents(session)
  const sessionId = String(session.header.id)
  const capture = {
    events,
    session,
    sessionId,
    sourceApp: options.sourceApp,
    maxMessageChars: options.maxMessageChars,
    title: sessionThreadTitle(
      events,
      sessionId,
      transcriptText,
      options.maxMessageChars,
      options.establishedTitle,
    ),
  }
  return {
    events,
    sessionId,
    title: capture.title,
    deltaFrom: acknowledgedSeq => buildThreadImportDelta(capture, acknowledgedSeq),
  }
}
