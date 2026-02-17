/**
 * Builds the agent_end hook handler.
 * OpenClaw thread/session persistence is intentionally disabled for nmem-cli.
 */
export function buildCaptureHandler(_client, _cfg, logger) {
	let warned = false;

	return async (event) => {
		if (!event?.success) return;
		if (!warned) {
			warned = true;
			logger.warn(
				"capture: autoCapture is enabled, but thread/message persistence is not supported in nmem-cli for OpenClaw. Skipping capture.",
			);
		}
	};
}
