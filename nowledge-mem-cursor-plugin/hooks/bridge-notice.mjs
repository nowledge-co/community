import { bridgeSessionHint, closeLocalBridgeSession, readBridgeHookInput, bridgeNoticeHint } from './agent-bridge-notices.mjs';

const input = readBridgeHookInput();
const session = input.conversation_id || input.session_id;
let hint = '';
if (input.hook_event_name === 'sessionEnd') {
  closeLocalBridgeSession('cursor', session);
} else if (input.hook_event_name === 'sessionStart' && process.env.NMEM_BRIDGE_INBOX_ON_START === '1' && process.env.NMEM_AGENT_CONTEXT?.trim()) {
  hint = bridgeSessionHint('cursor', session);
 } else if (input.hook_event_name === 'postToolUse') {
  hint = bridgeNoticeHint('cursor', session, process.env, undefined, 'tool');
}

process.stdout.write(JSON.stringify(hint ? {additional_context: hint} : {}) + '\n');
